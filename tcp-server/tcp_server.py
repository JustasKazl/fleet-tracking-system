#!/usr/bin/env python3
"""
TCP Server for FMB003 GPS Tracker - OPTIMIZED VERSION
- Validates IMEI against vehicle table
- Parses AVL data packets
- Stores telemetry ONLY when significant movement/change detected
- Prevents database bloat from stationary vehicles
"""
import os
import socket
import threading
import struct
from datetime import datetime, timedelta
import psycopg
import math

# Configuration
TCP_PORT = int(os.environ.get('TCP_PORT', 5055))
DATABASE_URL = os.environ.get('DATABASE_URL')

# ═══════════════════════════════════════════════════════════════
# TELEMETRY FILTERING THRESHOLDS
# ═══════════════════════════════════════════════════════════════

# Minimum distance change to trigger save (meters)
MIN_DISTANCE_METERS = float(os.environ.get('MIN_DISTANCE_METERS', '50'))

# Minimum speed to consider as "moving" (km/h)
MIN_SPEED_KMH = float(os.environ.get('MIN_SPEED_KMH', '5'))

# Minimum time interval between saves when stationary (seconds)
MIN_TIME_INTERVAL_STATIONARY = int(os.environ.get('MIN_TIME_INTERVAL_STATIONARY', '300'))  # 5 minutes

# Minimum time interval between saves when moving (seconds)
MIN_TIME_INTERVAL_MOVING = int(os.environ.get('MIN_TIME_INTERVAL_MOVING', '10'))  # 10 seconds

# Maximum time without a save (force save regardless of movement)
MAX_TIME_WITHOUT_SAVE = int(os.environ.get('MAX_TIME_WITHOUT_SAVE', '3600'))  # 1 hour

# Cache to store last saved telemetry per vehicle
last_saved_telemetry = {}  # {vehicle_id: {data, timestamp}}

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

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in meters
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in meters
    r = 6371000
    
    return c * r

def should_save_telemetry(vehicle_id, telemetry_data):
    """
    Determine if telemetry should be saved based on intelligent filtering
    
    Returns: (should_save: bool, reason: str)
    """
    current_time = datetime.now()
    
    # Always save first telemetry for this vehicle
    if vehicle_id not in last_saved_telemetry:
        return True, "First telemetry record"
    
    last_data = last_saved_telemetry[vehicle_id]['data']
    last_saved_time = last_saved_telemetry[vehicle_id]['timestamp']
    
    # Calculate time since last save
    time_since_last_save = (current_time - last_saved_time).total_seconds()
    
    # RULE 1: Force save if too much time has passed (keep alive)
    if time_since_last_save >= MAX_TIME_WITHOUT_SAVE:
        return True, f"Max time reached ({time_since_last_save:.0f}s)"
    
    # Calculate distance moved
    distance_meters = haversine_distance(
        last_data['latitude'], last_data['longitude'],
        telemetry_data['latitude'], telemetry_data['longitude']
    )
    
    current_speed = telemetry_data['speed']
    is_moving = current_speed >= MIN_SPEED_KMH
    
    # RULE 2: Significant distance change
    if distance_meters >= MIN_DISTANCE_METERS:
        return True, f"Distance: {distance_meters:.1f}m (threshold: {MIN_DISTANCE_METERS}m)"
    
    # RULE 3: Moving vehicle - save at shorter intervals
    if is_moving and time_since_last_save >= MIN_TIME_INTERVAL_MOVING:
        return True, f"Moving: {current_speed}km/h, interval: {time_since_last_save:.0f}s"
    
    # RULE 4: Stationary vehicle - save at longer intervals
    if not is_moving and time_since_last_save >= MIN_TIME_INTERVAL_STATIONARY:
        return True, f"Stationary check-in: {time_since_last_save:.0f}s"
    
    # RULE 5: Significant speed change (started/stopped moving)
    last_speed = last_data.get('speed', 0)
    speed_change = abs(current_speed - last_speed)
    if speed_change >= MIN_SPEED_KMH:
        return True, f"Speed change: {last_speed}→{current_speed}km/h"
    
    # RULE 6: Significant direction change (>30 degrees) while moving
    if is_moving:
        last_angle = last_data.get('angle', 0)
        current_angle = telemetry_data['angle']
        angle_diff = abs(current_angle - last_angle)
        # Handle angle wrapping (359° -> 1° = 2° difference, not 358°)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        if angle_diff >= 30:
            return True, f"Direction change: {angle_diff:.0f}°"
    
    # RULE 7: Satellite count change (GPS quality indicator)
    last_sats = last_data.get('satellites', 0)
    current_sats = telemetry_data['satellites']
    if abs(current_sats - last_sats) >= 3:
        return True, f"GPS quality change: {last_sats}→{current_sats} sats"
    
    # If none of the rules triggered, don't save (filter out)
    return False, f"Filtered: {distance_meters:.1f}m, {current_speed}km/h, {time_since_last_save:.0f}s"

def update_vehicle_status(vehicle_id, telemetry_data):
    """
    Update vehicle's last_seen timestamp and status in vehicles table
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Determine status based on speed and time
                status = 'online'  # Default
                if telemetry_data['speed'] < 1:
                    status = 'offline'  # Stationary
                elif telemetry_data['speed'] < MIN_SPEED_KMH:
                    status = 'warning'  # Very slow
                
                # Update last_seen, status, and latest coordinates
                cur.execute("""
                    UPDATE vehicles 
                    SET last_seen = %s,
                        status = %s,
                        last_latitude = %s,
                        last_longitude = %s
                    WHERE id = %s
                """, (
                    telemetry_data['timestamp'],
                    status,
                    telemetry_data['latitude'],
                    telemetry_data['longitude'],
                    vehicle_id
                ))
                conn.commit()
                return True
    except Exception as e:
        print(f"⚠️  Failed to update vehicle status: {e}")
        return False

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
    """
    Store telemetry data in database with intelligent filtering
    Returns: (stored: bool, reason: str)
    """
    try:
        # Check if we should save this telemetry
        should_save, reason = should_save_telemetry(vehicle_id, telemetry_data)
        
        if not should_save:
            print(f"⏭️  SKIPPED: {reason}")
            # Still update vehicle status even if not saving telemetry
            update_vehicle_status(vehicle_id, telemetry_data)
            return False, reason
        
        # Save to database
        print("\n" + "="*70)
        print(f"💾 SAVING TO DATABASE: {reason}")
        print("="*70)
        print(f"vehicle_id      = {vehicle_id}")
        print(f"timestamp       = {telemetry_data['timestamp']}")
        print(f"latitude        = {telemetry_data['latitude']:.6f}")
        print(f"longitude       = {telemetry_data['longitude']:.6f}")
        print(f"speed           = {telemetry_data['speed']} km/h")
        print(f"angle           = {telemetry_data['angle']}°")
        print(f"satellites      = {telemetry_data['satellites']}")
        print("="*70)
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
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
                
                cur.execute(query, values)
                conn.commit()
                
                print("✅ DATABASE INSERT SUCCESSFUL!")
                print("="*70 + "\n")
                
                # Update cache with latest saved telemetry
                last_saved_telemetry[vehicle_id] = {
                    'data': telemetry_data.copy(),
                    'timestamp': datetime.now()
                }
                
                # Update vehicle status
                update_vehicle_status(vehicle_id, telemetry_data)
                
                return True, reason
                
    except Exception as e:
        print(f"\n❌ DATABASE ERROR:")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {e}")
        import traceback
        traceback.print_exc()
        print("="*70 + "\n")
        return False, f"Database error: {e}"

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
                    records_processed = 0
                    records_saved = 0
                    records_filtered = 0
                    
                    print(f"🔧 Processing {'Codec 8 Extended' if codec_id == 142 else 'Codec 8'}")
                    
                    for i in range(num_records):
                        telemetry_data, bytes_consumed = parse_avl_record(packet, offset)
                        
                        if telemetry_data:
                            print(f"📍 Record {i+1}/{num_records}: Lat={telemetry_data['latitude']:.6f}, "
                                  f"Lon={telemetry_data['longitude']:.6f}, "
                                  f"Speed={telemetry_data['speed']} km/h, "
                                  f"Sats={telemetry_data['satellites']}")
                            
                            # Store in database (with intelligent filtering)
                            stored, reason = store_telemetry(vehicle_id, telemetry_data)
                            
                            records_processed += 1
                            if stored:
                                records_saved += 1
                            else:
                                records_filtered += 1
                            
                            offset += bytes_consumed
                        else:
                            print(f"❌ Failed to parse record {i+1}")
                            break
                    
                    print(f"\n📊 SUMMARY:")
                    print(f"   Total received: {num_records}")
                    print(f"   ✅ Saved: {records_saved}")
                    print(f"   ⏭️  Filtered: {records_filtered}")
                    print(f"   💾 Database writes avoided: {records_filtered}")
                    
                    # Send ACK with number of records accepted
                    ack = num_records.to_bytes(4, 'big')
                    client_socket.sendall(ack)
                    print(f"✅ Sent ACK: {num_records} records\n")
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
    print("=" * 70)
    print("🚀 FMB003 TCP SERVER - OPTIMIZED WITH SMART FILTERING")
    print("=" * 70)
    print(f"📡 Port: {TCP_PORT}")
    print(f"🗄️  Database: {'Configured' if DATABASE_URL else 'NOT CONFIGURED'}")
    print(f"📊 Filtering thresholds:")
    print(f"   • Min distance: {MIN_DISTANCE_METERS}m")
    print(f"   • Min speed (moving): {MIN_SPEED_KMH} km/h")
    print(f"   • Min interval (moving): {MIN_TIME_INTERVAL_MOVING}s")
    print(f"   • Min interval (stationary): {MIN_TIME_INTERVAL_STATIONARY}s")
    print(f"   • Max time without save: {MAX_TIME_WITHOUT_SAVE}s")
    print("=" * 70)
    run_server()
