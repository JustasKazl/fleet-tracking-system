#!/usr/bin/env python3
"""
TCP Server for Teltonika FMB003
- IMEI validation
- Codec 8 / 8E parsing
- Intelligent telemetry filtering
- OBD-II data extraction from IO elements
"""

import os
import socket
import threading
import struct
from datetime import datetime
import psycopg
import math
import json

# ================= CONFIG =================

TCP_PORT = int(os.environ.get('TCP_PORT', 5055))
DATABASE_URL = os.environ.get('DATABASE_URL')

MIN_DISTANCE_METERS = 50
MIN_SPEED_KMH = 5
MIN_TIME_INTERVAL_STATIONARY = 300
MIN_TIME_INTERVAL_MOVING = 10
MAX_TIME_WITHOUT_SAVE = 3600

last_saved_telemetry = {}

# ================= OBD-II IO MAP =================
# NOTE: IO IDs depend on Teltonika configuration
OBD_IO_MAP = {
    0x0C: ('rpm', lambda v: round(v / 4)),          # Engine RPM
    0x05: ('coolant_temp', lambda v: v - 40),       # °C
    0x2F: ('fuel_level', lambda v: round(v * 100 / 255)),  # %
    0x01: ('dtc_status', lambda v: v),               # MIL / DTC status
}

# ================= DB =================

def get_db():
    return psycopg.connect(DATABASE_URL)

def validate_imei(imei):
    with get_db() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM vehicles WHERE imei = %s", (imei,))
        r = cur.fetchone()
        return r[0] if r else None

# ================= GEO =================

def haversine(lat1, lon1, lat2, lon2):
    r = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * r * math.asin(math.sqrt(a))

# ================= FILTER =================

def should_save(vehicle_id, data):
    now = datetime.utcnow()

    if vehicle_id not in last_saved_telemetry:
        return True

    last = last_saved_telemetry[vehicle_id]
    elapsed = (now - last['time']).total_seconds()
    dist = haversine(
        last['data']['latitude'], last['data']['longitude'],
        data['latitude'], data['longitude']
    )

    if elapsed >= MAX_TIME_WITHOUT_SAVE:
        return True
    if dist >= MIN_DISTANCE_METERS:
        return True
    if data['speed'] >= MIN_SPEED_KMH and elapsed >= MIN_TIME_INTERVAL_MOVING:
        return True
    if data['speed'] < MIN_SPEED_KMH and elapsed >= MIN_TIME_INTERVAL_STATIONARY:
        return True

    return False

# ================= IO PARSING =================

def parse_io_elements(buf, offset):
    io = {}
    buf_len = len(buf)

    def can_read(n):
        return offset + n <= buf_len

    # 1-byte IO
    if not can_read(1):
        return io, offset
    n1 = buf[offset]
    offset += 1

    for _ in range(n1):
        if not can_read(2):
            return io, offset
        io_id = buf[offset]
        io_value = buf[offset + 1]
        io[io_id] = io_value
        offset += 2

    # 2-byte IO
    if not can_read(1):
        return io, offset
    n2 = buf[offset]
    offset += 1

    for _ in range(n2):
        if not can_read(3):
            return io, offset
        io_id = buf[offset]
        io_value = struct.unpack('>H', buf[offset + 1:offset + 3])[0]
        io[io_id] = io_value
        offset += 3

    # 4-byte IO
    if not can_read(1):
        return io, offset
    n4 = buf[offset]
    offset += 1

    for _ in range(n4):
        if not can_read(5):
            return io, offset
        io_id = buf[offset]
        io_value = struct.unpack('>I', buf[offset + 1:offset + 5])[0]
        io[io_id] = io_value
        offset += 5

    # 8-byte IO
    if not can_read(1):
        return io, offset
    n8 = buf[offset]
    offset += 1

    for _ in range(n8):
        if not can_read(9):
            return io, offset
        io_id = buf[offset]
        io_value = struct.unpack('>Q', buf[offset + 1:offset + 9])[0]
        io[io_id] = io_value
        offset += 9

    return io, offset

def extract_obd(io):
    obd = {}
    for io_id, val in io.items():
        if io_id in OBD_IO_MAP:
            name, fn = OBD_IO_MAP[io_id]
            obd[name] = fn(val)
    return obd

# ================= AVL PARSING =================

def parse_avl(buf, offset):
    buf_len = len(buf)

    # 1. Check if we can read timestamp + priority + GPS (minimum 26 bytes)
    if offset + 26 > buf_len:
        return None, offset

    ts_raw = buf[offset:offset+8]
    ts = struct.unpack('>Q', ts_raw)[0]
    offset += 8

    # Validate timestamp (ms since epoch)
    ts_seconds = ts / 1000
    if ts_seconds < 946684800 or ts_seconds > 4102444800:
        # < 2000-01-01 or > 2100-01-01 → invalid
        return None, offset

    timestamp = datetime.utcfromtimestamp(ts_seconds)


# ================= STORAGE =================

def store(vehicle_id, data):
    if not should_save(vehicle_id, data):
        return

    with get_db() as conn, conn.cursor() as cur:
        cur.execute("""
            INSERT INTO telemetry (
                vehicle_id, timestamp, latitude, longitude,
                altitude, speed, angle, satellites, io_elements, received_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        """, (
            vehicle_id,
            data['timestamp'],
            data['latitude'],
            data['longitude'],
            data['altitude'],
            data['speed'],
            data['angle'],
            data['satellites'],
            json.dumps(data['obd'])
        ))
        conn.commit()

    last_saved_telemetry[vehicle_id] = {
        'data': data,
        'time': datetime.utcnow()
    }

# ================= CLIENT =================

def handle_client(sock, addr):
    buffer = b''
    imei = None
    vehicle_id = None

    while True:
        data = sock.recv(1024)
        if not data:
            break
        buffer += data

        if imei is None and len(buffer) >= 2:
            l = int.from_bytes(buffer[:2], 'big')
            if len(buffer) >= 2 + l:
                imei = buffer[2:2+l].decode()
                vehicle_id = validate_imei(imei)
                sock.send(b'\x01' if vehicle_id else b'\x00')
                buffer = buffer[2+l:]
                if not vehicle_id:
                    return

        while len(buffer) >= 12:
            if int.from_bytes(buffer[:4], 'big') != 0:
                buffer = buffer[1:]
                continue

            size = int.from_bytes(buffer[4:8], 'big')
            packet = buffer[:8 + size + 4]

            codec = packet[8]
            count = packet[9]
            offset = 10

            for _ in range(count):
                parsed, offset = parse_avl(packet, offset)
                if parsed is None:
                    continue
                store(vehicle_id, parsed)

            sock.sendall(count.to_bytes(4, 'big'))
            buffer = buffer[8 + size + 4:]

    sock.close()

# ================= SERVER =================

def run():
    s = socket.socket()
    s.bind(('0.0.0.0', TCP_PORT))
    s.listen(5)
    print(f"🚀 TCP server listening on {TCP_PORT}")

    while True:
        c, a = s.accept()
        threading.Thread(target=handle_client, args=(c, a), daemon=True).start()

if __name__ == "__main__":
    run()
