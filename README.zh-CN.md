# Murdoku Studio

[English](README.md) | **简体中文**

把 PDF 智力谜题转换成可操作的 Murdoku 棋盘。导入页面、校准网格后，即可使用大字母放置标记、小字母候选和同行列自动排除来解谜。人物线索卡保留头像。

**v1.1.0 · Web UI 版。** 启动本地 Python 服务，通过浏览器使用。当前界面为简体中文，项目说明提供中英文版本。首版以源码形式交付，尚未提供桌面安装包或手机应用。

![Murdoku Studio Web UI：内置原创练习题](docs/images/web-ui.png)

这是独立爱好者项目，与 Murdoku 官方无隶属关系。内置练习题和人物插画为原创，项目不附带官方谜题 PDF。

## 功能

- 导入多页 PDF、PNG/JPEG/WebP 图片、官方 PDF 链接及本工具导出的 JSON 存档。
- 大地图支持 6×6、8×8、10×10、12×12 局部视图，小地图拖动、全局坐标定位和逐页视野恢复。
- 导入前核对并修改人物姓名、线索；编辑时对照原页，并可重新校准棋盘裁剪范围。
- 检测候选网格，支持拖动、缩放和精确坐标校准。
- 地图页与人物页可分开选择，支持从多个人物页合并姓名、线索和头像，并按姓名首字母分配编号。
- 头像支持按来源页自动匹配、手动框选，以及单独上传 PNG/JPEG/WebP 图片。
- 点击或拖放人物。放置后，同行列显示自动黑叉，支持调整粗细。
- 记录候选、排除、格子颜色、手绘标记、线索勾选和调查笔记。
- 撤销与重做、缩放、全屏、计时与暂停。
- 编辑区域、物品、障碍物、人物和结构化规则；依据已核对的规则检查冲突、获取唯一解提示及指认凶手。
- 在浏览器中保存案件和各页进度；导出及恢复当前页的 JSON，包括头像与原题图像。

## 安装与启动

### 1. 获取源码

在仓库页面选择 **Code → Download ZIP** 并解压，或通过 Git 克隆本仓库。在仓库根目录打开终端，即同时包含本 README 和 `murdoku-studio/` 文件夹的目录。

### 2. 安装依赖

| 依赖 | 用途 |
| --- | --- |
| Python 3.10+ | 本地 HTTP 服务，仅使用标准库 |
| Poppler：`pdfinfo`、`pdftoppm`、`pdftotext` | 渲染 PDF 和提取文字 |
| 启用 JavaScript 和 IndexedDB 的现代浏览器 | Web UI 与本机存档 |
| Node.js 20+ 与 npm，可选 | 仅用于开发检查和测试 |

运行应用无需安装 pip 或 npm 包，也无需构建前端。

**Ubuntu / Debian**

```bash
sudo apt-get update
sudo apt-get install python3 poppler-utils
```

**macOS**，需先安装 [Homebrew](https://brew.sh/)：

```bash
brew install python poppler
```

Poppler 的安装包说明见 [Homebrew Formula](https://formulae.brew.sh/formula/poppler)。

**Windows**：通过 [WSL](https://learn.microsoft.com/zh-cn/windows/wsl/install) 使用 Ubuntu。如果尚未安装 WSL，在管理员 PowerShell 中执行以下命令，按提示重启并完成 Ubuntu 初始化：

```powershell
wsl --install -d Ubuntu
```

然后在 Ubuntu 终端中执行上述 Ubuntu 安装命令及下一步启动命令，通过 Windows 浏览器访问。首版暂不提供 Windows 原生安装流程。

**可选英文 OCR**：安装 Tesseract 和英文语言包后，程序会尝试识别没有可提取文字的 PDF。Ubuntu/Debian/WSL 可执行 `sudo apt-get install tesseract-ocr tesseract-ocr-eng`；macOS 可执行 `brew install tesseract`。详见 [Tesseract 安装指南](https://tesseract-ocr.github.io/tessdoc/Installation.html)。OCR 只作为 PDF 文字为空时的补充，结果仍需核对；单独导入图片仍需手动填写文字。

### 3. 启动 Web UI

在仓库根目录执行：

```bash
python3 murdoku-studio/server.py --port 8000
```

浏览器打开 **http://127.0.0.1:8000**。保持终端运行，按 `Ctrl+C` 停止服务。首次打开即可体验原创练习题。

访问 **http://127.0.0.1:8000/api/health** 检查 PDF 支持。`pdf` 应为 `true`；如果为 `false`，请安装 Poppler，并确认三个命令都位于服务进程的 `PATH` 中。

如需更换端口，使用 `--port 8001` 并访问对应地址。浏览器按来源分别保存数据，更换主机名或端口会使用另一套存档；切换前请先导出进度。

## 导入第一道题

1. 点击「导入谜题」，选择 PDF 或图片。单文件最多 32 MiB，PDF 最多 300 页。
2. 选择页面，确认裁剪框覆盖主棋盘，修正行数、列数和人物数量。
3. 在「人物与头像来源页」勾选人物所在页（可多选），核对名单后转换。人物页可以与地图页不同。
4. 如需修正头像，打开「编辑案件 → 人物与规则」，选择「头像来源」后点击「调整头像框」，或点击「上传头像」（PNG/JPEG/WebP，最大 8 MiB）。调整裁剪框，点击「应用头像」，再点击「保存案件」。
5. 选择人物后点击格子，或把人物卡拖到格子上。用其他工具记录推理过程。进度会自动保存，点击「导出存档」可另存备份。

如需检查线索或获取提示，请先在案件编辑器中定义区域、物品和人物规则。核对完一名人物的全部线索后，再标记为已完整配置。手动解谜无需预先配置规则。更多规则说明见[使用指南](docs/GUIDE.zh-CN.md)。

## 大地图与侦探放大镜

任一边达到 16 格时，默认使用 8×8 局部视图；小题默认全图。可切换窗口大小，点击小地图或拖动蓝色观察框，也可输入 `M13` 等全局坐标定位。开启「✥ 平移」后拖动主棋盘，或使用鼠标中键拖动。小地图支持方向键逐格移动，Shift 每次移动“窗口边长减二”格，保留相邻视野的重叠。

窗口外的人物仍会排除当前视野内的同行列格子。坐标轴上的字母标记显示对应人物，点击可定位。「定位人物」跳到当前选中的人物；「返回上一视野」回到本次会话较早的视野。浏览操作不占用解谜撤销记录。大地图在全图模式下点击格子会放大查看，不会直接落子。

人物、候选和手绘始终使用全局坐标。每页 PDF 独立保存视野，JSON 导出也保留视野。大题导入时自动按页面最长边 3600 像素重新渲染，提高局部观察的清晰度；已有存档需重新导入才能提高原图分辨率。人物栏可搜索姓名或编号，也可只显示尚未放置的人物。

![原创 24×24 大地图导航测试场景](docs/images/large-map.png)

## 功能范围与限制

- 文字提取、网格检测和头像匹配均为建议。**Preppers** 当前可能误检棋盘范围，需要手动校准为 **9×9** 主棋盘。
- 头像匹配适用于可提取姓名文字、姓名上方有矩形头像框的版式。扫描件、无框头像或其他排版可能需要手动裁剪。纯图片 PDF 可选用英文 OCR；不会自动判断性别。
- 自然语言线索、房间边界和家具不会自动转换为已核对的规则。提示和指认依据用户配置的规则，不与官方答案库比对；搜索达到限制时可能无法确定结果。
- JSON 导出包含当前棋盘、关联人物页、上传头像原图及进度，不包含整本 PDF。其他棋盘需要分别导出。编辑案件会清空该页的撤销历史。
- 放大镜用于解谜棋盘；区域与物品编辑器目前仍以全图方式标注。
- 可以保存尚未指定受害者的案件并手动解谜，但不能验证凶手或获取求解提示。大地图适配未实现大赛专用的宝箱目标判定。
- 首版提供本地 Web UI，尚未提供在线托管服务。PDF 导入依赖 Python 后端，不能仅靠 GitHub Pages 运行完整功能。尚未核验与官方在线版逐项功能一致。

## 存档与常见问题

服务默认只监听 `127.0.0.1`。文件由本地 Python 服务处理，转换用的临时文件在处理后删除。案件保存在浏览器 IndexedDB 中；清理浏览器数据会删除存档。应用不会把案件上传到云端。

| 问题 | 处理方式 |
| --- | --- |
| 双击 `index.html` 后无法使用 | 启动 Python 服务，通过 HTTP 地址访问。 |
| PDF 转换不可用 | 检查 `/api/health`，确认已安装 Poppler。 |
| 官方 PDF 链接下载失败 | 先在浏览器下载文件，再从本地导入。 |
| 找不到以前的存档 | 使用原来的浏览器、主机名和端口。 |
| 端口被占用 | 用 `--port` 指定其他端口；注意不同端口的存档相互独立。 |
| 服务运行在远程机器上 | 用 `ssh -L 8000:127.0.0.1:8000 用户名@服务器` 转发，再打开本机地址。 |

## 开发

安装 Node.js 和 Poppler 后，在仓库根目录执行：

```bash
npm --prefix murdoku-studio run check
npm --prefix murdoku-studio test
python3 murdoku-studio/tests/pdf_fixture.py
```

`check` 检查 JavaScript 语法并编译 Python 服务；`test` 运行 Node.js 规则与导入测试、Python PDF 与 HTTP 测试；最后一条命令重新生成原创双页测试 PDF。无需执行 `npm install`。

```text
.github/workflows/        GitHub Actions 自动检查
AGENTS.md                贡献指南
README.md                英文介绍与安装说明
README.zh-CN.md           中文介绍与安装说明
docs/                    使用指南与精选截图
murdoku-studio/
  server.py              HTTP 服务与 Poppler 集成
  public/                原生 ES 模块、样式与本地素材
  tests/                 Node.js / Python 测试与原创 PDF 样本
```

CI 工作流在推送和 Pull Request 时运行检查与测试。贡献前请阅读[Repository Guidelines](AGENTS.md)。界面改动请附截图，并说明实际做过的浏览器验证。不要提交个人谜题、导出存档、凭据和生成产物；`.gitignore` 会排除这些文件，同时保留原创测试样本和项目素材。

整理后的源码包上传步骤见[上传到 GitHub](docs/PUBLISH.md)。

验证结果和存档兼容说明见 [v1.1.0 合并说明](docs/RELEASE_NOTES.md)。

## 致谢

交互参考 [Murdoku 官方在线版](https://murdoku.com/play/) 和 [Murdoku Fans Assistant](https://murdoku.fans/zh/murdoku-assistant/)。内置字体、原创插画及其来源见[第三方素材说明](THIRD_PARTY_NOTICES.md)与[素材来源及生成提示词](murdoku-studio/public/assets/README.md)。
