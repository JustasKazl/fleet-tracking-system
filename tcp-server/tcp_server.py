#!/usr/bin/env python3
"""
TCP Server for FMB003 GPS Tracker
- Validates IMEI against vehicle table
- Parses AVL data packets
- Stores telemetry in database
"""
import os
import socket
import threading
import struct
from datetime import datetime
import psycopg

# Configuration
TCP_PORT = int(os.environ.get('TCP_PORT', 5055))
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    """Create a new database connection"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg.connect(DATABASE_URL)

def validate_imei(imei):
    """Check if IMEI exists in vehicle table and return vehicle_id"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM vehicles WHERE imei = %s",
                    (imei,)
                )
                result = cur.fetchone()
                if result:
                    return result[0]  # Return vehicle_id
                return None
    except Exception as e:
        print(f"❌ Database error validating IMEI: {e}")
        return None

def parse_avl_record(data, offset):
    """
    Parse a single AVL record from FMB003
    Returns: (parsed_data_dict, bytes_consumed)
    """
    try:
        start_offset = offset
        
        # Timestamp (8 bytes) - milliseconds since Unix epoch
        timestamp_ms = struct.unpack('>Q', data[offset:offset+8])[0]
        offset += 8
        timestamp = datetime.fromtimestamp(timestamp_ms / 1000.0)
        
        # Priority (1 byte)
        priority = data[offset]
        offset += 1
        
        # GPS Data
        longitude = struct.unpack('>i', data[offset:offset+4])[0] / 10000000.0
        offset += 4
        
        latitude = struct.unpack('>i', data[offset:offset+4])[0] / 10000000.0
        offset += 4
        
        altitude = struct.unpack('>h', data[offset:offset+2])[0]
        offset += 2
        
        angle = struct.unpack('>H', data[offset:offset+2])[0]
        offset += 2
        
        satellites = data[offset]
        offset += 1
        
        speed = struct.unpack('>H', data[offset:offset+2])[0]
        offset += 2
        
        # IO Elements
        event_io_id = data[offset]
        offset += 1
        
        total_io = data[offset]
        offset += 1
        
        # Skip IO elements for now (we can parse these later if needed)
        # 1-byte IO elements
        if offset < len(data):
            n1 = data[offset]
            offset += 1
            offset += n1 * 2  # Each element is 1 byte ID + 1 byte value
        
        # 2-byte IO elements
        if offset < len(data):
            n2 = data[offset]
            offset += 1
            offset += n2 * 3  # Each element is 1 byte ID + 2 byte value
        
        # 4-byte IO elements
        if offset < len(data):
            n4 = data[offset]
            offset += 1
            offset += n4 * 5  # Each element is 1 byte ID + 4 byte value
        
        # 8-byte IO elements
        if offset < len(data):
            n8 = data[offset]
            offset += 1
            offset += n8 * 9  # Each element is 1 byte ID + 8 byte value
        
        bytes_consumed = offset - start_offset
        
        return {
            'timestamp': timestamp,
            'latitude': latitude,
            'longitude': longitude,
            'altitude': altitude,
            'speed': speed,
            'angle': angle,
            'satellites': satellites,
            'priority': priority,
            'event_io_id': event_io_id
        }, bytes_consumed
        
    except Exception as e:
        print(f"❌ Error parsing AVL record: {e}")
        return None, 0

def store_telemetry(vehicle_id, telemetry_data):
    """Store telemetry data in database"""
    try:
        print("\n" + "="*70)
        print("💾 ATTEMPTING TO INSERT INTO DATABASE:")
        print("="*70)
        print(f"vehicle_id      = {vehicle_id} (type: {type(vehicle_id)})")
        print(f"timestamp       = {telemetry_data['timestamp']} (type: {type(telemetry_data['timestamp'])})")
        print(f"latitude        = {telemetry_data['latitude']} (type: {type(telemetry_data['latitude'])})")
        print(f"longitude       = {telemetry_data['longitude']} (type: {type(telemetry_data['longitude'])})")
        print(f"altitude        = {telemetry_data['altitude']} (type: {type(telemetry_data['altitude'])})")
        print(f"speed           = {telemetry_data['speed']} (type: {type(telemetry_data['speed'])})")
        print(f"angle           = {telemetry_data['angle']} (type: {type(telemetry_data['angle'])})")
        print(f"satellites      = {telemetry_data['satellites']} (type: {type(telemetry_data['satellites'])})")
        print("="*70)
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # NOTE: Your schema has 'received_at' NOT 'created_at'
                # Also removed priority and event_io_id since they're not in your schema
                query = """
                    INSERT INTO telemetry (
                        vehicle_id,
                        timestamp,
                        latitude,
                        longitude,
                        altitude,
                        speed,
                        angle,
                        satellites,
                        received_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                
                values = (
                    vehicle_id,
                    telemetry_data['timestamp'],
                    telemetry_data['latitude'],
                    telemetry_data['longitude'],
                    telemetry_data['altitude'],
                    telemetry_data['speed'],
                    telemetry_data['angle'],
                    telemetry_data['satellites']
                )
                
                print(f"SQL Query: {query}")
                print(f"Values: {values}")
                print("="*70)
                
                cur.execute(query, values)
                conn.commit()
                
                print("✅ DATABASE INSERT SUCCESSFUL!")
                print("="*70 + "\n")
                return True
                
    except Exception as e:
        print(f"\n❌ DATABASE ERROR:")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {e}")
        import traceback
        traceback.print_exc()
        print("="*70 + "\n")
        return False

def handle_client(client_socket, addr):
    print(f"🔌 Device connected: {addr}")
    
    imei = None
    vehicle_id = None
    buffer = b''
    
    try:
        while True:
            data = client_socket.recv(1024)
            if not data:
                break
            
            buffer += data
            print(f"📥 Received {len(data)} bytes")
            
            # PHASE 1: IMEI Handshake
            if imei is None:
                if len(buffer) >= 2:
                    imei_len = int.from_bytes(buffer[0:2], 'big')
                    print(f"📏 IMEI length: {imei_len}")
                    
                    if len(buffer) >= 2 + imei_len:
                        imei = buffer[2:2+imei_len].decode('utf-8')
                        print(f"📱 IMEI: {imei}")
                        
                        # Validate IMEI against database
                        vehicle_id = validate_imei(imei)
                        
                        if vehicle_id:
                            print(f"✅ IMEI validated - Vehicle ID: {vehicle_id}")
                            buffer = buffer[2+imei_len:]
                            client_socket.send(b'\x01')
                            print(f"✅ Sent IMEI ACK")
                        else:
                            print(f"❌ IMEI not found in database: {imei}")
                            client_socket.send(b'\x00')
                            print(f"❌ Sent IMEI REJECT")
                            client_socket.close()
                            return
                        continue
            
            # PHASE 2: Parse and store AVL data
            while len(buffer) >= 12:
                # Check for preamble (4 zero bytes)
                preamble = int.from_bytes(buffer[0:4], 'big')
                if preamble != 0:
                    buffer = buffer[1:]
                    continue
                
                # Get data length
                data_length = int.from_bytes(buffer[4:8], 'big')
                total_packet_size = 8 + data_length + 4
                
                print(f"📦 Packet size: {total_packet_size} bytes (data: {data_length})")
                
                if len(buffer) < total_packet_size:
                    print(f"⏳ Waiting for more data...")
                    break
                
                # Extract packet
                packet = buffer[:total_packet_size]
                
                # Parse AVL data
                codec_id = packet[8]
                num_records = packet[9]
                
                print(f"📊 Codec ID: {codec_id}, Records: {num_records}")
                
                if codec_id == 0x08 or codec_id == 142:  # Codec 8 or Codec 8 Extended (0x8E)
                    offset = 10  # Start after codec_id and num_records
                    records_stored = 0
                    
                    print(f"🔧 Processing {'Codec 8 Extended' if codec_id == 142 else 'Codec 8'}")
                    
                    for i in range(num_records):
                        telemetry_data, bytes_consumed = parse_avl_record(packet, offset)
                        
                        if telemetry_data:
                            print(f"📍 Record {i+1}: Lat={telemetry_data['latitude']:.6f}, "
                                  f"Lon={telemetry_data['longitude']:.6f}, "
                                  f"Speed={telemetry_data['speed']} km/h, "
                                  f"Sats={telemetry_data['satellites']}")
                            
                            # Store in database
                            if store_telemetry(vehicle_id, telemetry_data):
                                records_stored += 1
                                print(f"💾 Stored record {i+1} to database")
                            else:
                                print(f"❌ Failed to store record {i+1}")
                            
                            offset += bytes_consumed
                        else:
                            print(f"❌ Failed to parse record {i+1}")
                            break
                    
                    print(f"✅ Successfully stored {records_stored}/{num_records} records")
                    
                    # Send ACK with number of records accepted
                    ack = num_records.to_bytes(4, 'big')
                    client_socket.sendall(ack)
                    print(f"✅ Sent ACK: {num_records} records")
                else:
                    print(f"⚠️ Unsupported codec: {codec_id}")
                    # Still send ACK
                    ack = num_records.to_bytes(4, 'big')
                    client_socket.sendall(ack)
                    print(f"✅ Sent ACK: {num_records} records (unsupported codec)")
                
                buffer = buffer[total_packet_size:]
                print(f"🔄 Buffer remaining: {len(buffer)} bytes\n")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client_socket.close()
        print(f"❌ Disconnected: {addr}")

def run_server():
    # Test database connection
    try:
        with get_db_connection() as conn:
            print("✅ Database connection successful")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("⚠️  Server will start but data won't be stored")
    
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', TCP_PORT))
    server.listen(5)
    print(f"🚀 TCP server listening on 0.0.0.0:{TCP_PORT}")
    print(f"📢 Validating IMEIs and storing telemetry to database")
    
    try:
        while True:
            client_socket, addr = server.accept()
            thread = threading.Thread(target=handle_client, args=(client_socket, addr))
            thread.daemon = True
            thread.start()
    except KeyboardInterrupt:
        print("\n⏹️ Shutting down...")
    finally:
        server.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 FMB003 TCP SERVER WITH DATABASE STORAGE")
    print("=" * 60)
    print(f"📡 Port: {TCP_PORT}")
    print(f"🗄️  Database: {'Configured' if DATABASE_URL else 'NOT CONFIGURED'}")
    print("=" * 60)
    run_server()
