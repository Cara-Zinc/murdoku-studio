import base64
import io
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from server import Handler, render_pdf, allowed_pdf_url
from pdf_fixture import make_pdf


class PDFTests(unittest.TestCase):
    def test_response_keeps_full_page_text_when_positioned_words_are_sparse(self):
        def run(command, **_):
            if command[0] == "pdfinfo":
                return SimpleNamespace(stdout=b"Pages: 1\n")
            if command[0] == "pdftoppm":
                Path(command[-1] + ".png").write_bytes(b"\x89PNG\r\n\x1a\n")
                return SimpleNamespace(stdout=b"")
            if "-layout" in command:
                return SimpleNamespace(stdout=b"Anna was here.\nA second complete line.\n")
            return SimpleNamespace(stdout=b'<html xmlns="http://www.w3.org/1999/xhtml"><body><doc><page width="500" height="600"><word xMin="5" yMin="10" xMax="30" yMax="20">Anna</word></page></doc></body></html>')

        with patch("server.shutil.which", return_value="mock"), patch("server.subprocess.run", side_effect=run):
            result = render_pdf(b"%PDF-mock")
        self.assertEqual(result["text"], "Anna was here.\nA second complete line.")
        self.assertEqual([word["text"] for word in result["words"]], ["Anna"])

    def test_image_only_pdf_uses_optional_ocr_for_text_and_words(self):
        def run(command, **_):
            if command[0] == "pdfinfo":
                return SimpleNamespace(stdout=b"Pages: 1\n")
            if command[0] == "pdftoppm":
                Path(command[-1] + ".png").write_bytes(b"\x89PNG\r\n\x1a\n")
                return SimpleNamespace(stdout=b"")
            if command[0] == "pdftotext" and "-layout" in command:
                return SimpleNamespace(stdout=b"")
            if command[0] == "pdftotext":
                return SimpleNamespace(stdout=b'<html xmlns="http://www.w3.org/1999/xhtml"><body><doc><page width="500" height="600" /></doc></body></html>')
            if "tsv" in command:
                return SimpleNamespace(stdout=b"level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n1\t1\t0\t0\t0\t0\t0\t0\t1000\t1200\t-1\t\n5\t1\t1\t1\t1\t1\t100\t120\t50\t20\t90\tAnna\n")
            return SimpleNamespace(stdout=b"Anna clue\n")

        with patch("server.shutil.which", return_value="mock"), patch("server.subprocess.run", side_effect=run):
            result = render_pdf(b"%PDF-mock")
        self.assertEqual(result["text"], "Anna clue")
        self.assertEqual(result["words"][0]["x"], 0.1)

    def test_renders_actual_pdf_and_extracts_positioned_words(self):
        result = render_pdf(make_pdf(), 1)
        self.assertEqual(result["pages"], 2)
        self.assertEqual(result["width"], 500)
        self.assertEqual(result["height"], 600)
        self.assertTrue(base64.b64decode(result["image"].split(",")[1]).startswith(b"\x89PNG"))
        self.assertTrue(any(word["text"] == "Anna" for word in result["words"]))
        self.assertIn("Anna", result["text"])
        self.assertIn("\n", result["text"])
        for word in result["words"]:
            self.assertGreaterEqual(word["x"], 0)
            self.assertLessEqual(word["y"], 1)
        self.assertEqual(render_pdf(make_pdf(), 2)["page"], 2)

    def test_rejects_invalid_files_and_page_numbers(self):
        with self.assertRaises(ValueError):
            render_pdf(b"not a PDF")
        for page in [0, 3, 301]:
            with self.assertRaises(ValueError):
                render_pdf(make_pdf(), page)

    def test_large_map_render_resolution_is_bounded(self):
        import struct
        result = render_pdf(make_pdf(), 1, 3600)
        png = base64.b64decode(result["image"].split(",")[1])
        self.assertEqual(max(struct.unpack(">II", png[16:24])), 3600)
        for scale in [0, 2000, 100000]:
            with self.assertRaises(ValueError):
                render_pdf(make_pdf(), 1, scale)

    def test_download_is_restricted_to_official_pdf_paths(self):
        self.assertTrue(allowed_pdf_url("https://murdoku.com/pdf/preppers-color.pdf"))
        for url in ["http://murdoku.com/pdf/a.pdf", "https://murdoku.com.evil.test/pdf/a.pdf",
                    "https://localhost/a.pdf", "https://murdoku.com/pdf/../a.pdf",
                    "https://murdoku.com:443/pdf/a.pdf", "https://murdoku.com/pdf/a.pdf?redirect=evil"]:
            self.assertFalse(allowed_pdf_url(url), url)


class MemoryConnection:
    """Exercise the real HTTP handler without opening a listening socket."""
    def __init__(self, request):
        self.input = io.BytesIO(request)
        self.output = bytearray()

    def makefile(self, *_):
        return self.input

    def sendall(self, data):
        self.output.extend(data)


class HandlerTests(unittest.TestCase):
    def request(self, method, path, body=b"", origin=None):
        headers = f"{method} {path} HTTP/1.0\r\nHost: localhost:8000\r\nContent-Length: {len(body)}\r\n"
        if origin:
            headers += f"Origin: {origin}\r\n"
        connection = MemoryConnection(headers.encode() + b"\r\n" + body)
        with patch.object(Handler, "log_message"):
            Handler(connection, ("127.0.0.1", 1), SimpleNamespace(server_name="localhost", server_port=8000))
        header, data = bytes(connection.output).split(b"\r\n\r\n", 1)
        return int(header.split(b" ")[1]), data

    def test_serves_application_and_health(self):
        status, data = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Murdoku Studio", data)
        status, data = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(data)["pdf"])

    def test_pdf_upload_through_http_handler(self):
        status, data = self.request("POST", "/api/pdf?page=2", make_pdf(), "http://localhost:8000")
        self.assertEqual(status, 200)
        response = json.loads(data)
        self.assertEqual(response["page"], 2)
        self.assertIsInstance(response["text"], str)

    def test_http_rejects_unbounded_render_resolution(self):
        status, _ = self.request("POST", "/api/pdf?scale=100000", make_pdf())
        self.assertEqual(status, 400)

    def test_rejects_cross_origin_upload_and_unsafe_download(self):
        status, _ = self.request("POST", "/api/pdf", make_pdf(), "https://example.com")
        self.assertEqual(status, 403)
        status, _ = self.request("GET", "/api/fetch?url=http://localhost/private")
        self.assertEqual(status, 400)

    def test_does_not_serve_backend_source(self):
        status, _ = self.request("GET", "/server.py")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
