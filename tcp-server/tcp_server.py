#!/usr/bin/env python3
"""
ULTRA SIMPLE TCP Server - Always ACK everything
For FMB003 testing - no validation, just accept everything
"""
import os
import socket
import threading

TCP_PORT = int(os.environ.get('TCP_PORT', 5055))

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
            print(f"📥 Received {len(data)} bytes")
            
            # PHASE 1: IMEI Handshake
            if imei is None:
                if len(buffer) >= 2:
                    imei_len = int.from_bytes(buffer[0:2], 'big')
                    print(f"📏 IMEI length: {imei_len}")
                    
                    if len(buffer) >= 2 + imei_len:
                        imei = buffer[2:2+imei_len].decode('utf-8')
                        print(f"📱 IMEI: {imei}")
                        
                        buffer = buffer[2+imei_len:]
                        client_socket.send(b'\x01')
                        print(f"✅ Sent IMEI ACK")
                        continue
            
            # PHASE 2: Just ACK everything
            while len(buffer) >= 12:
                # Check for preamble
                preamble = int.from_bytes(buffer[0:4], 'big')
                if preamble != 0:
                    buffer = buffer[1:]
                    continue
                
                # Get data length
                data_length = int.from_bytes(buffer[4:8], 'big')
                total_packet_size = 8 + data_length + 4
                
                print(f"📦 Packet size: {total_packet_size} bytes")
                
                if len(buffer) < total_packet_size:
                    print(f"⏳ Waiting for more data...")
                    break
                
                # Extract packet
                packet = buffer[:total_packet_size]
                
                # Get number of records (byte 9)
                if len(packet) > 9:
                    num_records = packet[9]
                    print(f"📊 Records in packet: {num_records}")
                    
                    # ALWAYS SEND ACK
                    ack = num_records.to_bytes(4, 'big')
                    client_socket.sendall(ack)
                    print(f"✅ Sent ACK: {num_records} records")
                else:
                    # Send ACK for 1 record if we can't parse
                    ack = b'\x00\x00\x00\x01'
                    client_socket.sendall(ack)
                    print(f"✅ Sent ACK: 1 record (default)")
                
                buffer = buffer[total_packet_size:]
                print(f"🔄 Buffer remaining: {len(buffer)} bytes")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client_socket.close()
        print(f"❌ Disconnected: {addr}")

def run_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', TCP_PORT))
    server.listen(5)
    print(f"🚀 SIMPLE TCP server listening on 0.0.0.0:{TCP_PORT}")
    print(f"📢 THIS SERVER ACCEPTS ALL DEVICES AND ALWAYS SENDS ACK")
    
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
    print("🚀 ULTRA SIMPLE TCP SERVER - ACCEPT EVERYTHING")
    print("=" * 60)
    print(f"📡 Port: {TCP_PORT}")
    print("⚠️  NO DATABASE - JUST TESTING ACK")
    print("=" * 60)
    run_server()
