#!/usr/bin/env python3
"""
Standalone TCP Server for Teltonika FMB003
This runs separately from the Flask web API
"""
import os
import socket
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg
import json

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
TCP_PORT = int(os.environ.get('TCP_PORT', 5055))

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL environment variable is not set!")

# ─────── DATABASE ───────

def get_db():
    try:
        conn = psycopg.connect(DATABASE_URL)
        return conn
    except psycopg.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        raise

# ─────── CODEC 8 PARSER ───────

def calculate_crc16(data):
    """Calculate CRC16 checksum for Codec 8"""
    crc = 0
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = crc << 1
            if crc & 0x10000:
                crc ^= 0x1021
    return crc & 0xFFFF

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

def store_telemetry(imei, records):
    """Store telemetry records in database"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Find vehicle by IMEI (primary device identifier)
        # Note: VIN is stored in database but not transmitted by FMB003
        print(f"🔍 Looking up vehicle with IMEI: {imei}")
        cur.execute("SELECT id, vin FROM vehicles WHERE imei = %s OR fmb_serial = %s", (imei, imei))
        result = cur.fetchone()
        
        print(f"🔍 Database query result: {result}")
        
        if not result:
            # Unauthorized/unknown device
            log_unknown_device(imei, None, records)
            print(f"❌ REJECTED: Unauthorized device IMEI: {imei}")
            cur.close()
            conn.close()
            return False
        
        vehicle_id = result[0]
        vin = result[1]
        print(f"✅ Authorized device IMEI: {imei} → Vehicle ID: {vehicle_id}, VIN: {vin}")
        
        # Insert telemetry records
        for record in records:
            cur.execute("""
                INSERT INTO telemetry 
                (vehicle_id, timestamp, latitude, longitude, altitude, angle, satellites, speed, io_elements)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
        
        cur.execute("UPDATE vehicles SET status = %s WHERE id = %s", ('online', vehicle_id))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ Stored {len(records)} telemetry records for vehicle {vehicle_id} (VIN: {vin})")
        return True
        
    except Exception as e:
        print(f"❌ Error storing telemetry: {e}")
        return False

def log_unknown_device(imei, vin, records):
    """Log unknown device attempts"""
    try:
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        
        # Print to Railway logs
        print(f"⚠️  UNKNOWN CONNECTION FROM IMEI: {imei} (VIN: {vin if vin else 'NOT PROVIDED'})")
        
        # Write simple log to persistent volume
        log_file = "/data/unknown_devices.log"
        with open(log_file, 'a') as f:
            f.write(f"{timestamp} - Unknown connection from IMEI {imei}\n")
        
    except Exception as e:
        print(f"⚠️ Failed to log unknown device: {e}")

# ─────── TCP SERVER ───────

def handle_client(client_socket, addr):
    print(f"🔌 Device connected: {addr}")
    
    imei = None
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
                        
                        buffer = buffer[2+imei_len:]
                        client_socket.send(b'\x01')
                        print(f"✅ IMEI handshake complete")
                        continue
            
            # PHASE 2: Codec 8 packets
            while len(buffer) >= 12:
                preamble = int.from_bytes(buffer[0:4], 'big')
                if preamble != 0:
                    print(f"❌ Invalid preamble: {hex(preamble)}")
                    buffer = buffer[1:]
                    continue
                
                data_length = int.from_bytes(buffer[4:8], 'big')
                total_packet_size = 8 + data_length + 4
                
                print(f"📦 Packet size: {total_packet_size} bytes")
                
                if len(buffer) < total_packet_size:
                    print(f"⏳ Waiting for more data...")
                    break
                
                packet = buffer[:total_packet_size]
                
                # Validate CRC
                received_crc = int.from_bytes(packet[-4:], 'big')
                calculated_crc = calculate_crc16(packet[8:-4])
                
                if received_crc != calculated_crc:
                    print(f"⚠️ CRC mismatch!")
                
                # Parse packet
                records = parse_codec8_packet(packet)
                
                if records:
                    print(f"✅ Parsed {len(records)} records from {imei}")
                    
                    if store_telemetry(imei, records):
                        ack = len(records).to_bytes(4, 'big')
                        client_socket.sendall(ack)  # sendall ensures full transmission
                        print(f"📤 Sent ACK: {len(records)} records")
                    else:
                        # Send NACK (0 records accepted - unknown device)
                        nack = b'\x00\x00\x00\x00'
                        client_socket.sendall(nack)  # sendall ensures full transmission
                        print(f"📤 Sent NACK: 0 records (unknown device - no VIN match)")
                        # Give device time to receive NACK before we process more data
                        import time
                        time.sleep(0.1)
                else:
                    print(f"❌ Failed to parse packet")
                    nack = b'\x00\x00\x00\x00'
                    client_socket.sendall(nack)  # sendall ensures full transmission
                    print(f"📤 Sent NACK: parse failed")
                
                buffer = buffer[total_packet_size:]
                print(f"🔄 Buffer remaining: {len(buffer)} bytes")
    
    except Exception as e:
        print(f"❌ Error handling client {addr}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client_socket.close()
        print(f"❌ Device disconnected: {addr}")

def run_server():
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
        print("\n⏹️ Server shutting down...")
    except Exception as e:
        print(f"❌ Server error: {e}")
    finally:
        server.close()

# ─────── HTTP LOG VIEWER ───────

class LogViewerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/logs':
            try:
                # Read the log file
                with open('/data/unknown_devices.log', 'r') as f:
                    content = f.read()
                
                # Return as plain text
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.end_headers()
                
                if content:
                    self.wfile.write(content.encode())
                else:
                    self.wfile.write(b'No unknown devices logged yet.')
                    
            except FileNotFoundError:
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'No unknown devices logged yet.')
                
        elif self.path == '/':
            # Show info page
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <html>
            <head><title>TCP Server Logs</title></head>
            <body style="font-family: monospace; padding: 20px;">
                <h1>🚀 Teltonika TCP Server</h1>
                <p><a href="/logs">View Unknown Devices Log</a></p>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress HTTP request logs
        pass

def start_log_viewer():
    """Start HTTP server for viewing logs"""
    def run():
        server = HTTPServer(('0.0.0.0', 8080), LogViewerHandler)
        server.serve_forever()
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    print("📊 Log viewer available at http://<your-domain>:8080/logs")

# ─────── MAIN ───────

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 TELTONIKA TCP SERVER STARTUP")
    print("=" * 60)
    print(f"📡 Port: {TCP_PORT}")
    print(f"🗄️ Database: Connected")
    print("=" * 60)
    
    # Start HTTP log viewer
    start_log_viewer()
    
    # Start TCP server (blocks forever)
    run_server()
