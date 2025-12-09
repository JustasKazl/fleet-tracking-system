from flask import Flask, request, jsonify, send_from_directory
import sqlite3
from datetime import datetime
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "fleet.db")
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}   # ### NEW

app = Flask(__name__)
CORS(app)

# ----------------------------- DB -----------------------------

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id   TEXT NOT NULL,
        brand       TEXT,
        model       TEXT,
        custom_name TEXT,
        plate       TEXT,
        imei        TEXT,
        fmb_serial  TEXT,
        status      TEXT DEFAULT 'unknown',
        total_km    INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        doc_type TEXT NOT NULL,
        title TEXT,
        file_path TEXT,
        valid_until TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS service_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        performed_date TEXT NOT NULL,
        performed_km INTEGER NOT NULL,
        next_km INTEGER,
        next_date TEXT,
        location TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    """)


    conn.commit()
    conn.close()


# ------------------------ Helpers -----------------------------

def allowed_file(filename):   # ### NEW
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ---------------------- API ROUTES ----------------------------

@app.route("/api/health")
def api_health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat() + "Z"})


# =============== VEHICLES ===============

@app.route("/api/vehicles", methods=["GET"])
def api_get_vehicles():
    conn = get_db()
    rows = conn.execute("SELECT * FROM vehicles ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/vehicles", methods=["POST"])
def api_add_vehicle():
    data = request.json
    print("Vehicle POST:", data)

    device_id = data.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO vehicles 
        (device_id, brand, model, custom_name, plate, imei, fmb_serial, status, total_km)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
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

    conn.commit()
    new_id = cur.lastrowid
    conn.close()

    return jsonify({"ok": True, "id": new_id})


@app.route("/api/vehicles/<int:vehicle_id>", methods=["GET"])
def api_get_vehicle(vehicle_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Vehicle not found"}), 404

    return jsonify(dict(row))


@app.route("/api/vehicles/<int:vehicle_id>", methods=["PUT"])
def api_update_vehicle(vehicle_id):
    data = request.json

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE vehicles
        SET brand = ?, model = ?, custom_name = ?, plate = ?, imei = ?, 
            fmb_serial = ?, status = ?, total_km = ?
        WHERE id = ?
    """, (
        data.get("brand"),
        data.get("model"),
        data.get("custom_name"),
        data.get("plate"),
        data.get("imei"),
        data.get("fmb_serial"),
        data.get("status", "offline"),
        data.get("total_km", 0),
        vehicle_id
    ))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


@app.route("/api/vehicles/<int:vehicle_id>", methods=["DELETE"])
def api_delete_vehicle(vehicle_id):
    conn = get_db()
    conn.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# =============== DOCUMENT UPLOADS ===============

@app.route("/api/vehicles/<int:vehicle_id>/documents", methods=["POST"])
def upload_document(vehicle_id):
    doc_type = request.form.get("doc_type")
    title = request.form.get("title")
    valid_until = request.form.get("valid_until")
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "No file"}), 400

    if not allowed_file(file.filename):  # ### NEW - validation
        return jsonify({"error": "Leidžiami tik PDF, JPG, JPEG, PNG"}), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"v{vehicle_id}_{int(time.time())}.{ext}"  # ### NEW safe filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    file.save(filepath)

    conn = get_db()
    conn.execute("""
        INSERT INTO documents (vehicle_id, doc_type, title, file_path, valid_until)
        VALUES (?, ?, ?, ?, ?)
    """, (vehicle_id, doc_type, title, filename, valid_until))

    conn.commit()
    conn.close()

    return jsonify({"ok": True, "file": filename})


@app.route("/api/vehicles/<int:vehicle_id>/documents", methods=["GET"])
def list_documents(vehicle_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM documents 
        WHERE vehicle_id = ?
        ORDER BY uploaded_at DESC
    """, (vehicle_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/documents/<int:doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    conn = get_db()
    row = conn.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,)).fetchone()

    if row:
        try:
            os.remove(os.path.join(UPLOAD_FOLDER, row["file_path"]))
        except:
            pass

    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})


# =============== FILE SERVE ===============

@app.route("/uploads/<path:filename>")
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)

@app.get("/api/vehicles/<int:vehicle_id>/service")
def api_get_service_records(vehicle_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM service_records
        WHERE vehicle_id = ?
        ORDER BY performed_date DESC
    """, (vehicle_id,)).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])

@app.post("/api/vehicles/<int:vehicle_id>/service")
def api_add_service_record(vehicle_id):
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
        from datetime import datetime, timedelta
        d = datetime.strptime(performed_date, "%Y-%m-%d")
        next_date = (d + timedelta(days=TA_INTERVAL_DAYS)).strftime("%Y-%m-%d")

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO service_records
        (vehicle_id, service_type, performed_date, performed_km, next_km, next_date, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (vehicle_id, service_type, performed_date, performed_km, next_km, next_date, location, notes))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})

@app.delete("/api/service/<int:record_id>")
def api_delete_service(record_id):
    conn = get_db()
    conn.execute("DELETE FROM service_records WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})



# =============== DEBUG ===============

@app.route("/debug/columns")
def debug_columns():
    conn = get_db()
    cur = conn.execute("PRAGMA table_info(vehicles)")
    cols = cur.fetchall()
    conn.close()
    return jsonify([{"cid": c[0], "name": c[1], "type": c[2]} for c in cols])
@app.route("/")
def root():
    return "Fleet backend running", 200


# --------------------- MAIN ------------------------

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

