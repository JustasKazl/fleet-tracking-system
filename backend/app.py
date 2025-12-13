from flask import Flask, request, jsonify, send_from_directory
import os
import time
from datetime import datetime, timedelta
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
import json

# ============================================================
# CONFIG
# ============================================================

DATABASE_URL = os.environ.get("DATABASE_URL")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}

# ============================================================
# APP
# ============================================================

app = Flask(__name__)

FRONTEND_URLS = [
    "https://fleet-tracking-system-production-2cd5.up.railway.app",
    "http://localhost:3000",
    "http://localhost:5173",
]

CORS(
    app,
    resources={r"/api/*": {"origins": FRONTEND_URLS}},
    supports_credentials=True,
)

# ============================================================
# DB
# ============================================================

def get_db():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    conn = get_db()
    cur = conn.cursor()

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

    cur.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            vin TEXT UNIQUE NOT NULL,
            brand TEXT,
            model TEXT,
            custom_name TEXT,
            plate TEXT,
            imei TEXT,
            fmb_serial TEXT,
            status TEXT DEFAULT 'unknown',
            total_km INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id BIGSERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            altitude INTEGER,
            angle INTEGER,
            satellites INTEGER,
            speed INTEGER,
            io_elements JSONB,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            doc_type TEXT NOT NULL,
            title TEXT,
            file_path TEXT,
            valid_until TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS service_records (
            id SERIAL PRIMARY KEY,
            vehicle_id INTEGER NOT NULL,
            service_type TEXT NOT NULL,
            performed_date TEXT NOT NULL,
            performed_km INTEGER NOT NULL,
            next_km INTEGER,
            next_date TEXT,
            location TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        );
    """)

    conn.commit()
    cur.close()
    conn.close()

# ============================================================
# AUTH HELPERS
# ============================================================

def generate_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["user_id"]
    except Exception:
        return None

def require_auth(fn):
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization")
        if not header or " " not in header:
            return jsonify({"error": "Unauthorized"}), 401
        user_id = verify_token(header.split(" ")[1])
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        return fn(user_id, *args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

# ============================================================
# AUTH ROUTES
# ============================================================

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    email = data.get("email")
    password = data.get("password")
    name = data.get("name")

    if not email or not password or not name:
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (%s,%s,%s) RETURNING id",
            (email, generate_password_hash(password), name),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({"token": generate_token(user_id, email)})
    except psycopg2.IntegrityError:
        return jsonify({"error": "Email already exists"}), 409
    finally:
        cur.close()
        conn.close()

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM users WHERE email=%s", (data["email"],))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"token": generate_token(user["id"], user["email"])})

# ============================================================
# TELEMETRY WEBHOOK (HTTP ONLY)
# ============================================================

@app.route("/api/telemetry/webhook", methods=["POST"])
def telemetry_webhook():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    imei = data.get("imei")
    if not imei:
        return jsonify({"error": "Missing IMEI"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM vehicles WHERE imei=%s OR fmb_serial=%s",
        (imei, imei),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    cur.execute("""
        INSERT INTO telemetry
        (vehicle_id, timestamp, latitude, longitude, altitude, angle, satellites, speed, io_elements)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        row[0],
        datetime.utcnow(),
        data.get("latitude"),
        data.get("longitude"),
        data.get("altitude", 0),
        data.get("angle", 0),
        data.get("satellites", 0),
        data.get("speed", 0),
        json.dumps(data.get("io_elements", {})),
    ))

    cur.execute("UPDATE vehicles SET status='online' WHERE id=%s", (row[0],))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"status": "ok"})

# ============================================================
# HEALTH
# ============================================================

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "mode": "HTTP webhook only"})

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("🚀 Fleet backend starting (Railway / HTTP only)")
    init_db()

    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
