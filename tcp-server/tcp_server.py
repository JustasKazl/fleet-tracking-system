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
import json
import psycopg

# Configuration
TCP_PORT = int(os.environ.get('PORT', 5055))
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
                    return result[0]
                return None
    except Exception as e:
        print(f"❌ Database error validating IMEI: {e}")
        return None

def parse_codec8_packet(buffer):
    """Parse Teltonika Codec 8 packet"""
    if len(buffer) < 12:
        return None
    
    offset = 0
    
    # Check preamble (4 bytes of 0x00)
    preamble = int.from_bytes(buffer[0:4], 'big')
    if preamble != 0:
        return None
    offset += 4
    
    # Data length (4 bytes)
    data_length = int.from_bytes(buffer[4:8], 'big')
    if len(buffer) < 8 + data_length + 4:
        return None
    offset += 4
    
    # Codec ID (1 byte, should be 0x08 for Codec 8)
    codec_id = buffer[offset]
    if codec_id != 0x08:
        return None
    offset += 1
    
    # Number of records
    num_records = buffer[offset]
    offset += 1
    
    records = []
    
    for _ in range(num_records):
        if offset + 26 > len(buffer):
            break
        
        # Timestamp (8 bytes)
        timestamp_ms = int.from_bytes(buffer[offset:offset+8], 'big')
        offset += 8
        
        # Priority (1 byte)
        priority = buffer[offset]
        offset += 1
        
        # GPS element (15 bytes)
        lon_raw = int.from_bytes(buffer[offset:offset+4], 'big', signed=True)
        longitude = lon_raw / 10000000.0
        offset += 4
        
        lat_raw = int.from_bytes(buffer[offset:offset+4], 'big', signed=True)
        latitude = lat_raw / 10000000.0
        offset += 4
        
        altitude = int.from_bytes(buffer[offset:offset+2], 'big', signed=True)
        offset += 2
        
        angle = int.from_bytes(buffer[offset:offset+2], 'big')
        offset += 2
        
        satellites = buffer[offset]
        offset += 1
        
        speed = int.from_bytes(buffer[offset:offset+2], 'big')
        offset += 2
        
        # IO Elements
        event_id = buffer[offset]
        offset += 1
        
        io_elements = {}
        n_total = buffer[offset]
        offset += 1
        
        # 1-byte elements
        n1 = buffer[offset]
        offset += 1
        for _ in range(n1):
            io_id = buffer[offset]
            io_val = buffer[offset + 1]
            io_elements[io_id] = io_val
            offset += 2
        
        # 2-byte elements
        n2 = buffer[offset]
        offset += 1
        for _ in range(n2):
            io_id = buffer[offset]
            io_val = int.from_bytes(buffer[offset+1:offset+3], 'big')
            io_elements[io_id] = io_val
            offset += 3
        
        # 4-byte elements
        n4 = buffer[offset]
        offset += 1
        for _ in range(n4):
            io_id = buffer[offset]
            io_val = int.from_bytes(buffer[offset+1:offset+5], 'big')
            io_elements[io_id] = io_val
            offset += 5
        
        # 8-byte elements
        n8 = buffer[offset]
        offset += 1
        for _ in range(n8):
            io_id = buffer[offset]
            io_val = int.from_bytes(buffer[offset+1:offset+9], 'big')
            io_elements[io_id] = io_val
            offset += 9
        
        records.append({
            'timestamp': datetime.utcfromtimestamp(timestamp_ms / 1000.0),
            'latitude': latitude,
            'longitude': longitude,
            'altitude': altitude,
            'angle': angle,
            'satellites': satellites,
            'speed': speed,
            'priority': priority,
            'event_id': event_id,
            'io_elements': io_elements
        })
    
    return records

def store_telemetry(vehicle_id, records):
    """Store telemetry records in database"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Insert telemetry records
                for record in records:
                    # FIXED: Using correct column names from your schema
                    cur.execute("""
                        INSERT INTO telemetry 
                        (vehicle_id, timestamp, latitude, longitude, altitude, angle, satellites, speed, io_elements, received_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        vehicle_id,
                        record['timestamp'],
                        record['latitude'],
                        record['longitude'],
                        record['altitude'],
                        record['angle'],
                        record['satellites'],
                        record['speed'],
                        json.dumps(record['io_elements'])
                    ))
                
                # Update vehicle status
                cur.execute(
                    "UPDATE vehicles SET status = %s WHERE id = %s",
                    ('online', vehicle_id)
                )
                
                conn.commit()
                print(f"✅ Stored {len(records)} telemetry records for vehicle {vehicle_id}")
                return True
    except Exception as e:
        print(f"❌ Error storing telemetry: {e}")
        import traceback
        traceback.print_exc()
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
            
            # PHASE 1: IMEI Handshake
            if imei is None:
                if len(buffer) >= 2:
                    imei_len = int.from_bytes(buffer[0:2], 'big')
                    print(f"📏 IMEI length: {imei_len}")
                    
                    if len(buffer) >= 2 + imei_len:
                        imei = buffer[2:2+imei_len].decode('utf-8')
                        print(f"📱 IMEI received: {imei}")
                        
                        # Validate IMEI
                        vehicle_id = validate_imei(imei)
                        
                        # Remove IMEI from buffer
                        buffer = buffer[2+imei_len:]
                        
                        if vehicle_id:
                            # Send ACK (0x01 = accepted)
                            client_socket.send(b'\x01')
                            print(f"✅ IMEI validated - Vehicle ID: {vehicle_id}")
                        else:
                            # Send REJECT (0x00 = rejected)
                            client_socket.send(b'\x00')
                            print(f"❌ IMEI not found: {imei}")
                            client_socket.close()
                            return
                        continue
            
            # PHASE 2: Codec 8 packets
            while len(buffer) >= 12:  # Minimum packet size
                # Check preamble (4 bytes of 0x00)
                preamble = int.from_bytes(buffer[0:4], 'big')
                if preamble != 0:
                    print(f"❌ Invalid preamble: {hex(preamble)}")
                    buffer = buffer[1:]  # Skip one byte and try again
                    continue
                
                # Get data length
                data_length = int.from_bytes(buffer[4:8], 'big')
                total_packet_size = 8 + data_length + 4  # preamble + length + data + crc
                
                print(f"📦 Packet size: {total_packet_size} bytes (data: {data_length})")
                
                # Check if we have the complete packet
                if len(buffer) < total_packet_size:
                    print(f"⏳ Waiting for more data... (have {len(buffer)}, need {total_packet_size})")
                    break
                
                # Extract packet
                packet = buffer[:total_packet_size]
                
                # Parse the packet
                records = parse_codec8_packet(packet)
                
                if records:
                    print(f"✅ Parsed {len(records)} records")
                    
                    # Store in database
                    if store_telemetry(vehicle_id, records):
                        # Send ACK (number of records accepted)
                        ack = len(records).to_bytes(4, 'big')
                        client_socket.send(ack)
                        print(f"📤 Sent ACK: {len(records)} records")
                    else:
                        # Send rejection
                        client_socket.send(b'\x00\x00\x00\x00')
                        print(f"❌ Sent rejection (storage failed)")
                else:
                    print(f"❌ Failed to parse packet")
                    # Send rejection
                    client_socket.send(b'\x00\x00\x00\x00')
                
                # Remove processed packet from buffer
                buffer = buffer[total_packet_size:]
                print(f"🔄 Buffer remaining: {len(buffer)} bytes\n")
    
    except Exception as e:
        print(f"❌ Error handling client {addr}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client_socket.close()
        print(f"❌ Device disconnected: {addr}\n")

def run_server():
    # Test database connection
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM vehicles")
                count = cur.fetchone()[0]
                print(f"✅ Database connected - {count} vehicles registered")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("⚠️  Server will start but won't be able to store data")
    
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', TCP_PORT))
    server.listen(5)
    print(f"🚀 TCP server listening on 0.0.0.0:{TCP_PORT}")
    
    try:
        while True:
            client_socket, addr = server.accept()
            thread = threading.Thread(target=handle_client, args=(client_socket, addr))
            thread.daemon = True
            thread.start()
    except KeyboardInterrupt:
        print("\n⏹️ Shutting down...")
    except Exception as e:
        print(f"❌ Server error: {e}")
    finally:
        server.close()

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 FMB003 TCP SERVER WITH DATABASE STORAGE")
    print("=" * 70)
    print(f"📡 Port: {TCP_PORT}")
    print(f"🗄️  Database: {'Configured' if DATABASE_URL else 'NOT CONFIGURED'}")
    print("=" * 70)
    print()
    run_server()
