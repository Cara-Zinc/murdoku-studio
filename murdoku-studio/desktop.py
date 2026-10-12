"""Native desktop entry point. User files stay outside the application bundle."""
import argparse
import json
import os
from pathlib import Path
import sys
import threading
import urllib.request

APP_NAME = "Murdoku Studio"
PORT = 18947  # A stable origin is necessary for IndexedDB recovery across launches.


def data_directory():
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / APP_NAME
    return Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))) / "murdoku-studio"


def start_server(port=PORT):
    os.environ["MURDOKU_PDF_BACKEND"] = "pdfium"
    import server
    server.PDF_BACKEND = "pdfium"
    httpd = server.ThreadingHTTPServer(("127.0.0.1", port), server.Handler)
    httpd.daemon_threads = True
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def smoke_test():
    """Exercise the frozen resources and PDF engine without opening a GUI."""
    from pdf_backend import render_pdfium
    from patterns import group_pdf
    httpd = start_server(0)
    try:
        base = f"http://127.0.0.1:{httpd.server_port}"
        health = json.load(urllib.request.urlopen(base + "/api/health"))
        assert health["pdf"] and health["backend"] == "pdfium", health
        for path in ("/", "/app.js", "/solver-worker.js", "/assets/caveat.ttf"):
            with urllib.request.urlopen(base + path) as response:
                assert response.status == 200
                response.read()
        import server
        assert (server.ROOT / "assets" / "suspects-atlas.png").is_file(), "Bundled portraits missing"
        fixture = Path(__file__).parent / "desktop" / "smoke.pdf"
        result = render_pdfium(fixture.read_bytes())
        assert result["pages"] == 2 and result["words"] and "Anna" in result["text"]
        groups = group_pdf(fixture.read_bytes(), 1, 4, 4, {"x":0,"y":0,"w":1,"h":1})
        assert "groups" in groups
        print(json.dumps({"ok": True, "backend": "pdfium", "pages": result["pages"], "words": len(result["words"])}), flush=True)
    finally:
        httpd.shutdown()
        httpd.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke-test", action="store_true")
    parser.add_argument("--ui-test", metavar="RESULT", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.smoke_test:
        smoke_test()
        return
    import webview
    storage = Path(args.ui_test).resolve().parent / "test-profile" if args.ui_test else data_directory()
    storage.mkdir(parents=True, exist_ok=True)
    webview.settings["ALLOW_DOWNLOADS"] = True
    try:
        httpd = start_server(PORT + 1 if args.ui_test else PORT)
    except OSError:
        webview.create_window(APP_NAME, html="<h2>Murdoku Studio</h2><p>应用已在运行，或端口 18947 被占用。请关闭旧窗口后重试。</p><p>The app is already running, or port 18947 is busy. Close the other window and retry.</p>")
        webview.start(private_mode=False, storage_path=str(storage / "WebView"),
                      gui="edgechromium" if sys.platform == "win32" else None)
        return
    try:
        window = webview.create_window(APP_NAME, f"http://127.0.0.1:{httpd.server_port}/", width=1320,
                                       height=900, min_size=(850, 640), text_select=True,
                                       background_color="#f6f2e9")
        if args.ui_test:
            def check_ui():
                import time
                result = None
                try:
                    for _ in range(60):
                        result = window.evaluate_js("({ready:!!document.querySelector('.cell'),title:document.title,health:!!window.indexedDB})")
                        if result and result.get("ready"):
                            break
                        time.sleep(.25)
                    assert result and result["ready"] and result["health"], result
                    result["previousLaunch"] = window.evaluate_js("localStorage.getItem('desktop-test-launch')")
                    window.evaluate_js("localStorage.setItem('desktop-test-launch','saved')")
                    result["previousPlacement"] = window.evaluate_js("!!document.querySelector('[data-cell=\"1\"] .placed')")
                    if not result["previousPlacement"]:
                        window.evaluate_js("document.querySelector('.clue-card[data-person=\"A\"]').click();document.querySelector('[data-mode=\"place\"]').click();document.querySelector('[data-cell=\"1\"]').click()")
                    time.sleep(1)
                    Path(args.ui_test).write_text(json.dumps(result), encoding="utf-8")
                finally:
                    window.destroy()
            window.events.loaded += lambda: threading.Thread(target=check_ui, daemon=True).start()
        webview.start(private_mode=False, storage_path=str(storage / "WebView"),
                      gui="edgechromium" if sys.platform == "win32" else None)
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
