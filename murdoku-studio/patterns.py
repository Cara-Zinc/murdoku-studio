"""Find repeated vector motifs inside an aligned board. Labels remain user supplied."""
from collections import defaultdict
import io
import math


def validate_grid(rows, cols, grid):
    if (not isinstance(rows, int) or isinstance(rows, bool) or not isinstance(cols, int) or isinstance(cols, bool)
            or not 1 <= rows <= 64 or not 1 <= cols <= 64):
        raise ValueError("网格尺寸必须是 1–64 的整数。")
    if (not isinstance(grid, dict)
            or any(not isinstance(grid.get(k), (int, float)) or isinstance(grid.get(k), bool)
                   or not math.isfinite(grid[k]) for k in ("x", "y", "w", "h"))
            or grid["x"] < 0 or grid["y"] < 0 or grid["w"] <= 0 or grid["h"] <= 0
            or grid["x"] + grid["w"] > 1.000001 or grid["y"] + grid["h"] > 1.000001):
        raise ValueError("图案分组的网格范围无效。")


def group_curves(curves, width, height, rows, cols, grid):
    validate_grid(rows, cols, grid)
    left, top = grid["x"] * width, grid["y"] * height
    board_width, board_height = grid["w"] * width, grid["h"] * height
    step = min(board_width / cols, board_height / rows)
    buckets, shapes = defaultdict(list), []
    for curve in curves:
        if not (left - .02 * step <= curve["x0"] and curve["x1"] <= left + board_width + .02 * step
                and top - .02 * step <= curve["top"] and curve["bottom"] <= top + board_height + .02 * step):
            continue
        if (min(curve["width"], curve["height"]) < .09 * step
                or max(curve["width"], curve["height"]) > 2.15 * step):
            continue
        points = [complex(*point) for operation in curve.get("path", []) for point in operation[1:]]
        if not 20 <= len(points) <= 4000:
            continue
        center = sum(points) / len(points)
        centered = [point - center for point in points]
        size = math.sqrt(sum(abs(point) ** 2 for point in centered))
        if size < .05 * step:
            continue
        normalized = [point / size for point in centered]
        color = curve.get("non_stroking_color")
        if isinstance(color, (tuple, list)):
            color = tuple(round(float(value), 2) for value in color)
        key = (tuple(operation[0] for operation in curve.get("path", [])), len(points), color)
        match = None
        for shape in buckets[key]:
            cross = sum(a.conjugate() * b for a, b in zip(shape["points"], normalized))
            angle = cross / abs(cross) if cross else 1
            if max(abs(b - angle * a) for a, b in zip(shape["points"], normalized)) < .003:
                match = shape
                break
        if match is None:
            match = {"id": len(shapes), "points": normalized, "curves": []}
            shapes.append(match)
            buckets[key].append(match)
        match["curves"].append(curve)

    motifs = [set() for _ in range(rows * cols)]
    # Frequent texture paths and one-off drawings are left for image grouping;
    # frequency never assigns a floor or occupancy category automatically.
    frequency_limit = max(35, rows * cols // 20)
    for shape in shapes:
        if not 2 <= len(shape["curves"]) <= frequency_limit:
            continue
        for curve in shape["curves"]:
            x, y = (curve["x0"] + curve["x1"]) / 2, (curve["top"] + curve["bottom"]) / 2
            row, col = math.floor((y - top) / board_height * rows), math.floor((x - left) / board_width * cols)
            if 0 <= row < rows and 0 <= col < cols:
                motifs[row * cols + col].add(shape["id"])
    clusters = []
    for cell in sorted(range(rows * cols), key=lambda i: -len(motifs[i])):
        if not motifs[cell]:
            continue
        best, winner = .55, None
        for cluster in clusters:
            for exemplar in cluster["exemplars"]:
                similarity = len(motifs[cell] & exemplar) / len(motifs[cell] | exemplar)
                if similarity > best:
                    best, winner = similarity, cluster
        if winner is None:
            clusters.append({"cells": [cell], "exemplars": [motifs[cell]]})
        else:
            winner["cells"].append(cell)
            winner["exemplars"].append(motifs[cell])
    clusters.sort(key=lambda cluster: -len(cluster["cells"]))
    assigned = {cell for cluster in clusters for cell in cluster["cells"]}
    return {"groups": [{"cells": sorted(cluster["cells"])} for cluster in clusters],
            "unmatched": [cell for cell in range(rows * cols) if cell not in assigned]}


def group_pdf(data, page, rows, cols, grid):
    validate_grid(rows, cols, grid)
    if not data.startswith(b"%PDF-") or not 1 <= page <= 300:
        raise ValueError("文件或页码无效。")
    try:
        import pdfplumber
    except ImportError as error:
        raise ValueError("PDF 图案分组需要安装 requirements.txt 中的依赖。") from error
    try:
        with pdfplumber.open(io.BytesIO(data)) as document:
            if len(document.pages) > 300 or page > len(document.pages):
                raise ValueError("PDF 最多支持 300 页，所选页必须存在。")
            selected = document.pages[page - 1]
            curves = selected.curves
            if len(curves) > 100000:
                raise ValueError("页面图案过于复杂，请使用图片分组。")
            return group_curves(curves, selected.width, selected.height, rows, cols, grid)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("无法读取 PDF 图案，请使用图片分组。") from error
