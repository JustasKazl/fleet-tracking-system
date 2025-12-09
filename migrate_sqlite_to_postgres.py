"""
Migration script: SQLite → PostgreSQL
Usage: python migrate_sqlite_to_postgres.py
"""

import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os

# Configuration
SQLITE_DB = "backend/fleet.db"  # Your local SQLite database
POSTGRES_URL = os.environ.get('postgresql://postgres:HOYFppPxrmKWBgewOuXbUtWnRIwwqQQa@postgres.railway.internal:5432/railway')  # Get from Railway

if not POSTGRES_URL:
    print("❌ Set DATABASE_URL environment variable")
    print("Get it from: Railway Dashboard → PostgreSQL → Variables → DATABASE_URL")
    exit(1)

print("🔄 Starting migration from SQLite to PostgreSQL...")

# Connect to both databases
sqlite_conn = sqlite3.connect(SQLITE_DB)
sqlite_conn.row_factory = sqlite3.Row
pg_conn = psycopg2.connect(POSTGRES_URL)

sqlite_cur = sqlite_conn.cursor()
pg_cur = pg_conn.cursor()

try:
    # ============ MIGRATE VEHICLES ============
    print("\n📦 Migrating vehicles...")
    
    sqlite_cur.execute("SELECT * FROM vehicles")
    vehicles = sqlite_cur.fetchall()
    
    if vehicles:
        vehicle_data = []
        for v in vehicles:
            vehicle_data.append((
                v['device_id'],
                v['brand'],
                v['model'],
                v['custom_name'],
                v['plate'],
                v['imei'],
                v['fmb_serial'],
                v['status'],
                v['total_km'],
                v['created_at']
            ))
        
        execute_values(pg_cur, """
            INSERT INTO vehicles 
            (device_id, brand, model, custom_name, plate, imei, fmb_serial, status, total_km, created_at)
            VALUES %s
        """, vehicle_data)
        
        print(f"✅ Migrated {len(vehicles)} vehicles")
    else:
        print("⚠️  No vehicles to migrate")

    # ============ MIGRATE DOCUMENTS ============
    print("\n📄 Migrating documents...")
    
    sqlite_cur.execute("SELECT * FROM documents")
    documents = sqlite_cur.fetchall()
    
    if documents:
        # Get vehicle ID mapping (SQLite ID → PostgreSQL ID)
        pg_cur.execute("SELECT device_id, id FROM vehicles")
        vehicle_map = {row[0]: row[1] for row in pg_cur.fetchall()}
        
        doc_data = []
        for doc in documents:
            # Find corresponding PostgreSQL vehicle ID
            sqlite_cur.execute("SELECT device_id FROM vehicles WHERE id = ?", (doc['vehicle_id'],))
            device_id = sqlite_cur.fetchone()['device_id']
            pg_vehicle_id = vehicle_map.get(device_id)
            
            if pg_vehicle_id:
                doc_data.append((
                    pg_vehicle_id,
                    doc['doc_type'],
                    doc['title'],
                    doc['file_path'],
                    doc['valid_until'],
                    doc['uploaded_at']
                ))
        
        if doc_data:
            execute_values(pg_cur, """
                INSERT INTO documents 
                (vehicle_id, doc_type, title, file_path, valid_until, uploaded_at)
                VALUES %s
            """, doc_data)
            
            print(f"✅ Migrated {len(doc_data)} documents")
    else:
        print("⚠️  No documents to migrate")

    # ============ MIGRATE SERVICE RECORDS ============
    print("\n🔧 Migrating service records...")
    
    sqlite_cur.execute("SELECT * FROM service_records")
    services = sqlite_cur.fetchall()
    
    if services:
        # Get vehicle ID mapping
        pg_cur.execute("SELECT device_id, id FROM vehicles")
        vehicle_map = {row[0]: row[1] for row in pg_cur.fetchall()}
        
        service_data = []
        for svc in services:
            # Find corresponding PostgreSQL vehicle ID
            sqlite_cur.execute("SELECT device_id FROM vehicles WHERE id = ?", (svc['vehicle_id'],))
            device_id = sqlite_cur.fetchone()['device_id']
            pg_vehicle_id = vehicle_map.get(device_id)
            
            if pg_vehicle_id:
                service_data.append((
                    pg_vehicle_id,
                    svc['service_type'],
                    svc['performed_date'],
                    svc['performed_km'],
                    svc.get('next_km'),
                    svc.get('next_date'),
                    svc.get('location'),
                    svc.get('notes'),
                    svc['created_at']
                ))
        
        if service_data:
            execute_values(pg_cur, """
                INSERT INTO service_records 
                (vehicle_id, service_type, performed_date, performed_km, next_km, next_date, location, notes, created_at)
                VALUES %s
            """, service_data)
            
            print(f"✅ Migrated {len(service_data)} service records")
    else:
        print("⚠️  No service records to migrate")

    # Commit all changes
    pg_conn.commit()
    
    print("\n" + "="*50)
    print("🎉 Migration completed successfully!")
    print("="*50)
    
    # Show summary
    pg_cur.execute("SELECT COUNT(*) FROM vehicles")
    v_count = pg_cur.fetchone()[0]
    
    pg_cur.execute("SELECT COUNT(*) FROM documents")
    d_count = pg_cur.fetchone()[0]
    
    pg_cur.execute("SELECT COUNT(*) FROM service_records")
    s_count = pg_cur.fetchone()[0]
    
    print(f"\n📊 PostgreSQL Database Summary:")
    print(f"   Vehicles: {v_count}")
    print(f"   Documents: {d_count}")
    print(f"   Service Records: {s_count}")

except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    pg_conn.rollback()
    raise

finally:
    sqlite_cur.close()
    sqlite_conn.close()
    pg_cur.close()
    pg_conn.close()

print("\n✨ Done! Your Railway database now has all your local data.")
