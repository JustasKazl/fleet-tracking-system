from flask import Flask, request, jsonify, send_from_directory
import os
import time
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
CORS(app)

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
    
    # Validate
    if not email or not password or not name:
        return jsonify({"error": "Email, password, and name are required"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Hash password
        password_hash = generate_password_hash(password)
        
        # Insert user
        cur.execute("""
            INSERT INTO users (email, password_hash, name, company)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, name, company
        """, (email, password_hash, name, company))
        
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        # Generate token
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
        
        # Generate token
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
            "database": "connected"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# ======= TELEMETRY FROM FMB-003 =========

@app.route("/api/telemetry/<device_id>", methods=["GET"])
   def get_telemetry(device_id):
       # Return GPS data for the device

# =============== VEHICLES ===============

@app.route("/api/vehicles", methods=["GET"])
@require_auth
def api_get_vehicles(user_id):
    """Get all vehicles for the authenticated user"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    # ✅ IMPORTANT: Filter by user_id to ensure users only see their own vehicles
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
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # ✅ IMPORTANT: Always set user_id to the authenticated user
        cur.execute("""
            INSERT INTO vehicles 
            (user_id, device_id, brand, model, custom_name, plate, imei, fmb_serial, status, total_km)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,  # ✅ Set to authenticated user's ID
            device_id,
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
    # ✅ Check both vehicle_id AND user_id
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

    # ✅ Check ownership before updating
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
    
    # ✅ Check ownership before deleting
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
    # ✅ Check ownership
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
    
    # ✅ Check ownership
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
    
    # ✅ Check that document belongs to user's vehicle
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
        # Delete file from disk
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
    
    # ✅ Check ownership
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
    # ✅ Check ownership
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

    # AUTOMATINIAI INTERVALAI
    next_km = None
    next_date = None

    OIL_INTERVAL = 15000
    TIRES_INTERVAL = 30000
    GENERAL_CHECK = 10000
    TA_INTERVAL_DAYS = 730  # 2 metai

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
    
    # ✅ Check that service record belongs to user's vehicle
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
    return "Fleet backend running on PostgreSQL with Auth", 200


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
        print("\n✅ Database ready!")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ STARTUP FAILED: {e}")
        print("=" * 60)
        raise
    
    port = int(os.environ.get("PORT", 5000))
    print(f"\n🎯 Starting server on port {port}...\n")
    app.run(host="0.0.0.0", port=port, debug=False)
