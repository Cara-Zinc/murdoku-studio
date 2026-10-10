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
    return document(objects)


def document(objects):
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


def make_split_pdf():
    """Original three-page fixture: one map and two separate portrait rosters."""
    grid = ["0 0 0 RG 1 w", "BT /F1 24 Tf 50 550 Td (Separate map page) Tj ET"]
    for i in range(7):
        coordinate = 100 + i * 50
        grid += [f"{coordinate} 100 m {coordinate} 400 l S", f"100 {coordinate} m 400 {coordinate} l S"]
    streams = ["\n".join(grid).encode()]
    for names, color in [(["Anna", "Berta", "Carson"], "0.6 0.8 1"), (["Diana", "Elena", "Vera"], "1 0.7 0.5")]:
        commands = ["BT /F1 24 Tf 50 550 Td (Separate people page) Tj ET"]
        for index, name in enumerate(names):
            x = 70 + index * 140
            commands += [f"{color} rg {x-12} 375 54 54 re f", f"0 0 0 RG 1 w {x-12} 375 54 54 re S",
                         f"0.3 0.3 0.3 rg {x+6} 390 18 24 re f", f"0 0 0 rg BT /F1 14 Tf {x} 355 Td ({name}) Tj ET",
                         f"BT /F1 10 Tf {x} 337 Td (She was by a tree.) Tj ET"]
        streams.append("\n".join(commands).encode())
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>",
               b"<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>",
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    for index, stream in enumerate(streams):
        number = 4 + index * 2
        objects += [f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 600] /Resources << /Font << /F1 3 0 R >> >> /Contents {number+1} 0 R >>".encode(),
                    b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"]
    return document(objects)


if __name__ == "__main__":
    target = Path(__file__).parent / "fixtures" / "grid.pdf"
    target.parent.mkdir(exist_ok=True)
    target.write_bytes(make_pdf())
    print(target)
