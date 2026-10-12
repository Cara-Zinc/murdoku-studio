# Murdoku Studio · Web UI

[English documentation](../README.md) · [中文说明](../README.zh-CN.md) · [详细使用指南](../docs/GUIDE.zh-CN.md)

The UI supports English and Simplified Chinese. Use the language menu in the top navigation; the browser remembers your choice.

界面支持简体中文与英文，可在顶部导航切换，浏览器会记住选择。

This directory contains the application. The repository-level READMEs cover installation, features, and limitations in English and Chinese.

此目录包含应用源码。安装步骤、功能和限制请阅读仓库根目录的中英文 README。

For a native PC window with PDF dependencies bundled, see the [desktop preview](../docs/DESKTOP.md). Public download packages are not yet published.

原生 PC 窗口与内置 PDF 依赖的打包方式见[桌面预览说明](../docs/DESKTOP.md)，公开下载包尚待发布。

With Python 3.10+ and Poppler installed, run **from this directory**:

安装 Python 3.10+ 和 Poppler 后，在**当前目录**执行：

```bash
python3 server.py --port 8000
```

Open / 打开 **http://127.0.0.1:8000**.

Development checks / 开发检查（Node.js 20+）：

```bash
npm run check
npm test
```

Basic import needs no pip/npm package or frontend build. Optionally run `python3 -m pip install -r requirements.txt` for vector pattern grouping in native PDFs; cell image grouping remains available without it.

基础导入无需 pip/npm 包或前端构建。原生 PDF 的矢量图案分组可选运行 `python3 -m pip install -r requirements.txt`；未安装时仍可按格子图片分组。

In **Edit case → Pattern groups**, inspect similar drawings, assign names and choose Floor / Can be occupied / Cannot be occupied. Correct group membership or merge variants, then save. Blocked cells reject people and candidates without exclusion crosses.

在**编辑案件 → 物品分组**中核对相似图案，填写名称并选择地板、可占用或不可占用。调整误分格子、合并图案后保存；不可占用格子会自动排除，且不显示黑叉。
运行应用无需安装 pip/npm 包，也无需构建前端。
