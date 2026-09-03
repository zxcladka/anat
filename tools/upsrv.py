import http.server, urllib.parse, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'dl')
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','*'); self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
    def do_OPTIONS(self): self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        q=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query); name=os.path.basename(q.get('name',['x'])[0])
        n=int(self.headers.get('Content-Length',0)); data=self.rfile.read(n)
        open(os.path.join(D,name),'wb').write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self,*a): pass
http.server.HTTPServer(('127.0.0.1',8767),H).serve_forever()
