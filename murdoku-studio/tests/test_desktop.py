import base64
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop import data_directory, main as desktop_main
from pdf_fixture import make_pdf
from pdf_backend import render_pdfium


class DesktopPathsTest(unittest.TestCase):
    def test_storage_lives_outside_app_and_has_a_stable_platform_path(self):
        with patch("sys.platform", "win32"), patch.dict("os.environ", {"LOCALAPPDATA": "/tmp/local-app-data"}):
            self.assertEqual(data_directory(), Path("/tmp/local-app-data/Murdoku Studio"))
        with patch("sys.platform", "darwin"):
            self.assertEqual(data_directory(), Path.home() / "Library/Application Support/Murdoku Studio")

    def test_windowed_app_supplies_log_streams_and_reports_failures_without_a_gui(self):
        import json
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / "result.json"
            def fail_after_logging():
                sys.stderr.write("HTTP log from a windowed app\n")
                raise RuntimeError("smoke failed")
            with patch.object(sys, "argv", ["desktop", "--smoke-test", "--smoke-report", str(report)]), patch.object(sys, "stdout", None), patch.object(sys, "stderr", None), patch("desktop.smoke_test", side_effect=fail_after_logging):
                try:
                    with self.assertRaises(SystemExit) as stopped:
                        desktop_main()
                    self.assertEqual(stopped.exception.code, 1)
                    result = json.loads(report.read_text())
                    self.assertFalse(result["ok"])
                    self.assertIn("smoke failed", result["error"])
                finally:
                    sys.stdout.close()
                    sys.stderr.close()


@unittest.skipUnless(all(importlib.util.find_spec(name) for name in ("pypdfium2", "pdfplumber", "PIL")), "Desktop PDF dependencies are optional for Web UI tests")
class DesktopPDFTest(unittest.TestCase):
    def test_self_contained_renderer_preserves_text_word_coordinates_and_resolution(self):
        from PIL import Image
        for page, scale in ((1, 1800), (2, 3600)):
            result = render_pdfium(make_pdf(), page, scale)
            self.assertEqual(result["pages"], 2)
            self.assertEqual(result["page"], page)
            self.assertIn("Anna", result["text"])
            anna = next(word for word in result["words"] if word["text"] == "Anna")
            self.assertAlmostEqual(anna["x"], .1)
            self.assertTrue(0 < anna["y"] < 1)
            with Image.open(io.BytesIO(base64.b64decode(result["image"].split(",")[1]))) as image:
                self.assertEqual(max(image.size), scale)

    def test_invalid_pdf_and_nonexistent_page_are_rejected(self):
        for data, page, scale in ((b"invalid", 1, 1800), (make_pdf(), 3, 1800), (make_pdf(), 0, 1800), (make_pdf(), 1, 100)):
            with self.assertRaises(ValueError):
                render_pdfium(data, page, scale)


if __name__ == "__main__":
    unittest.main()
