from flask import Flask, request, jsonify, send_from_directory
import os
import time
import socket
import threading
from datetime import datetime, timedelta
from flask_cors import CORS
from werkzeug.utils import secure_filename
import psycopg2
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import json

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24
TCP_PORT = int(os.environ.get('TCP_PORT', 5055))

# Check if DATABASE_URL is set
if not DATABASE_URL:
    raise ValueError(
        "❌ DATABASE_URL environment variable is not set!\n"
        "Please add a PostgreSQL database to your Railway project."
    )

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}

app = Flask(__name__)

# ═══════════════════════════════════════════════════════════════
# PROPER CORS CONFIGURATION FOR RAILWAY
# ═══════════════════════════════════════════════════════════════

# Get frontend URL - adjust this to your actual frontend Railway URL
FRONTEND_URLS = [
    "https://fleet-tracking-system-production-2cd5.up.railway.app",  # Production frontend
    "http://localhost:3000",    # Local development
    "http://localhost:5173",    # Vite dev server
    "http://127.0.0.1:5173",
]

CORS(app,
    resources={
        r"/api/*": {
            "origins": FRONTEND_URLS,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
            "max_age": 7200  # 2 hours
        }
    },
    send_wildcard=False,
    vary_header=True
)

# ═══════════════════════════════════════════════════════════════
# HANDLE PREFLIGHT REQUESTS EXPLICITLY
# ═══════════════════════════════════════════════════════════════

@app.before_request
def handle_preflight():
    """Handle CORS preflight requests"""
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", request.headers.get("Origin", "*"))
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        response.headers.add("Access-Control-Max-Age", "7200")
        return response, 200

# ═════════════════════════════════════════════════════════════════

# ----------------------------- DB -----------------------------

def get_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ Database connection failed: {e}")
        print(f"DATABASE_URL starts with: {DATABASE_URL[:20] if DATABASE_URL else 'NOT SET'}...")
        raise

def init_db():
    """Initialize PostgreSQL database with tables"""
    conn = get_db()
    cur = conn.cursor()

    try:
        # Create users table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            company TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        print("✅ users table created/verified")

        # Create vehicles table with user_id foreign key
        cur.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            vin TEXT NOT NULL UNIQUE,
            brand TEXT,
            model TEXT,
            custom_name TEXT,
            plate TEXT,
            imei TEXT,
            fmb_serial TEXT,
            status TEXT DEFAULT 'unknown',
            total_km INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        print("✅ vehicles table created/verified")

        # Create telemetry table for GPS data from FMB003
        cur.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id BIGSERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            altitude INTEGER,
            angle INTEGER,
            satellites INTEGER,
            speed INTEGER,
            io_elements JSONB,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
        """)
        print("✅ telemetry table created/verified")

        # Create documents table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            title TEXT,
            file_path TEXT,
            valid_until TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
        """)
        print("✅ documents table created/verified")

        # Create service_records table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS service_records (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            service_type TEXT NOT NULL,
            performed_date TEXT NOT NULL,
            performed_km INTEGER NOT NULL,
            next_km INTEGER,
            next_date TEXT,
            location TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
        """)
        print("✅ service_records table created/verified")

        conn.commit()
        print("✅ All tables created successfully")

    except Exception as e:
        print(f"⚠️ Error during table creation: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()

def run_migrations():
    """Run database migrations to ensure schema is up to date"""
    conn = get_db()
    cur = conn.cursor()

    try:
        print("🔍 Checking if vehicles table needs user_id column...")
        
        # Check if user_id column exists in vehicles table
        cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'user_id'
        """)
        
        user_id_exists = cur.fetchone() is not None
        
        if not user_id_exists:
            print("❌ user_id column missing from vehicles table! Adding it now...")
            
            # Add user_id column
            cur.execute("ALTER TABLE vehicles ADD COLUMN user_id INTEGER;")
            print("✅ Added user_id column")
            
            # Assign existing vehicles to user 1
            cur.execute("UPDATE vehicles SET user_id = 1 WHERE user_id IS NULL;")
            print("✅ Assigned existing vehicles to user_id = 1")
            
            # Make user_id NOT NULL
            cur.execute("ALTER TABLE vehicles ALTER COLUMN user_id SET NOT NULL;")
            print("✅ Set user_id as NOT NULL")
            
            # Add foreign key constraint if it doesn't exist
            cur.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'vehicles' AND constraint_name = 'fk_vehicles_user_id'
            """)
            
            if not cur.fetchone():
                cur.execute("""
                ALTER TABLE vehicles 
                ADD CONSTRAINT fk_vehicles_user_id 
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
                """)
                print("✅ Added foreign key constraint")
            
            conn.commit()
            print("✅ Migration completed successfully!")
        else:
            print("✅ user_id column already exists in vehicles table")
            conn.commit()

    except Exception as e:
        print(f"❌ Migration error: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()

# ─────── TELTONIKA CODEC 8 PARSER ───────

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
        
        vehicle_id = None
        vin = None
        
        # Try to extract VIN from first record's IO elements (IO ID 40005 = OBD VIN)
        if records and records[0].get('io_elements'):
            vin = records[0]['io_elements'].get(40005)
            if vin:
                # VIN might be bytes, convert to string
                if isinstance(vin, bytes):
                    vin = vin.decode('utf-8', errors='ignore')
                print(f"📋 VIN detected from OBD: {vin}")
                
                # Find vehicle by VIN
                cur.execute("SELECT id FROM vehicles WHERE vin = %s", (str(vin),))
                result = cur.fetchone()
                if result:
                    vehicle_id = result[0]
                    print(f"✅ Found vehicle by VIN: {vehicle_id}")
        
        # Fallback: Find vehicle by IMEI if VIN not found
        if not vehicle_id:
            print(f"⚠️ VIN not found in telemetry, falling back to IMEI lookup")
            cur.execute("SELECT id FROM vehicles WHERE imei = %s OR fmb_serial = %s", (imei, imei))
            result = cur.fetchone()
            
            if result:
                vehicle_id = result[0]
                print(f"✅ Found vehicle by IMEI: {vehicle_id}")
        
        if not vehicle_id:
            print(f"❌ Vehicle not found for IMEI: {imei}, VIN: {vin}")
            cur.close()
            conn.close()
            return False
        
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
        
        # Update vehicle status
        cur.execute(
            "UPDATE vehicles SET status = %s WHERE id = %s",
            ('online', vehicle_id)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ Stored {len(records)} telemetry records for vehicle {vehicle_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error storing telemetry: {e}")
        return False

# ─────── TELTONIKA TCP SERVER ───────

def start_tcp_server():
    """Start TCP server to receive Teltonika data"""
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
                        if len(buffer) >= 2 + imei_len:
                            imei = buffer[2:2+imei_len].decode('utf-8')
                            buffer = buffer[2+imei_len:]
                            print(f"📱 IMEI: {imei}")
                            # Send ACK
                            client_socket.send(b'\x01')
                            continue
                
                # PHASE 2: Codec 8 packets
                while len(buffer) > 0:
                    records = parse_codec8_packet(buffer)
                    if not records:
                        break
                    
                    print(f"📦 Received {len(records)} records from {imei}")
                    
                    # Store in database
                    store_telemetry(imei, records)
                    
                    # Send ACK (4 bytes, big-endian count)
                    ack = len(records).to_bytes(4, 'big')
                    client_socket.send(ack)
                    
                    # Remove processed data
                    buffer = buffer[len(buffer):]  # Clear for next packet
        
        except Exception as e:
            print(f"❌ Error handling client: {e}")
        finally:
            client_socket.close()
            print(f"❌ Device disconnected: {addr}")
    
    def run_server():
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(('0.0.0.0', TCP_PORT))
        server.listen(5)
        print(f"🚀 TCP server listening on port {TCP_PORT}")
        
        try:
            while True:
                client_socket, addr = server.accept()
                thread = threading.Thread(target=handle_client, args=(client_socket, addr))
                thread.daemon = True
                thread.start()
        except Exception as e:
            print(f"❌ Server error: {e}")
        finally:
            server.close()
    
    # Start in background thread
    thread = threading.Thread(target=run_server)
    thread.daemon = True
    thread.start()

# ---------------------- HELPERS & MIDDLEWARE -----------------------

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_token(user_id, email):
    """Generate JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    """Verify JWT token and return user_id"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_auth_user():
    """Extract user_id from Authorization header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split(' ')[1]
        return verify_token(token)
    except (IndexError, AttributeError):
        return None

def require_auth(f):
    """Decorator to require authentication"""
    def decorated_function(*args, **kwargs):
        user_id = get_auth_user()
        if user_id is None:
            return jsonify({"error": "Unauthorized"}), 401
        return f(user_id, *args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# ---------------------- AUTH ROUTES ----------------------------

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.json
    
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    company = data.get("company", "")
    
    if not email or not password or not name:
        return jsonify({"error": "Email, password, and name are required"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    try:
        conn = get_db()
        cur = conn.cursor()
        
        password_hash = generate_password_hash(password)
        
        cur.execute("""
            INSERT INTO users (email, password_hash, name, company)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, name, company
        """, (email, password_hash, name, company))
        
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        token = generate_token(user[0], user[1])
        
        return jsonify({
            "ok": True,
            "token": token,
            "user": {
                "id": user[0],
                "email": user[1],
                "name": user[2],
                "company": user[3]
            }
        }), 201
        
    except psycopg2.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409
    except Exception as e:
        print(f"Register error: {e}")
        return jsonify({"error": "Registration failed"}), 500

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.json
    
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, email, password_hash, name, company
            FROM users WHERE email = %s
        """, (email,))
        
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({"error": "Invalid credentials"}), 401
        
        token = generate_token(user['id'], user['email'])
        
        return jsonify({
            "ok": True,
            "token": token,
            "user": {
                "id": user['id'],
                "email": user['email'],
                "name": user['name'],
                "company": user['company']
            }
        }), 200
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500

@app.route("/api/auth/me", methods=["GET"])
@require_auth
def api_get_user(user_id):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, email, name, company, created_at
            FROM users WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify(user), 200
        
    except Exception as e:
        print(f"Get user error: {e}")
        return jsonify({"error": "Failed to get user"}), 500

# ---------------------- API ROUTES ----------------------------

@app.route("/api/health")
def api_health():
    try:
        conn = get_db()
        conn.close()
        return jsonify({
            "status": "ok", 
            "time": datetime.utcnow().isoformat() + "Z",
            "database": "connected",
            "tcp_server": "running"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ======= TELEMETRY WEBHOOK (FMB-003 via HTTP POST) =========

@app.route("/api/telemetry/webhook", methods=["POST"])
def fmb_webhook():
    """
    Webhook for FMB003 to send GPS data via HTTP POST
    
    Expected JSON from FMB003:
    {
        "imei": "860123456789012",
        "latitude": 54.6872,
        "longitude": 25.2797,
        "altitude": 45,
        "angle": 180,
        "satellites": 12,
        "speed": 50,
        "timestamp": "2025-12-12T10:30:45Z"
    }
    """
    try:
        data = request.json
        print(f"📦 Received FMB data via webhook: {data}")
        
        # Extract IMEI
        imei = data.get("imei")
        if not imei:
            print("❌ No IMEI in webhook data")
            return jsonify({"error": "No IMEI provided"}), 400
        
        print(f"📱 IMEI: {imei}")
        
        # Get database connection
        conn = get_db()
        cur = conn.cursor()
        
        try:
            # Find vehicle by IMEI
            cur.execute("SELECT id FROM vehicles WHERE imei = %s OR fmb_serial = %s", (imei, imei))
            result = cur.fetchone()
            
            if not result:
                print(f"❌ Vehicle not found for IMEI: {imei}")
                cur.close()
                conn.close()
                return jsonify({"error": f"Vehicle not found for IMEI: {imei}"}), 404
            
            vehicle_id = result[0]
            print(f"✅ Found vehicle ID: {vehicle_id}")
            
            # Extract location data
            latitude = data.get("latitude")
            longitude = data.get("longitude")
            altitude = data.get("altitude", 0)
            angle = data.get("angle", 0)
            satellites = data.get("satellites", 0)
            speed = data.get("speed", 0)
            timestamp = data.get("timestamp")
            
            if not timestamp:
                timestamp = datetime.utcnow()
            else:
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    timestamp = datetime.utcnow()
            
            # Store in database
            cur.execute("""
                INSERT INTO telemetry 
                (vehicle_id, timestamp, latitude, longitude, altitude, angle, satellites, speed, io_elements)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                vehicle_id,
                timestamp,
                latitude,
                longitude,
                altitude,
                angle,
                satellites,
                speed,
                json.dumps(data.get("io_elements", {}))
            ))
            
            # Update vehicle status to online
            cur.execute(
                "UPDATE vehicles SET status = %s WHERE id = %s",
                ('online', vehicle_id)
            )
            
            conn.commit()
            cur.close()
            conn.close()
            
            print(f"✅ Stored telemetry for vehicle {vehicle_id}")
            print(f"📍 Location: {latitude}, {longitude}")
            print(f"🚗 Speed: {speed} km/h")
            
            return jsonify({
                "status": "ok",
                "vehicle_id": vehicle_id,
                "message": "Telemetry recorded"
            }), 200
            
        except Exception as e:
            print(f"❌ Error processing webhook: {e}")
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return jsonify({"error": str(e)}), 500

# ======= TELEMETRY FROM FMB-003 =========

@app.route("/api/telemetry/<imei>", methods=["GET"])
def get_telemetry(imei):
    """Get GPS data for a device"""
    try:
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Find vehicle by IMEI
        cur.execute("SELECT id FROM vehicles WHERE imei = %s OR fmb_serial = %s", (imei, imei))
        result = cur.fetchone()
        
        if not result:
            cur.close()
            conn.close()
            return jsonify({"error": "Vehicle not found"}), 404
        
        vehicle_id = result['id']
        
        # Get telemetry data
        cur.execute("""
            SELECT * FROM telemetry 
            WHERE vehicle_id = %s 
            ORDER BY timestamp DESC 
            LIMIT %s OFFSET %s
        """, (vehicle_id, limit, offset))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify(rows), 200
        
    except Exception as e:
        print(f"Get telemetry error: {e}")
        return jsonify({"error": "Failed to get telemetry"}), 500

@app.route("/api/track/<imei>", methods=["GET"])
def get_track(imei):
    """Get last 24 hours of track data for map visualization"""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Find vehicle by IMEI
        cur.execute("SELECT id FROM vehicles WHERE imei = %s OR fmb_serial = %s", (imei, imei))
        result = cur.fetchone()
        
        if not result:
            cur.close()
            conn.close()
            return jsonify({"error": "Vehicle not found"}), 404
        
        vehicle_id = result['id']
        
        # Get last 24 hours
        cur.execute("""
            SELECT timestamp, latitude, longitude, speed, satellites 
            FROM telemetry 
            WHERE vehicle_id = %s AND timestamp > NOW() - INTERVAL '24 hours'
            ORDER BY timestamp ASC
        """, (vehicle_id,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify(rows), 200
        
    except Exception as e:
        print(f"Get track error: {e}")
        return jsonify({"error": "Failed to get track"}), 500

# =============== VEHICLES ===============

@app.route("/api/vehicles", methods=["GET"])
@require_auth
def api_get_vehicles(user_id):
    """Get all vehicles for the authenticated user"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT * FROM vehicles WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route("/api/vehicles", methods=["POST"])
@require_auth
def api_add_vehicle(user_id):
    """Create a new vehicle for the authenticated user"""
    data = request.json
    print("Vehicle POST:", data)

    device_id = data.get("device_id")
    vin = data.get("vin")
    
    # Validate required fields
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400
    
    if not vin:
        return jsonify({"error": "VIN is required"}), 400
    
    # Validate VIN format (typically 17 characters)
    vin = vin.upper().strip()
    if len(vin) != 17:
        return jsonify({"error": "VIN must be 17 characters"}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("""
            INSERT INTO vehicles 
            (user_id, device_id, vin, brand, model, custom_name, plate, imei, fmb_serial, status, total_km)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            device_id,
            vin,
            data.get("brand", ""),
            data.get("model", ""),
            data.get("custom_name", ""),
            data.get("plate", ""),
            data.get("imei", ""),
            data.get("fmb_serial", ""),
            data.get("status", "unknown"),
            data.get("total_km", 0),
        ))

        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True, "id": new_id}), 201
    except psycopg2.IntegrityError as e:
        conn.rollback()
        cur.close()
        conn.close()
        if "vin" in str(e).lower():
            return jsonify({"error": "VIN already registered to another vehicle"}), 409
        return jsonify({"error": "Failed to create vehicle"}), 409
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error creating vehicle: {e}")
        return jsonify({"error": "Failed to create vehicle"}), 500

@app.route("/api/vehicles/<int:vehicle_id>", methods=["GET"])
@require_auth
def api_get_vehicle(user_id, vehicle_id):
    """Get a specific vehicle (only if it belongs to the user)"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT * FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    return jsonify(row)

@app.route("/api/vehicles/<int:vehicle_id>", methods=["PUT"])
@require_auth
def api_update_vehicle(user_id, vehicle_id):
    """Update a vehicle (only if it belongs to the user)"""
    data = request.json

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404

    try:
        cur.execute("""
            UPDATE vehicles
            SET brand = %s, model = %s, custom_name = %s, plate = %s, imei = %s, 
                fmb_serial = %s, status = %s, total_km = %s
            WHERE id = %s AND user_id = %s
        """, (
            data.get("brand"),
            data.get("model"),
            data.get("custom_name"),
            data.get("plate"),
            data.get("imei"),
            data.get("fmb_serial"),
            data.get("status", "offline"),
            data.get("total_km", 0),
            vehicle_id,
            user_id
        ))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error updating vehicle: {e}")
        return jsonify({"error": "Failed to update vehicle"}), 500

@app.route("/api/vehicles/<int:vehicle_id>", methods=["DELETE"])
@require_auth
def api_delete_vehicle(user_id, vehicle_id):
    """Delete a vehicle (only if it belongs to the user)"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404
    
    try:
        cur.execute(
            "DELETE FROM vehicles WHERE id = %s AND user_id = %s",
            (vehicle_id, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error deleting vehicle: {e}")
        return jsonify({"error": "Failed to delete vehicle"}), 500

# =============== DOCUMENT UPLOADS ===============

@app.route("/api/vehicles/<int:vehicle_id>/documents", methods=["POST"])
@require_auth
def upload_document(user_id, vehicle_id):
    """Upload a document for a vehicle (only if vehicle belongs to user)"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404

    doc_type = request.form.get("doc_type")
    title = request.form.get("title")
    valid_until = request.form.get("valid_until")
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "No file"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Leidžiami tik PDF, JPG, JPEG, PNG"}), 400

    try:
        ext = file.filename.rsplit(".", 1)[1].lower()
        filename = f"v{vehicle_id}_{int(time.time())}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        file.save(filepath)

        cur.execute("""
            INSERT INTO documents (vehicle_id, doc_type, title, file_path, valid_until)
            VALUES (%s, %s, %s, %s, %s)
        """, (vehicle_id, doc_type, title, filename, valid_until))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True, "file": filename})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error uploading document: {e}")
        return jsonify({"error": "Failed to upload document"}), 500

@app.route("/api/vehicles/<int:vehicle_id>/documents", methods=["GET"])
@require_auth
def list_documents(user_id, vehicle_id):
    """List documents for a vehicle (only if vehicle belongs to user)"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404
    
    cur.execute("""
        SELECT * FROM documents 
        WHERE vehicle_id = %s
        ORDER BY uploaded_at DESC
    """, (vehicle_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route("/api/documents/<int:doc_id>", methods=["DELETE"])
@require_auth
def delete_document(user_id, doc_id):
    """Delete a document (only if it belongs to user's vehicle)"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT d.id, d.file_path FROM documents d
        JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.id = %s AND v.user_id = %s
    """, (doc_id, user_id))
    row = cur.fetchone()

    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Document not found"}), 404

    try:
        try:
            os.remove(os.path.join(UPLOAD_FOLDER, row["file_path"]))
        except:
            pass

        cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error deleting document: {e}")
        return jsonify({"error": "Failed to delete document"}), 500

# =============== FILE SERVE ===============

@app.route("/uploads/<path:filename>")
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)

# =============== SERVICE RECORDS ===============

@app.route("/api/vehicles/<int:vehicle_id>/service", methods=["GET"])
@require_auth
def api_get_service_records(user_id, vehicle_id):
    """Get service records for a vehicle (only if vehicle belongs to user)"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404
    
    cur.execute("""
        SELECT * FROM service_records
        WHERE vehicle_id = %s
        ORDER BY performed_date DESC
    """, (vehicle_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows)

@app.route("/api/vehicles/<int:vehicle_id>/service", methods=["POST"])
@require_auth
def api_add_service_record(user_id, vehicle_id):
    """Add a service record for a vehicle (only if vehicle belongs to user)"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM vehicles WHERE id = %s AND user_id = %s",
        (vehicle_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Vehicle not found"}), 404

    data = request.json

    service_type = data.get("service_type")
    performed_date = data.get("performed_date")
    performed_km = int(data.get("performed_km"))
    location = data.get("location")
    notes = data.get("notes")

    next_km = None
    next_date = None

    OIL_INTERVAL = 15000
    TIRES_INTERVAL = 30000
    GENERAL_CHECK = 10000
    TA_INTERVAL_DAYS = 730

    if service_type == "oil":
        next_km = performed_km + OIL_INTERVAL
    elif service_type == "tires":
        next_km = performed_km + TIRES_INTERVAL
    elif service_type == "general":
        next_km = performed_km + GENERAL_CHECK
    elif service_type == "ta":
        d = datetime.strptime(performed_date, "%Y-%m-%d")
        next_date = (d + timedelta(days=TA_INTERVAL_DAYS)).strftime("%Y-%m-%d")

    try:
        cur.execute("""
            INSERT INTO service_records
            (vehicle_id, service_type, performed_date, performed_km, next_km, next_date, location, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (vehicle_id, service_type, performed_date, performed_km, next_km, next_date, location, notes))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"ok": True}), 201
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error creating service record: {e}")
        return jsonify({"error": "Failed to create service record"}), 500

@app.route("/api/service/<int:record_id>", methods=["DELETE"])
@require_auth
def api_delete_service(user_id, record_id):
    """Delete a service record (only if it belongs to user's vehicle)"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT sr.id FROM service_records sr
        JOIN vehicles v ON sr.vehicle_id = v.id
        WHERE sr.id = %s AND v.user_id = %s
    """, (record_id, user_id))
    
    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Service record not found"}), 404
    
    try:
        cur.execute("DELETE FROM service_records WHERE id = %s", (record_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error deleting service record: {e}")
        return jsonify({"error": "Failed to delete service record"}), 500

# =============== DEBUG ===============

@app.route("/debug/columns")
def debug_columns():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles'
        ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify([{"name": c[0], "type": c[1]} for c in cols])

@app.route("/")
def root():
    return "Fleet backend running on PostgreSQL with Auth + Teltonika TCP", 200

# --------------------- MAIN ------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 FLEETTRACK BACKEND STARTUP")
    print("=" * 60)
    
    try:
        print("\n1️⃣ Initializing database tables...")
        init_db()
        print("\n2️⃣ Running migrations...")
        run_migrations()
        print("\n3️⃣ Starting Teltonika TCP server on port 5055...")
        start_tcp_server()
        print("\n✅ All systems ready!")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ STARTUP FAILED: {e}")
        print("=" * 60)
        raise
    
    # Flask runs on PORT env var (Railway sets this to 8080)
    # TCP server runs separately on port 5055
    flask_port = int(os.environ.get("PORT", 5000))
    print(f"\n🎯 Starting Flask HTTP server on port {flask_port}...")
    print(f"📡 Teltonika TCP server on port 5055 (separate)\n")
    app.run(host="0.0.0.0", port=flask_port, debug=False)
