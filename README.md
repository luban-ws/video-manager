# 视频管理器

一个类似 Notion 的视频管理应用，基于 Tauri 构建，使用 Markdown 文件存储，支持 Git 版本控制。

> 📖 **详细设计文档**: 请参阅 [RFC-0001: 项目架构与设计规范](./docs/rfc/0001-architecture.md)  
> 🔧 **Tauri 开发指南**: 请参阅 [Tauri 2.0 开发指南](./docs/TAURI_GUIDE.md)

## 功能特性

- ✅ **基于文件的存储**：每个视频条目存储为独立的 Markdown 文件
- ✅ **Markdown 编辑器**：使用 `@uiw/react-md-editor` 提供实时预览编辑
- ✅ **视频信息提取**：从 YouTube、Vimeo 等平台提取视频元数据
- ✅ **文件夹树管理**：通过文件系统组织文档
- ✅ **标签系统**：在 frontmatter 中管理标签
- ✅ **全文搜索**：搜索文件标题、内容和标签
- ✅ **Git 版本控制**：支持 Git 操作（初始化、提交、查看历史）
- ✅ **打开视频链接**：在默认浏览器中打开视频

## 前置要求

1. **Node.js** (v18 或更高版本)
2. **Rust** (最新稳定版)
3. **yt-dlp** - 用于提取视频元数据

### 安装 yt-dlp

**macOS:**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo pip install yt-dlp
# 或
sudo apt install yt-dlp
```

**Windows:**
```bash
pip install yt-dlp
```

## 安装和运行

1. 安装依赖：
```bash
npm install
# 或使用 pnpm
pnpm install
```

2. 开发模式运行：
```bash
# 推荐方式：使用 Tauri 命令（会自动启动 Vite）
pnpm tauri:dev
# 或
npm run tauri:dev

# 或者直接使用 Tauri CLI
pnpm tauri dev
# 或
npm run tauri dev

# 如果只想启动 Vite 开发服务器（不启动 Tauri 窗口）
pnpm dev
# 或
npm run dev
```

3. 构建应用：
```bash
npm run tauri build
```

## 使用说明

### 基本工作流

1. **设置工作目录**：首次使用时，点击"设置目录"选择存储 Markdown 文件的文件夹
2. **添加视频**：在顶部输入框粘贴视频链接，点击"提取"按钮
3. **编辑文档**：提取后会自动创建 Markdown 文件并打开编辑器，可以添加笔记、想法等
4. **搜索文件**：使用搜索栏快速查找文件（支持标题、内容、标签搜索）
5. **文件夹管理**：在左侧文件夹树中浏览和组织文件

### Markdown 文件格式

每个视频条目存储为 Markdown 文件，包含 YAML frontmatter：

```markdown
---
title: "视频标题"
url: "https://youtube.com/watch?v=xxx"
platform: "YouTube"
thumbnail: "https://..."
duration: 3600
tags: ["编程", "教程"]
description: "视频描述"
created_at: "2024-01-05T10:00:00Z"
updated_at: "2024-01-05T10:00:00Z"
---

# 视频标题

## 视频信息
- **平台**: YouTube
- **链接**: [观看视频](https://youtube.com/watch?v=xxx)

## 笔记
在这里添加你的笔记、想法、总结等...
```

### Git 版本控制

1. **初始化仓库**：在工作目录中初始化 Git 仓库
2. **提交更改**：使用 Git 命令提交文件更改
3. **查看历史**：查看提交历史记录

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **Markdown 编辑器**: @uiw/react-md-editor
- **后端**: Rust (Tauri)
- **文件系统**: Tauri File System Plugin
- **Git 集成**: git2-rs
- **视频处理**: yt-dlp
- **Frontmatter 解析**: serde-yaml

## 项目结构

```
video-manager/
├── src/                      # React 前端代码
│   ├── components/
│   │   ├── FolderTree.tsx    # 文件夹树组件
│   │   ├── MarkdownEditor.tsx # Markdown 编辑器
│   │   ├── SearchBar.tsx      # 搜索栏
│   │   └── VideoInput.tsx    # 视频输入组件
│   └── App.tsx               # 主应用组件
├── src-tauri/                # Rust 后端代码
│   ├── src/
│   │   ├── commands.rs       # Tauri 命令
│   │   ├── filesystem.rs     # 文件系统操作
│   │   ├── frontmatter.rs    # Frontmatter 解析
│   │   ├── search.rs         # 搜索功能
│   │   ├── git.rs            # Git 操作
│   │   └── video.rs          # 视频处理逻辑
│   └── Cargo.toml            # Rust 依赖
└── package.json              # Node.js 依赖
```

## 注意事项

- 确保在使用前已安装 `yt-dlp`
- 工作目录中的所有 Markdown 文件都会被索引和搜索
- 文件格式必须符合 frontmatter + Markdown 内容的结构
- 请遵守各视频平台的服务条款和版权法律
- Git 操作需要工作目录是 Git 仓库（或先初始化）

## 文档

- [RFC-0001: 项目架构与设计规范](./docs/rfc/0001-architecture.md) - 完整的架构设计、API 规范和使用指南
- [使用说明](./USAGE.md) - 快速开始和使用指南

## 许可证

MIT
