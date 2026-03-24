import os, sys, http.server, socketserver
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8000))
socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler).serve_forever()
