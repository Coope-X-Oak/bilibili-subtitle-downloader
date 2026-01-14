# Bilibili Subtitle Downloader (B站字幕下载器)

![Version](https://img.shields.io/badge/version-v1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

一个用于批量下载Bilibili视频字幕的油猴脚本（UserScript）。支持多种格式（ASS, SRT, LRC, TXT, MD），提供紧凑的UI设计、多关键词筛选、WBI签名验证以及高并发下载支持。

## ✨ 主要功能

- **批量下载**：自动获取并下载视频列表中的所有字幕。
- **多种格式**：支持导出为 JSON (原始格式), ASS, SRT, LRC, TXT, MD (Markdown) 格式。
- **智能筛选**：支持多关键词空格分隔筛选，提供“全选匹配”功能。
- **紧凑UI**：专为大量视频列表设计的紧凑型界面，不占用过多屏幕空间。
- **稳定可靠**：
  - 内置 WBI 签名算法，解决接口鉴权问题。
  - 移除 ZIP 打包依赖，采用直接下载方式，避免大批量下载时浏览器崩溃。
  - 智能并发控制与重试机制，防止请求过多被拦截。

## 🚀 安装与使用

### 安装

1.  确保您的浏览器已安装 **Tampermonkey** 扩展。
2.  [点击这里安装脚本](https://greasyfork.org/scripts/YOUR_SCRIPT_ID) (链接待替换为GreasyFork实际链接)。
3.  或者，将本项目中的 `bilibili_subtitle_downloader.user.js` 代码复制到 Tampermonkey 的新脚本中保存。

### 使用

1.  打开 Bilibili 个人空间页面的“视频”或“合集”列表，或者番剧/电影的列表页面。
2.  在页面右侧可以看到 **“下载字幕”** 的悬浮面板。
3.  **筛选视频**：在输入框中输入关键词（支持空格分隔多个关键词），点击“全选匹配”即可选中所有符合条件的视频。
4.  **选择格式**：在下拉菜单中选择需要的字幕格式（默认推荐 .md 格式）。
5.  **开始下载**：
    - **⚠️ 重要提示**：请先关闭浏览器的“下载前询问每个文件的保存位置”选项，否则会弹出大量保存对话框。
    - 点击 **“批量下载”** 按钮，脚本将自动处理并下载所有选中的字幕文件。

## ⚙️ 自动化发布流程

本项目配置了 GitHub Actions 以实现自动化的构建与发布流程：

1.  **自动构建**：
    - 当 `main` 分支有新的代码提交 (push) 时，GitHub Actions 会自动触发构建工作流。
    - 工作流会运行 `generate_metadata.py` 脚本，从 `bilibili_subtitle_downloader.user.js` 中提取元数据生成 `bilibili_subtitle_downloader.meta.js` 文件。

2.  **GreasyFork 同步**：
    - 构建成功后，工作流会自动将最新版本的脚本推送到 GreasyFork 平台。
    - **密钥配置**：
        - 需要在 GitHub 仓库的 `Settings` -> `Secrets and variables` -> `Actions` 中添加 `GREASYFORK_API_KEY`。
        - 确保脚本头部元数据的 `@version` 字段已更新，否则 GreasyFork 可能会拒绝更新。

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request 来改进本项目！

1.  **Fork** 本仓库。
2.  创建一个新的分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4.  推送到分支 (`git push origin feature/AmazingFeature`)。
5.  开启一个 **Pull Request**。

### 开发注意事项

- 修改代码时，请同步更新 `CHANGELOG.md` 记录变更内容。
- 保持代码风格一致，关键逻辑请添加中文注释。
- 在提交前请在本地进行充分测试，确保不破坏现有功能。

## 📜 许可证

本项目采用 [MIT License](LICENSE) 许可证。
