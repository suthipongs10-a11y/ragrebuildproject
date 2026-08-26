#!/usr/bin/env python3
"""Serve the guide site locally.

The pages are ES modules that fetch JSON, so opening index.html straight off the
disk will not work - the browser blocks both over file://. Run this instead:

    python3 web/serve.py          then open http://localhost:8800
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".json": "application/json"}

    def end_headers(self):
        # local preview only - never cache, so an export shows up on refresh
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in fmt % args:
            super().log_message(fmt, *args)


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"เปิดที่ http://localhost:{PORT}  (Ctrl+C เพื่อหยุด)")
    httpd.serve_forever()
