"""A tiny original two-page vector PDF, generated without third-party packages."""
from pathlib import Path


def make_pdf():
    commands = ["0 0 0 RG 1 w", "BT /F1 24 Tf 50 550 Td (Studio fixture) Tj ET"]
    for i in range(7):
        coordinate = 100 + i * 50
        commands.append(f"{coordinate} 100 m {coordinate} 400 l S")
        commands.append(f"100 {coordinate} m 400 {coordinate} l S")
    commands += ["BT /F1 14 Tf 50 480 Td (Anna) Tj ET", "BT /F1 11 Tf 50 460 Td (She was beside a desk.) Tj ET"]
    stream = "\n".join(commands).encode()
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>",
               b"<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
               b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"]
    data = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(data)
    data += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        data += f"{offset:010} 00000 n \n".encode()
    data += f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    return bytes(data)


if __name__ == "__main__":
    target = Path(__file__).parent / "fixtures" / "grid.pdf"
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(make_pdf())
    print(target)
