# Murdoku Studio · Web UI

[English documentation](../README.md) · [中文说明](../README.zh-CN.md) · [详细使用指南](../docs/GUIDE.zh-CN.md)

This directory contains the application. The repository-level READMEs cover installation, features, and limitations in English and Chinese.

此目录包含应用源码。安装步骤、功能和限制请阅读仓库根目录的中英文 README。

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

No pip/npm runtime dependencies or frontend build are required.
运行应用无需安装 pip/npm 包，也无需构建前端。
