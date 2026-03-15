# RFC-0001: 视频管理器项目架构与设计规范

**状态**: 已实现  
**创建日期**: 2024-01-05  
**作者**: AI Assistant  
**版本**: 1.0

## 摘要

本文档详细说明了视频管理器（Video Manager）项目的整体架构、设计决策、功能规范和使用方式。该项目是一个基于 Tauri 的桌面应用，采用类似 Notion 的界面风格，专注于视频内容的管理和组织。已演进为支持多媒体库（Libraries）和便携 Sidecar 文件的本地视频库管理器。

## 目录

1. [项目概述](#项目概述)
2. [核心设计原则](#核心设计原则)
3. [架构设计](#架构设计)
4. [数据存储方案](#数据存储方案)
5. [功能规范](#功能规范)
6. [技术栈](#技术栈)
7. [文件结构规范](#文件结构规范)
8. [API 规范](#api-规范)
9. [用户工作流](#用户工作流)
10. [未来扩展](#未来扩展)
11. [相关 RFC](#相关-rfc)

## 相关 RFC

本项目的功能已拆分为多个详细的 RFC 文档，每个 RFC 包含完整的执行计划：

### 核心功能 (P0)
- [RFC-0002: 工作目录初始化](./0002-workspace-initialization.md)
- [RFC-0003: Markdown 编辑器](./0003-markdown-editor.md)
- [RFC-0004: 图片粘贴功能](./0004-image-paste.md)
- [RFC-0005: 视频信息提取](./0005-video-extraction.md)
- [RFC-0006: 文件系统操作](./0006-filesystem-operations.md)
- [RFC-0007: Frontmatter 处理](./0007-frontmatter-processing.md)

### 重要功能 (P1)
- [RFC-0008: 文件夹树组件](./0008-folder-tree.md)
- [RFC-0009: 搜索功能](./0009-search-functionality.md)

### 增强功能 (P2)
- [RFC-0010: Git 版本控制集成](./0010-git-integration.md)
- [RFC-0011: 本地视频库与便携 Sidecar 架构](./0011-local-video-library.md)

**完整 RFC 索引**: 参见 [RFC README](./README.md)

---

## 项目概述

### 目标

构建一个类似 Notion 的视频管理应用，具备以下核心特性：

1. **基于文件的存储**：使用 Markdown 文件而非数据库存储内容
2. **视频信息提取**：从 YouTube、Vimeo 等平台提取视频元数据
3. **Markdown 编辑**：提供实时预览的 Markdown 编辑器
4. **文件夹组织**：通过文件系统组织文档
5. **标签管理**：基于 frontmatter 的标签系统
6. **全文搜索**：搜索文件标题、内容和标签
7. **Git 版本控制**：支持 Git 操作进行版本管理
8. **便携式架构**：缩略图和元数据作为 base64 直接嵌入到 Markdown frontmatter 中，无需外部资源文件

### 核心价值

- **可移植性**：所有数据以 Markdown 文件形式存储，易于备份和迁移
- **版本控制友好**：文件系统结构天然支持 Git
- **离线优先**：所有内容本地存储，支持离线使用
- **可扩展性**：基于文件系统，易于扩展和集成其他工具

---

## 核心设计原则

### 1. 文件优先（File-First）

- 每个视频条目对应一个独立的 Markdown 文件
- 不使用数据库，所有数据存储在文件系统中
- 文件可以直接用任何文本编辑器打开和编辑

### 2. 便携式 Sidecar 架构

- 每个视频文件（如 `.mp4`）旁边对应生成一个同名的 Markdown 文件（如 `.md`）
- 缩略图通过 FFmpeg 提取后，以 Base64 Data URI 格式直接嵌入 frontmatter，消除对分离 `images/` 目录的依赖
- 确保单个 Markdown 文件的绝对可移植性

### 3. 自包含文档

- 每个 Markdown 文件包含完整的视频信息和用户笔记
- Frontmatter 存储元数据，Markdown 内容存储笔记
- 文档可以独立存在，不依赖外部数据库

### 4. 资料库 (Libraries) 管理

- 用户可以选择多个本地文件夹作为资料库 (Libraries)
- 应用自动递归扫描资料库中的视频文件并生成对应的 `.md` Sidecar 文件
- 资料库路径保存在 localStorage 中

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Editor  │  │  Tree    │  │  Search  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
                      │
                      │ Tauri IPC
                      ▼
┌─────────────────────────────────────────────────┐
│           Backend (Rust/Tauri)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Commands  │  │FileSystem│  │   Git    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
                      │
                      │ File I/O
                      ▼
┌─────────────────────────────────────────────────┐
│         File System (User's Vision Base)        │
│  ├── video-1.md                                 │
│  ├── video-2.md                                 │
│  ├── images/                                    │
│  │   └── pasted-image-xxx.png                   │
│  └── subfolder/                                 │
│      ├── video-3.md                             │
│      └── images/                                │
└─────────────────────────────────────────────────┘
```

### 模块划分

#### 前端模块

1. **App.tsx**: 主应用组件，管理全局状态和路由
2. **LibrarySidebar.tsx**: 侧边栏，管理多个资料库及扫描操作
3. **VideoGallery.tsx**: 视频瀑布流画廊视图
4. **MarkdownEditor.tsx**: Markdown 编辑器组件，处理编辑和内联播放
5. **SearchBar.tsx**: 搜索栏组件，提供全文搜索功能
6. **VideoInput.tsx**: 视频输入组件，处理远程视频链接输入
7. **ResizableSplitter.tsx**: 可调整大小的分隔条组件，实现类似 Notion 的左右分栏布局

#### 后端模块

1. **commands.rs**: Tauri 命令定义，前端调用的所有 API
2. **scanner.rs**: 自动扫描并生成视频 Sidecar
3. **native_video.rs**: 使用 `ffmpeg-next` 提取本地视频元数据和缩略图
4. **filesystem.rs**: 文件系统操作，读写 Markdown 文件
5. **frontmatter.rs**: Frontmatter 解析和生成
6. **video.rs**: 在线网络视频信息提取
7. **search.rs**: 全文搜索功能
8. **git.rs**: Git 操作封装

---

## 数据存储方案

### Markdown 文件格式

每个视频条目存储为一个 Markdown 文件，格式如下：

```markdown
---
source_type: "local"
title: "视频标题"
video_filename: "video.mp4"
thumbnail: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/..."
duration: 3600
width: 1920
height: 1080
fps: 60
codec: "h264"
file_size: 104857600
tags: ["编程", "教程", "React"]
description: "视频描述（可选）"
created_at: "2024-01-05T10:00:00Z"
updated_at: "2024-01-05T10:00:00Z"
---

# 视频标题

## 视频信息
- **平台**: YouTube
- **链接**: [观看视频](https://youtube.com/watch?v=xxx)
- **时长**: 1:00:00

## 笔记
在这里添加你的笔记、想法、总结等...

![图片](./images/pasted-image-1704441234.png)
```

### Frontmatter 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `title` | String | 是 | 视频标题 |
| `url` | String | 是 | 视频链接 |
| `platform` | String | 是 | 平台名称（YouTube, Vimeo 等） |
| `thumbnail` | String? | 否 | 缩略图 URL |
| `duration` | Integer? | 否 | 视频时长（秒） |
| `tags` | Array[String] | 否 | 标签列表 |
| `description` | String? | 否 | 视频描述 |
| `created_at` | String | 是 | 创建时间（RFC3339） |
| `updated_at` | String | 是 | 更新时间（RFC3339） |

### 文件组织

```
vision-base/                    # 用户选择的工作目录
├── video-1.md                  # 视频文档
├── video-2.md
├── images/                     # 全局图片文件夹（可选）
│   └── image.png
├── subfolder/                  # 子文件夹
│   ├── video-3.md
│   └── images/                 # 每个文档的图片文件夹
│       └── pasted-image-xxx.png
└── .git/                       # Git 仓库（可选）
```

### 图片及缩略图存储规则

1. **便携缩略图**：不使用外部图片文件。视频预览缩略图提取后直接使用 Base64 Data URI 保存到 Markdown 文件的 `thumbnail` frontmatter。
2. **便携性**：确保移动 `.mp4` 和 `.md` 文件时没有任何丢失依赖的情况。

---

## 功能规范

### 1. 资料库扫描 (Local Library Scanner)

**触发时机**：
- 用户点击资料库中的"扫描"按钮
- 后续可扩展背景自动监控 (利用 `notify` crate)

**流程**：
1. 递归扫描指定目录后缀为视频格式的文件
2. 为尚未具有同名 `.md` 文件的视频执行 `ffmpeg-next` 解码
3. 从视频帧中提取缩略视频帧，并调整尺寸压缩存为 Base64
4. 基于视频数据预填充 frontmatter 并生成 Sidecar `.md` 文件
5. 向前端触发 `scan-progress` 事件，更新 UI 进度条

### 2. 视频信息提取 (网络视频)

**输入**：视频 URL（YouTube, Vimeo, Bilibili 等）

**流程**：
1. 从网页提取内容信息 (主要针对未来扩展或兼容用途，主要重心现为本地库管理)
2. 生成 Markdown 文件模板
3. 保存到指定的资料库中
5. 自动打开新创建的文件

**错误处理**：
- 提取失败或网络错误：显示错误信息
- 无效 URL：提示用户检查链接

### 3. Markdown 编辑

**功能**：
- 实时预览编辑
- 语法高亮
- 工具栏支持
- 图片粘贴处理

**图片粘贴流程**：
1. 监听粘贴事件
2. 检测剪贴板中的图片
3. 读取图片数据
4. 调用后端保存图片
5. 在光标位置插入图片 Markdown 语法

### 4. 搜索功能

**搜索范围**：
- 文件标题（frontmatter.title）
- 文件描述（frontmatter.description）
- 标签（frontmatter.tags）
- 文件内容（Markdown 正文）

**搜索方式**：
- 全文搜索：搜索所有字段
- 标签搜索：按标签过滤
- 实时搜索：输入时即时显示结果

### 5. Git 版本控制

**支持的操作**：
- `git_init`: 初始化 Git 仓库
- `git_add`: 添加文件到暂存区
- `git_commit`: 提交更改
- `git_status`: 查看状态
- `git_history`: 查看提交历史

**使用场景**：
- 用户可以在工作目录初始化 Git 仓库
- 定期提交更改，跟踪历史
- 支持版本回滚和协作

---

## UI 布局设计

### 整体布局结构

应用采用类似 Notion 的左右分栏布局：

```
┌─────────────────────────────────────────────────┐
│              顶部栏 (固定)                      │
│  [标题] [设置目录] [当前资料库]                 │
│  [搜索栏]                                       │
│  [扫描所有文档] [提取外部链接]                  │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│  资料库侧边栏│        画廊 / Markdown 编辑器     │
│  (可调整)    │        (自适应)                    │
│              │                                   │
│              │                                   │
│              │                                   │
│              │                                   │
└──────────────┴──────────────────────────────────┘
```

### 布局特性

1. **可调整大小的分隔条**
   - 左侧文件夹树面板宽度可调整（200px - 600px）
   - 拖拽分隔条调整宽度
   - 宽度设置自动保存到 localStorage
   - 分隔条悬停时高亮显示

2. **响应式设计**
   - 左侧面板：固定宽度（可调整）
   - 右侧编辑器：自适应剩余空间
   - 最小宽度限制确保可用性

3. **视觉反馈**
   - 分隔条拖拽时显示视觉指示器
   - 平滑的过渡动画
   - 清晰的边界区分

### 组件层次

```
App
├── FolderSelectDialog (模态对话框)
├── Header (顶部栏)
│   ├── 标题和设置按钮
│   ├── SearchBar
│   └── VideoInput
└── ResizableSplitter
    ├── Left Panel (资料库侧边栏)
    │   └── LibrarySidebar
    └── Right Panel (主要视图)
        └── VideoGallery / MarkdownEditor
```

---

## 技术栈

### 前端

- **框架**: React 18 + TypeScript
- **UI 库**: Tailwind CSS
- **Markdown 编辑器**: @uiw/react-md-editor
- **状态管理**: React Hooks (useState, useEffect)
- **构建工具**: Vite

### 后端

- **框架**: Tauri 2.0
- **语言**: Rust
- **依赖**:
  - `serde` / `serde_json` / `serde_yaml`: 序列化
  - `git2`: Git 操作
  - `regex`: 正则表达式
  - `walkdir`: 目录遍历
  - `chrono`: 时间处理

### 外部工具库

- **ffmpeg-next**: 原生 Rust FFI 绑定 FFmpeg，用于本地视频信息与内联首帧提取
- (已移除依赖 `yt-dlp` 进行核心本地提取)

---

## 文件结构规范

### 项目目录结构

```
video-manager/
├── docs/                        # 文档目录
│   └── RFC-0001.md             # 本文档
├── src/                         # 前端源码
│   ├── components/             # React 组件
│   │   ├── LibrarySidebar.tsx  # 资料库侧边栏
│   │   ├── VideoGallery.tsx    # 视频画廊组件
│   │   ├── MarkdownEditor.tsx
│   │   ├── ResizableSplitter.tsx
│   │   ├── SearchBar.tsx
│   │   └── VideoInput.tsx
│   ├── App.tsx                 # 主应用
│   ├── main.tsx                # 入口文件
│   └── styles.css              # 样式文件
├── src-tauri/                  # 后端源码
│   ├── src/
│   │   ├── commands.rs         # Tauri 命令
│   │   ├── scanner.rs          # 自动化后台扫描器
│   │   ├── native_video.rs     # ffmpeg 本地提取
│   │   ├── filesystem.rs       # 文件系统操作
│   │   ├── frontmatter.rs      # Frontmatter 处理
│   │   ├── video.rs            # 视频处理
│   │   ├── search.rs           # 搜索功能
│   │   ├── git.rs              # Git 操作
│   │   └── main.rs             # 入口文件
│   ├── Cargo.toml              # Rust 依赖
│   └── tauri.conf.json         # Tauri 配置
├── package.json                # Node.js 依赖
├── README.md                   # 项目说明
└── USAGE.md                    # 使用指南
```

---

## API 规范

### Tauri 命令列表

#### 文件操作

- `extract_video_and_create_file(url, base_dir)`: 提取视频信息并创建文件
- `read_markdown_file(file_path)`: 读取 Markdown 文件
- `save_markdown_file(file_path, metadata, content)`: 保存 Markdown 文件
- `delete_markdown_file(file_path)`: 删除 Markdown 文件
- `list_files(dir_path)`: 列出目录中的文件

#### 搜索操作

- `search_files(base_dir, query, search_in_content)`: 全文搜索
- `search_by_tags(base_dir, tags)`: 按标签搜索
- `get_all_tags(base_dir)`: 获取所有标签

#### 图片操作

- `save_pasted_image(base_dir, file_path, image_data, image_name)`: 保存粘贴的图片

#### 目录操作

- `is_directory_empty(dir_path)`: 检查目录是否为空
- `create_directory(parent_path, folder_name)`: 创建新目录

#### Git 操作

- `git_init(repo_path)`: 初始化 Git 仓库
- `git_add(repo_path, file_path)`: 添加文件到暂存区
- `git_commit(repo_path, message, author_name, author_email)`: 提交更改
- `git_status(repo_path)`: 获取仓库状态
- `git_history(repo_path, limit)`: 获取提交历史

---

## 用户工作流

### 首次使用与资料库添加

1. 启动应用
2. 点击 "+ 添加" 创建或引入你的本地视频目录到侧边栏
3. 应用会自动对新资料库执行扫描，为目录中的 MP4 及相关格式生成 MD Sidecar，以瀑布流展示
4. 点击视频条目开始浏览和编辑笔记

### 编辑文档

1. 在视频画廊 `VideoGallery` 中点击某个条目
2. 在右侧 `MarkdownEditor` 编辑器中编辑笔记并查看视频播放
3. 可以随时保存更改或返回画廊视图

### 搜索内容

1. 在搜索栏输入关键词
2. 实时显示搜索结果
3. 点击结果打开对应文件

### 版本控制

1. 在工作目录初始化 Git 仓库
2. 编辑文件后，使用 Git 命令提交
3. 查看提交历史

---

## 未来扩展

### 计划中的功能

1. **标签管理界面**：可视化标签编辑和管理
2. **批量操作**：批量添加标签、移动文件等
3. **导出功能**：导出为 PDF、HTML 等格式
4. **模板系统**：自定义 Markdown 模板
5. **插件系统**：支持自定义扩展
6. **同步功能**：与云存储同步（GitHub, GitLab 等）
7. **视频下载**：集成视频下载功能
8. **本地视频播放**：支持播放本地视频文件

### 技术改进

1. **性能优化**：大文件搜索优化
2. **缓存机制**：文件列表缓存
3. **增量更新**：文件变更监听
4. **错误恢复**：自动备份和恢复

---

## 附录

### A. 依赖要求

- Node.js >= 18
- Rust (最新稳定版)
- libavutil / ffmpeg 核心运行库

### B. 配置文件

- `package.json`: Node.js 依赖
- `Cargo.toml`: Rust 依赖
- `tauri.conf.json`: Tauri 配置
- `tailwind.config.js`: Tailwind 配置

### C. 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)
- [Markdown 规范](https://daringfireball.net/projects/markdown/)

---

## 变更日志

- **2024-01-05**: 初始版本，完成核心功能实现

---

**文档维护**: 本文档应随项目演进持续更新。
