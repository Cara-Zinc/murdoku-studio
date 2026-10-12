# Desktop preview / 桌面预览版

Desktop builds wrap the existing Studio UI in a native window. Python, PDFium, pdfplumber, the font and original illustrations are bundled. Users do not need Python, Node.js, WSL or Poppler. Source / Web UI usage remains available.

桌面构建在原生窗口中运行现有 Studio，内置 Python、PDFium、pdfplumber、字体与原创人物素材。用户无需安装 Python、Node.js、WSL 或 Poppler。原有 Web UI 运行方式继续保留。

## For players / 玩家使用

- **Mac:** unzip, move `Murdoku Studio.app` into Applications, then open it. Choose arm64 for Apple Silicon and x86_64 for Intel. The current local build is an **unsigned preview**, without Apple Developer signing or notarization; macOS may require approval under **System Settings → Privacy & Security → Open Anyway**. Only do this for a build whose source you trust. The arm64 dependency wheels require macOS 13 or newer.
- **Windows 10/11 x64:** unzip the entire folder and double-click `Murdoku Studio.exe`. Keep the `_internal` folder next to the executable. Microsoft WebView2 Runtime is required and is normally included in Windows 11; if missing, install the [official Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). No development tools are required. An unsigned preview may trigger Windows SmartScreen.
- **Mac：** 解压，将 `Murdoku Studio.app` 拖到「应用程序」后打开。Apple Silicon 选 arm64，Intel 选 x86_64。当前本地产物是**未签名的预览版**，未做 Apple 开发者签名或公证；系统可能需要在「系统设置 → 隐私与安全性」批准打开。仅对可信来源的构建这样操作。当前 arm64 依赖要求 macOS 13 或更新版本。
- **Windows 10/11 x64：** 完整解压文件夹，双击 `Murdoku Studio.exe`。不要移动或删除旁边的 `_internal` 文件夹。需要 Microsoft WebView2 Runtime；Windows 11 通常自带，缺少时安装[微软官方 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)。无需开发工具。未签名预览版可能触发 SmartScreen。

The build workflow uploads ZIP files as Actions artifacts; it does **not** publish a release automatically. Downloading Actions artifacts requires a GitHub account. Public player downloads should be attached to a GitHub Release after platform testing.

自动打包生成 Actions ZIP 产物，**不会自动发布 Release**。下载 Actions 产物需要 GitHub 登录；面向玩家的公开下载应在平台验证后上传到 Release。源码中的工作流不代表下载包已经发布。

## Saves / 存档

The desktop origin is fixed at `http://127.0.0.1:18947`, with persistent WebView storage. Closing and reopening preserves the current case. Changing ports would change the save origin, so the app reports a busy port instead of silently switching. Export JSON before uninstalling, cleaning application data, or moving between Web UI and desktop. Desktop saves and browser saves are separate; use JSON to transfer them.

桌面端使用固定来源 `http://127.0.0.1:18947` 和持久化 WebView 存储，关闭重开后保留案件。更换端口会切换存档来源，因此遇到占用时提示关闭旧窗口，不会悄悄改端口。卸载、清理应用数据或切换 Web UI / 桌面版前，请先导出 JSON；两者存档独立，通过 JSON 转移。

Desktop PDF text extraction uses pdfplumber. Scanned PDFs can render and use image grouping but do not receive the optional Tesseract OCR available in the source Web UI. Names and clues may need manual entry. Imports still require review.

桌面 PDF 文字使用 pdfplumber 提取。扫描 PDF 可以渲染和按图片分组，但不内置源码 Web UI 可选的 Tesseract OCR；人物姓名和线索可能需要手动填写，导入结果仍需核对。

## Build / 开发者构建

Build on the target operating system with Python 3.12. PyInstaller bundles each OS separately; an arm64 Mac cannot produce a Windows executable directly. The workflow covers Windows x64, Mac arm64 and Mac Intel using platform runners.

使用 Python 3.12，在目标操作系统上构建。PyInstaller 需要分别打包各平台；arm64 Mac 无法直接产出 Windows 可执行文件。工作流通过对应平台的 runner 构建 Windows x64、Mac arm64 与 Mac Intel。

Intel Mac builds pin cryptography 48.0.1, the last release providing a universal2 wheel. Newer releases removed Intel macOS wheels; a source build can mix the runner's OpenSSL with the frozen app's libraries. Other platforms use the current dependency resolution. Exact shipped versions and upstream licenses are recorded in each app.

Intel Mac 固定使用仍提供 universal2 预编译包的 cryptography 48.0.1，避免源码构建混用 runner 与应用内置的 OpenSSL。其他平台正常解析当前依赖。每个应用均记录实际依赖版本和原始许可证。上游变化见 [cryptography changelog](https://cryptography.io/en/50.0.2/changelog/)。

```bash
python -m venv .venv-desktop
# macOS: .venv-desktop/bin/python
# Windows: .venv-desktop\Scripts\python.exe
python -m pip install -r murdoku-studio/desktop/requirements.txt
python -m unittest discover -s murdoku-studio/tests -p test_desktop.py
python murdoku-studio/desktop/build.py
```

Activate the venv before running the last three commands, or use its Python executable directly. Output goes to `dist/`; build caches and original smoke fixtures go to ignored `build/`. Only `public/`, an original smoke-test PDF and dependency licenses are included as data. Imported documents, personal saves and `output/` are excluded.

后三条命令应在激活虚拟环境后运行，或直接使用虚拟环境中的 Python 路径。产物位于 `dist/`，构建缓存和原创测试 PDF 位于被忽略的 `build/`。仅将 `public/`、原创冒烟测试 PDF 和依赖许可证作为数据打包；不包含导入题目、个人存档或 `output/`。

On GitHub: **Actions → Build desktop apps → Run workflow**. Each job tests JS and the desktop renderer, builds, runs the frozen app's `--smoke-test`, then uploads its ZIP. UI tests need an interactive desktop and should be run separately before release. No signing credentials are configured; signing and notarization remain release tasks.

GitHub 操作：**Actions → Build desktop apps → Run workflow**。每个任务测试 JS 与桌面 PDF 后端，构建，再运行已打包程序的 `--smoke-test`，最后上传 ZIP。窗口测试需要交互式桌面，应在发布前单独执行。尚未配置签名凭据，签名与公证仍需在正式发布时完成。

Sources: [PyInstaller packaging](https://pyinstaller.org/en/stable/usage.html), [pywebview persistence and downloads](https://pywebview.flowrl.com/api/), [Microsoft WebView2 distribution](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution), [GitHub runner architectures](https://github.com/actions/runner-images).
