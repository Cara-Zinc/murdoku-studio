# Upload to GitHub / 上传到 GitHub

[English README](../README.md) · [中文 README](../README.zh-CN.md)

The prepared source package contains the project and GitHub configuration. It does not contain Git history or publish a remote repository.

整理后的源码包包含项目与 GitHub 配置，不包含 Git 历史，也不会自动创建远程仓库。

## Create the repository / 创建仓库

1. Extract the source package and open a terminal in the directory containing `README.md` and `.gitignore`.
   解压源码包，在包含 `README.md` 和 `.gitignore` 的目录打开终端。
2. Create an empty GitHub repository. Choose its owner, name, and visibility. Leave the options for an initial README, license, and `.gitignore` unchecked to avoid an unrelated initial commit.
   在 GitHub 创建空仓库，选择所属账号、名称与可见性。不要自动添加 README、许可证或 `.gitignore`，以免产生独立的初始提交。
3. Initialize a local repository and inspect the staged file list:
   初始化本地仓库，检查暂存文件列表：

```bash
git init -b main
git add .
git diff --cached --stat
git status --short
git commit -m "Prepare v1.1 Web UI release"
```

Git needs your author name and email for the commit. If they are not configured, set your own values using `git config user.name` and `git config user.email`, then retry the commit.

提交需要 Git 作者名称和邮箱。如果尚未配置，请通过 `git config user.name` 和 `git config user.email` 设置自己的信息，再重试提交。

## Push / 推送

Replace `YOUR_REPOSITORY_URL` below with the HTTPS or SSH clone URL shown on your new GitHub repository page. Authenticate with your own GitHub account when prompted.

把下面的 `YOUR_REPOSITORY_URL` 替换为新仓库页面提供的 HTTPS 或 SSH 克隆地址，按提示使用自己的 GitHub 账号认证。

```bash
git remote add origin "YOUR_REPOSITORY_URL"
git push -u origin main
```

The **Actions** tab will show the `Check Web UI` workflow. It checks syntax and tests the application; it does not host the Web UI. Follow the README installation steps to run the app locally.

在 **Actions** 页面查看 `Check Web UI` 工作流。它检查语法并运行测试，不托管 Web UI。运行应用请按 README 的安装步骤操作。
