# -*- coding: utf-8 -*-
# StagwithyouFerns 本機編輯伺服器:服務整個專案(供 index.html / config-editor.html 讀 data.json、config.ini),
# 並接受「儲存」POST,把調整器/版面編輯器的結果直接寫回檔案(不用手動貼)。
import http.server, socketserver, os, json

PORT = 8137
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 這支在 config/ 底下,往上一層即專案根

# 允許被寫入的目標(相對專案根),避免任意寫檔
SAVE_TARGETS = {
    '/save/layout': ('config/layout.json', 'json'),
    '/save/config': ('config/config.ini', 'text'),
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        path = self.path.split('?')[0]
        target = SAVE_TARGETS.get(path)
        if not target:
            self.send_error(404, 'Unknown save target')
            return
        rel, kind = target
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length)
        try:
            text = body.decode('utf-8')
            if kind == 'json':
                json.loads(text)  # 驗證是合法 JSON 才寫
            dest = os.path.join(ROOT, *rel.split('/'))
            with open(dest, 'w', encoding='utf-8', newline='\n') as f:
                f.write(text)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print('[saved]', rel)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(('save failed: ' + str(e)).encode('utf-8'))

class Server(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    print('StagwithyouFerns editor server')
    print('Serving:', ROOT)
    print('Open:    http://localhost:%d/config/config-editor.html' % PORT)
    print('(Keep this window open while editing. Close it when done.)')
    try:
        with Server(('', PORT), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        pass
