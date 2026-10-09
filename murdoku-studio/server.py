"""Local PDF renderer. Python standard library + Poppler; no package install needed."""
import argparse
import base64
import csv
import io
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener
import xml.etree.ElementTree as ET

ROOT = Path(__file__).parent / "public"
MAX_BYTES = 32 * 1024 * 1024
RENDER_SLOTS = threading.BoundedSemaphore(2)


def render_pdf(data, page=1, scale=1800):
    if scale not in (1800, 3600):
        raise ValueError("渲染尺寸必须为 1800 或 3600。")
    if not data.startswith(b"%PDF-"):
        raise ValueError("文件不是有效的 PDF。")
    if not 1 <= page <= 300:
        raise ValueError("页码必须在 1–300 之间。")
    for command in ("pdfinfo", "pdftoppm", "pdftotext"):
        if not shutil.which(command):
            raise ValueError("本地 PDF 转换需要 Poppler，请安装 poppler-utils。")
    with tempfile.TemporaryDirectory(prefix="murdoku-") as folder:
        source = Path(folder) / "input.pdf"
        source.write_bytes(data)
        info = subprocess.run(["pdfinfo", str(source)], capture_output=True, timeout=15, check=True).stdout.decode("utf-8", "replace")
        match = re.search(r"Pages:\s+(\d+)", info)
        pages = int(match[1]) if match else 1
        if pages > 300 or page > pages:
            raise ValueError("PDF 最多支持 300 页，所选页必须存在。")
        output = Path(folder) / "page"
        subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-singlefile", "-scale-to", str(scale), "-png", str(source), str(output)], capture_output=True, timeout=30, check=True)
        plain_text = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-layout", "-enc", "UTF-8", str(source), "-"], capture_output=True, timeout=15, check=True).stdout.decode("utf-8", "replace").strip()
        positioned_text = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox", str(source), "-"], capture_output=True, timeout=15, check=True).stdout
        root = ET.fromstring(positioned_text)
        page_element = next((e for e in root.iter() if e.tag.endswith("}page")), None)
        words = []
        width, height = 1, 1
        if page_element is not None:
            width, height = float(page_element.get("width")), float(page_element.get("height"))
            for e in page_element.iter():
                if e.tag.endswith("}word"):
                    words.append({"text": e.text or "", "x": float(e.get("xMin"))/width, "y": float(e.get("yMin"))/height,
                                  "width": (float(e.get("xMax"))-float(e.get("xMin")))/width,
                                  "height": (float(e.get("yMax"))-float(e.get("yMin")))/height})
        if not plain_text and shutil.which("tesseract"):
            image_path = output.with_suffix(".png")
            try:
                plain_text = subprocess.run(["tesseract", str(image_path), "stdout", "-l", "eng"], capture_output=True, timeout=30, check=True).stdout.decode("utf-8", "replace").strip()
                if plain_text:
                    tsv = subprocess.run(["tesseract", str(image_path), "stdout", "-l", "eng", "tsv"], capture_output=True, timeout=30, check=True).stdout.decode("utf-8", "replace")
                    rows = list(csv.DictReader(io.StringIO(tsv), delimiter="\t"))
                    page_row = next((row for row in rows if row.get("level") == "1"), None)
                    image_width = float(page_row["width"]) if page_row else 1
                    image_height = float(page_row["height"]) if page_row else 1
                    words = [{"text": row["text"], "x": float(row["left"])/image_width,
                              "y": float(row["top"])/image_height, "width": float(row["width"])/image_width,
                              "height": float(row["height"])/image_height}
                             for row in rows if row.get("level") == "5" and row.get("text", "").strip()]
            except (subprocess.SubprocessError, OSError, ValueError):
                pass
        return {"pages": pages, "page": page, "width": width, "height": height, "words": words, "text": plain_text,
                "image": "data:image/png;base64," + base64.b64encode(output.with_suffix(".png").read_bytes()).decode()}


def allowed_pdf_url(url):
    parsed = urlparse(url)
    return (parsed.scheme == "https" and parsed.netloc in ("murdoku.com", "www.murdoku.com")
            and re.fullmatch(r"/pdf/[a-zA-Z0-9_-]+\.pdf", parsed.path) is not None and not parsed.query and not parsed.fragment)


class SafeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed_pdf_url(newurl):
            raise ValueError("PDF 下载重定向到了不受支持的地址。")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def reply(self, payload, code=200):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def same_origin(self):
        origin = self.headers.get("Origin")
        return not origin or urlparse(origin).netloc == self.headers.get("Host")

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self.reply({"pdf": all(shutil.which(c) for c in ["pdfinfo", "pdftoppm", "pdftotext"]), "local": True})
        if parsed.path == "/api/fetch":
            if not self.same_origin():
                return self.reply({"error": "来源不受支持。"}, 403)
            url = parse_qs(parsed.query).get("url", [""])[0]
            if not allowed_pdf_url(url):
                return self.reply({"error": "链接导入仅支持 https://murdoku.com/pdf/*.pdf；其他文件请下载后导入。"}, 400)
            try:
                with build_opener(SafeRedirect()).open(Request(url, headers={"User-Agent": "MurdokuStudio/1.0"}), timeout=20) as response:
                    data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES or not data.startswith(b"%PDF-"):
                    raise ValueError("下载的文件无效或超过 32 MiB。")
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception:
                self.reply({"error": "无法下载此 PDF。请在浏览器中下载文件，再使用「导入 PDF / 图片」。"}, 502)
            return
        if parsed.path.startswith("/api/"):
            return self.reply({"error": "接口不存在。"}, 404)
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/pdf":
            return self.reply({"error": "接口不存在。"}, 404)
        if not self.same_origin():
            return self.reply({"error": "来源不受支持。"}, 403)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_BYTES:
                return self.reply({"error": "PDF 大小必须在 1 字节至 32 MiB 之间。"}, 413)
            page = int(parse_qs(parsed.query).get("page", ["1"])[0])
            scale = int(parse_qs(parsed.query).get("scale", ["1800"])[0])
            data = self.rfile.read(size)
            if not RENDER_SLOTS.acquire(blocking=False):
                return self.reply({"error": "正在处理其他 PDF，请稍后重试。"}, 429)
            try:
                self.reply(render_pdf(data, page, scale))
            finally:
                RENDER_SLOTS.release()
        except (ValueError, ET.ParseError) as error:
            self.reply({"error": str(error)}, 400)
        except (subprocess.SubprocessError, OSError):
            self.reply({"error": "无法转换 PDF：文件可能已损坏、加密，或页面过于复杂。"}, 422)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Murdoku Studio: http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
