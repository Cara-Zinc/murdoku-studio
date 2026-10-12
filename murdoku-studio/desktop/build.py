"""Build a platform-native portable package. Run with the desktop venv Python."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import zipfile

APP = Path(__file__).resolve().parents[1]
REPO = APP.parent


def make_icon(folder):
    from PIL import Image, ImageDraw
    image = Image.new("RGBA", (1024, 1024))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((48, 48, 976, 976), radius=192, fill="#68afb1", outline="#191922", width=96)
    draw.line([(256,736),(256,288),(512,576),(768,288),(768,736)], fill="#191922", width=96, joint="curve")
    draw.ellipse((672,96,928,352), fill="#e2b63f", outline="#191922", width=64)
    icon = folder / ("app.icns" if sys.platform == "darwin" else "app.ico")
    image.save(icon)
    return icon


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=REPO / "dist")
    args = parser.parse_args()
    destination = args.output.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(APP / "tests"))
    from pdf_fixture import make_pdf
    fixture = REPO / "build" / "desktop" / "smoke.pdf"
    fixture.parent.mkdir(parents=True, exist_ok=True)
    fixture.write_bytes(make_pdf())
    notices = fixture.parent / "Desktop-dependencies.txt"
    # Include original upstream license files, not just a list of package names.
    license_files = fixture.parent / "licenses"
    license_files.mkdir(exist_ok=True)
    packages = []
    for dist in importlib.metadata.distributions():
        name = dist.metadata["Name"]
        packages.append(f"{name} {dist.version}")
        for item in dist.files or []:
            if any(marker in str(item).lower() for marker in ("license", "copying", "notice")) and dist.locate_file(item).is_file():
                target = license_files / name / str(item).replace("../", "").replace("..\\", "")
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(dist.locate_file(item), target)
    notices.write_text("Desktop distribution dependencies\n\n" + "\n".join(sorted(packages)) + "\n\nPython: https://docs.python.org/3/license.html\n", encoding="utf-8")
    python_license = Path(sys.base_prefix) / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "LICENSE.txt"
    if not python_license.is_file():
        python_license = Path(sys.base_prefix) / "LICENSE.txt"
    if python_license.is_file():
        python_folder = license_files / "Python"
        python_folder.mkdir(exist_ok=True)
        shutil.copyfile(python_license, python_folder / "LICENSE.txt")
    command = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--windowed",
               "--name", "Murdoku Studio", "--distpath", str(destination),
               "--workpath", str(REPO / "build" / "pyinstaller"),
               "--specpath", str(REPO / "build"), "--paths", str(APP),
               "--add-data", f"{APP / 'public'}:public",
               "--add-data", f"{fixture}:desktop",
               "--add-data", f"{notices}:desktop",
               "--add-data", f"{license_files}:desktop/licenses",
               "--add-data", f"{REPO / 'THIRD_PARTY_NOTICES.md'}:desktop",
               "--collect-all", "pypdfium2", "--collect-all", "pypdfium2_raw",
               "--collect-all", "webview", "--collect-all", "pdfplumber",
               "--copy-metadata", "pdfminer.six", "--hidden-import", "pdf_backend",
               "--exclude-module", "PyQt5", "--exclude-module", "PyQt6",
               "--exclude-module", "PySide2", "--exclude-module", "PySide6"]
    command += ["--icon", str(make_icon(fixture.parent))]
    if sys.platform == "darwin":
        command += ["--osx-bundle-identifier", "io.github.cara-zinc.murdoku-studio"]
    command.append(str(APP / "desktop.py"))
    environment = dict(os.environ, PYINSTALLER_CONFIG_DIR=str(REPO / "build" / "cache"))
    subprocess.run(command, check=True, env=environment)
    version = json.loads((APP / "package.json").read_text())["version"]
    system = "macOS" if sys.platform == "darwin" else "Windows"
    archive = destination / f"Murdoku-Studio-{version}-{system}-{platform.machine()}.zip"
    if sys.platform == "darwin":
        bundle = destination / "Murdoku Studio.app"
        # ditto preserves the framework symlinks and the executable permissions.
        subprocess.run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(bundle), str(archive)], check=True)
    elif sys.platform == "win32":
        folder = destination / "Murdoku Studio"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
            for file in folder.rglob("*"):
                if file.is_file():
                    output.write(file, str(file.relative_to(destination)))
    else:
        raise SystemExit("Build desktop distributions on macOS or Windows.")
    with zipfile.ZipFile(archive, "a", zipfile.ZIP_DEFLATED) as output:
        output.write(APP / "desktop" / "START-HERE.txt", "START-HERE.txt")
    print(archive, flush=True)


if __name__ == "__main__":
    main()
