"""
serve.py — start a local HTTP server for the draw2 demo.

    python docs/serve.py

Opens http://localhost:8080
The server sends the COOP/COEP headers needed for SharedArrayBuffer
(onnxruntime-web multithreaded WASM) — not strictly necessary here since
we use single-thread WASM, but good practice.
"""

import http.server
import os
import sys
from pathlib import Path

PORT = 8080
DOCS_DIR = Path(__file__).parent

class CORPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"  {self.path}")

if __name__ == "__main__":
    os.chdir(DOCS_DIR)
    server = http.server.HTTPServer(("localhost", PORT), CORPHandler)
    print(f"Serving draw2 demo at http://localhost:{PORT}")
    print("Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
