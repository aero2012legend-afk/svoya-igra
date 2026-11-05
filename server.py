#!/usr/bin/env python3
"""«Своя игра» по Wi-Fi без интернета.

Запуск: двойной клик по «Запустить игру.bat» (Windows) или `python3 server.py` (Mac/Linux).
Компьютер раздаёт игру в своей сети: телевизор открывает http://localhost:8080,
телефоны — по QR-коду (адрес вида http://192.168.x.x:8080). Сообщения между экраном
и телефонами идут через этот же компьютер (встроенный мини-сервер MQTT поверх WebSocket),
поэтому интернет не нужен — только общий Wi-Fi.

Музыку положи рядом: распакуй архив svoya-igra-media.zip в эту же папку (появится папка media/music).
Нужен только Python 3.8+ (без дополнительных библиотек)."""
import asyncio, base64, hashlib, json, mimetypes, os, socket, struct, sys, urllib.parse, webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORTS = [8080, 8081, 8082, 8090, 8888]
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('audio/mpeg', '.mp3')
mimetypes.add_type('audio/mp4', '.m4a')
mimetypes.add_type('video/mp4', '.mp4')


def lan_ip():
    """Адрес компьютера в домашней сети (без отправки пакетов наружу)."""
    for probe in ('10.255.255.255', '192.168.255.255', '8.8.8.8'):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((probe, 1))
            ip = s.getsockname()[0]
            s.close()
            if ip and not ip.startswith('127.'):
                return ip
        except OSError:
            pass
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return '127.0.0.1'


# ---------------- мини-брокер MQTT 3.1.1 (QoS 0, retain, подписки с # и +) ----------------
def rl(n):
    out = bytearray()
    while True:
        d = n % 128
        n //= 128
        if n:
            d |= 128
        out.append(d)
        if not n:
            return bytes(out)


def mqtt_pkt(first, body):
    return bytes([first]) + rl(len(body)) + body


def mstr(s):
    b = s.encode()
    return struct.pack('>H', len(b)) + b


def match(flt, topic):
    a, b = flt.split('/'), topic.split('/')
    for i, x in enumerate(a):
        if x == '#':
            return True
        if i >= len(b) or (x != '+' and x != b[i]):
            return False
    return len(a) == len(b)


class Broker:
    def __init__(self):
        self.clients = set()
        self.retained = {}

    def deliver(self, topic, payload, retain):
        if retain:
            if payload:
                self.retained[topic] = payload
            else:
                self.retained.pop(topic, None)
        p = mqtt_pkt(0x30, mstr(topic) + payload)
        for c in list(self.clients):
            if any(match(f, topic) for f in c.subs):
                c.send(p)


BROKER = Broker()


class MqttConn:
    def __init__(self, ws):
        self.ws, self.subs, self.buf = ws, set(), b''

    def send(self, data):
        self.ws.send_frame(2, data)

    def feed(self, data):
        self.buf += data
        while True:
            if len(self.buf) < 2:
                return
            mul, ln, i = 1, 0, 1
            while True:
                if i >= len(self.buf):
                    return
                d = self.buf[i]
                i += 1
                ln += (d & 127) * mul
                mul *= 128
                if not d & 128:
                    break
            if len(self.buf) < i + ln:
                return
            first, body = self.buf[0], self.buf[i:i + ln]
            self.buf = self.buf[i + ln:]
            self.handle(first >> 4, first & 15, body)

    def handle(self, typ, flags, body):
        if typ == 1:      # CONNECT
            self.send(bytes([0x20, 2, 0, 0]))
        elif typ == 3:    # PUBLISH
            tl = struct.unpack('>H', body[:2])[0]
            topic = body[2:2 + tl].decode('utf-8', 'replace')
            off = 2 + tl + (2 if (flags >> 1) & 3 else 0)
            BROKER.deliver(topic, body[off:], bool(flags & 1))
        elif typ == 8:    # SUBSCRIBE
            pid, off, codes = body[:2], 2, bytearray()
            while off < len(body):
                ln = struct.unpack('>H', body[off:off + 2])[0]
                f = body[off + 2:off + 2 + ln].decode('utf-8', 'replace')
                off += 2 + ln + 1
                self.subs.add(f)
                codes.append(0)
                for t, p in list(BROKER.retained.items()):
                    if match(f, t):
                        self.send(mqtt_pkt(0x31, mstr(t) + p))
            self.send(mqtt_pkt(0x90, pid + bytes(codes)))
        elif typ == 10:   # UNSUBSCRIBE
            pid, off = body[:2], 2
            while off < len(body):
                ln = struct.unpack('>H', body[off:off + 2])[0]
                self.subs.discard(body[off + 2:off + 2 + ln].decode('utf-8', 'replace'))
                off += 2 + ln
            self.send(mqtt_pkt(0xB0, pid))
        elif typ == 12:   # PINGREQ
            self.send(bytes([0xD0, 0]))
        elif typ == 14:   # DISCONNECT
            self.ws.close()


# ---------------- WebSocket ----------------
class WS:
    def __init__(self, reader, writer):
        self.r, self.w, self.closed = reader, writer, False

    def send_frame(self, op, data):
        if self.closed:
            return
        n = len(data)
        head = bytes([0x80 | op]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack('>H', n) if n < 65536 else bytes([127]) + struct.pack('>Q', n))
        try:
            self.w.write(head + data)
        except Exception:
            self.closed = True

    def close(self):
        if not self.closed:
            self.send_frame(8, b'')
            self.closed = True
            try:
                self.w.close()
            except Exception:
                pass

    async def frames(self):
        msg, mop = b'', 0
        while not self.closed:
            h = await self.r.readexactly(2)
            fin, op, masked, n = h[0] & 0x80, h[0] & 15, h[1] & 0x80, h[1] & 127
            if n == 126:
                n = struct.unpack('>H', await self.r.readexactly(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', await self.r.readexactly(8))[0]
            mask = await self.r.readexactly(4) if masked else b''
            data = await self.r.readexactly(n) if n else b''
            if masked:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if op == 8:
                self.close()
                return
            if op == 9:
                self.send_frame(10, data)
                continue
            if op == 10:
                continue
            if op:
                mop, msg = op, data
            else:
                msg += data
            if fin:
                yield mop, msg
                msg = b''


# ---------------- HTTP ----------------
async def handle(reader, writer):
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            try:
                method, target, _ = line.decode('latin-1').split(' ', 2)
            except ValueError:
                break
            headers = {}
            while True:
                h = await reader.readline()
                if h in (b'\r\n', b'\n', b''):
                    break
                k, _, v = h.decode('latin-1').partition(':')
                headers[k.strip().lower()] = v.strip()
            path = urllib.parse.unquote(urllib.parse.urlsplit(target).path)
            if headers.get('upgrade', '').lower() == 'websocket' and path == '/mqtt':
                return await websocket(reader, writer, headers)
            keep = await serve(writer, method, path, headers)
            if not keep:
                break
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def websocket(reader, writer, headers):
    key = headers.get('sec-websocket-key', '')
    acc = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    proto = 'Sec-WebSocket-Protocol: mqtt\r\n' if 'mqtt' in headers.get('sec-websocket-protocol', '') else ''
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                  f'Sec-WebSocket-Accept: {acc}\r\n{proto}\r\n').encode())
    ws = WS(reader, writer)
    conn = MqttConn(ws)
    BROKER.clients.add(conn)
    try:
        async for op, data in ws.frames():
            conn.feed(data)
            await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        BROKER.clients.discard(conn)
        ws.close()


def reply(writer, code, ctype, body, extra=''):
    reason = {200: 'OK', 206: 'Partial Content', 304: 'Not Modified', 404: 'Not Found', 416: 'Range Not Satisfiable'}.get(code, 'OK')
    writer.write((f'HTTP/1.1 {code} {reason}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n'
                  f'Cache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\n{extra}\r\n').encode() + body)


async def serve(writer, method, path, headers):
    if path == '/__lan':
        reply(writer, 200, 'application/json', json.dumps({'ip': LAN, 'port': PORT}).encode())
        await writer.drain()
        return True
    rel = path.lstrip('/') or 'index.html'
    full = os.path.normpath(os.path.join(ROOT, rel))
    if not full.startswith(ROOT) or os.path.basename(full) == 'server.py':
        reply(writer, 404, 'text/plain', b'not found')
        return True
    if os.path.isdir(full):
        full = os.path.join(full, 'index.html')
    if not os.path.isfile(full):
        # музыка лежит рядом в _private/media (так устроена папка автора пака)
        alt = os.path.join(ROOT, '_private', rel)
        if rel.startswith('media/') and os.path.isfile(alt):
            full = alt
        else:
            reply(writer, 404, 'text/plain; charset=utf-8', 'Нет файла'.encode())
            await writer.drain()
            return True
    size = os.path.getsize(full)
    ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
    if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
        ctype += '; charset=utf-8'
    rng = headers.get('range', '')
    start, end, code = 0, size - 1, 200
    if rng.startswith('bytes='):
        a, _, b = rng[6:].split(',')[0].partition('-')
        try:
            if a:
                start = int(a)
                end = int(b) if b else size - 1
            else:
                start = max(0, size - int(b))
            end = min(end, size - 1)
            code = 206
        except ValueError:
            pass
        if start > end:
            reply(writer, 416, 'text/plain', b'', f'Content-Range: bytes */{size}\r\n')
            await writer.drain()
            return True
    length = end - start + 1
    extra = 'Accept-Ranges: bytes\r\n' + (f'Content-Range: bytes {start}-{end}/{size}\r\n' if code == 206 else '')
    reason = 'Partial Content' if code == 206 else 'OK'
    writer.write((f'HTTP/1.1 {code} {reason}\r\nContent-Type: {ctype}\r\nContent-Length: {length}\r\n'
                  f'Cache-Control: no-cache\r\n{extra}\r\n').encode())
    if method != 'HEAD':
        with open(full, 'rb') as f:
            f.seek(start)
            left = length
            while left > 0:
                chunk = f.read(min(256 * 1024, left))
                if not chunk:
                    break
                writer.write(chunk)
                left -= len(chunk)
                await writer.drain()
    await writer.drain()
    return True


async def main():
    global PORT, LAN
    LAN = lan_ip()
    server = None
    for PORT in PORTS:
        try:
            server = await asyncio.start_server(handle, '0.0.0.0', PORT)
            break
        except OSError:
            continue
    if not server:
        print('Не удалось занять порт (8080…8888) — закрой другие программы и запусти снова.')
        return
    url = f'http://localhost:{PORT}/'
    print('=' * 60)
    print('  🎂 «Своя игра» запущена — интернет не нужен, только Wi-Fi')
    print(f'  Экран игры (телевизор): {url}')
    print(f'  Адрес для телефонов:    http://{LAN}:{PORT}/play.html  (QR-код покажет сама игра)')
    print('  Телефоны должны быть в том же Wi-Fi, что и этот компьютер.')
    print('  Если Windows спросит про брандмауэр — нажми «Разрешить» (частные сети).')
    print('  Не закрывай это окно, пока идёт игра.')
    print('=' * 60)
    if '--no-browser' not in sys.argv:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
