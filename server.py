#!/usr/bin/env python3
"""
RIKICLONE Web Server - Chạy Web App RIKICLONE trên máy Mac
Hỗ trợ truy cập từ máy tính và điện thoại/iPad trong cùng mạng Wi-Fi.
"""
import http.server
import socketserver
import webbrowser
import os
import signal
import sys
import socket

PORT = 8080
WEBAPP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "webapp")

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEBAPP_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, format, *args):
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def signal_handler(sig, frame):
    print('\n\n🛑 Đã dừng server.')
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGINT, signal_handler)
    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), CORSHandler) as httpd:
            local_ip = get_local_ip()
            url_local = f"http://localhost:{PORT}"
            url_lan = f"http://{local_ip}:{PORT}"

            print("=" * 60)
            print("🎌  iLearn / RIKICLONE Web App Server")
            print("=" * 60)
            print(f"💻  Truy cập trên máy tính:   {url_local}")
            print(f"📱  Truy cập trên Điện thoại/iPad (cùng Wi-Fi): {url_lan}")
            print(f"📁  Thư mục webapp:           {WEBAPP_DIR}")
            print(f"\n💡  Để dừng server: nhấn Ctrl+C")
            print("=" * 60)

            httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")
