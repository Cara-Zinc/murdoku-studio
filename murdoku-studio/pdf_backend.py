"""Self-contained PDF backend used by desktop distributions."""
import base64
from contextlib import closing
import io
import threading

# PDFium is not thread-safe, even when working on separate documents.
PDFIUM_LOCK = threading.Lock()


def render_pdfium(data, page=1, scale=1800):
    import pdfplumber
    import pypdfium2 as pdfium

    if scale not in (1800, 3600):
        raise ValueError("渲染尺寸必须为 1800 或 3600。")
    if not data.startswith(b"%PDF-"):
        raise ValueError("文件不是有效的 PDF。")
    if not 1 <= page <= 300:
        raise ValueError("页码必须在 1–300 之间。")
    try:
        with PDFIUM_LOCK, pdfium.PdfDocument(data) as document:
            pages = len(document)
            if pages > 300 or page > pages:
                raise ValueError("PDF 最多支持 300 页，所选页必须存在。")
            with closing(document[page - 1]) as pdf_page:
                width, height = pdf_page.get_size()
                with closing(pdf_page.render(scale=scale / max(width, height))) as bitmap:
                    image = bitmap.to_pil()
                    output = io.BytesIO()
                    image.save(output, format="PNG")
        with pdfplumber.open(io.BytesIO(data)) as document:
            text_page = document.pages[page - 1]
            words = [{"text": word["text"], "x": word["x0"] / text_page.width,
                      "y": word["top"] / text_page.height,
                      "width": (word["x1"] - word["x0"]) / text_page.width,
                      "height": (word["bottom"] - word["top"]) / text_page.height}
                     for word in text_page.extract_words()]
            text = text_page.extract_text(layout=True) or ""
        return {"image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode(),
                "text": text.strip(), "words": words, "page": page, "pages": pages,
                "width": width, "height": height}
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("无法转换 PDF：文件可能已损坏、加密，或页面过于复杂。") from error
