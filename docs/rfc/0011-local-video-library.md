# RFC-0011: 本地视频库管理 (Portable Sidecar 架构)

**状态**: 已实现  
**创建日期**: 2026-03-15  
**依赖**: RFC-0006, RFC-0007  
**优先级**: P0 (核心功能重构)

## 摘要

将应用从"视频链接笔记工具"升级为支持**本地视频库管理**的应用，采用 **Portable Sidecar (便携式伴随文件)** 架构。

用户添加本地文件夹作为"视频库"后，应用自动扫描视频文件，使用 FFmpeg 提取元数据（时长、分辨率、编码等）和缩略图，并**在视频文件所在目录**直接生成同名的 `.md` 文件。

为了追求极致的**便携性 (Portability)**，提取的缩略图将直接转换为 **Base64** 格式嵌入在 Markdown 文件的 frontmatter 中。这意味着每个视频只需要一个配套的 `.md` 文件，不会产生额外的图片文件或文件夹。用户无论如何移动、备份或分享文件夹，只要视频和 `.md` 在一起，数据就不会丢失或断链。

彻底去除对外部 `yt-dlp` 的依赖用于本地文件处理，改为纯 Rust + FFmpeg 实现。

## 核心设计原则

### 1. 极致便携的 Sidecar 存储

所有由应用生成的数据（Markdown 笔记、提取的缩略图、元数据）都**完全保存在同名的 `.md` 文件内部**。缩略图直接以 **Base64 (Data URI)** 格式存入 Markdown 的 frontmatter 中，不创建单独的图片文件。

```
用户视频文件夹:
  ~/Movies/Documentaries/
    planet-earth.mp4          ← 原始视频文件 (用户拥有)
    planet-earth.md           ← Sidecar: 包含元数据、Base64 缩略图、标签、笔记
```

### 2. "库" (Library) 只是一个书签

应用仍然支持多"库"管理（比如"纪录片"指向 `~/Movies/Documentaries`，"教程"指向 `~/Downloads/Tutorials`）。但**库的定义只是一条路径记录**，真正的数据全在路径本身。

### 3. 元数据全部来自 FFmpeg

不依赖外部工具。`ffmpeg-next` 已在 `Cargo.toml` 中，直接用于：
- 读取时长、分辨率、编码格式、帧率、文件大小
- 提取视频缩略图（第 2 秒处的一帧），并直接在内存中转换为 `data:image/jpeg;base64,...` 字符串。

### 4. 增量扫描与关联

- **扫描机制**: 当应用打开一个库目录时，递归地 (Recursive) 遍历所有支持的视频文件。
- **视图展示**: `VideoGallery` 应该递归地展示库中的所有视频记录，而不仅仅是顶层文件，以支持复杂的文件夹结构。
- **匹配机制**: 寻找同名 `.md` 文件。
  - 如果不存在: 使用 FFmpeg 提取元数据和缩略图，创建预填充的 `.md` 文件。
  - 如果存在: 读取现有的 `.md` 文件作为笔记和缓存的元数据展示。

## 数据模型

### 视频伴随文件 ({video_name}.md)

```markdown
---
source_type: "local"
title: "Planet Earth"
video_filename: "planet-earth.mp4"
thumbnail: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDA..."
duration: 3480
width: 1920
height: 1080
fps: 24.0
codec: "h264"
file_size: 2147483648
created_at: "2026-03-15T09:01:00Z"
updated_at: "2026-03-15T09:01:00Z"
tags: ["纪录片", "自然"]
---

## 笔记

在这里添加笔记...
```

### Frontmatter 字段说明

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `source_type` | String | 应用 | 固定为 "local" 区分在线 URL |
| `title` | String | 用户/文件名 | 默认取文件名，可编辑 |
| `video_filename` | String | 文件系统 | 视频文件名 |
| `thumbnail` | String | FFmpeg | 提取的缩略图 (Base64 Data URI) |
| `duration` | Integer | FFmpeg | 时长（秒） |
| `width` | Integer | FFmpeg | 视频宽度 |
| `height` | Integer | FFmpeg | 视频高度 |
| `fps` | Float | FFmpeg | 帧率 |
| `codec` | String | FFmpeg | 视频编码 |
| `file_size` | Integer | 文件系统 | 字节数 |
| `tags` | Array[String] | 用户 | 标签 |

## 架构梳理

### 现有工作区模式 vs 本地库模式

当前系统依赖单一的 `baseDir` 并在其中搜索 `.md` 文件。新架构将通过**多库**和**自动伴随文件生成**来扩展此模式。

```
前端:
  LibrarySidebar（左侧）
    ├── 工作区 (当前 baseDir，兼容已有行为)
    ├── 库 A (/Movies/Action)  [32 视频]
    ├── 库 B (/Downloads/Tutorials)  [15 视频]
    └── + 添加文件夹...

  VideoGallery（主区域，取代简单的搜索结果列表）
    └─ 网格视图展示视频（读取 .md frontmatter 和 Base64 缩略图）
  
  VideoDetail（右侧面板 / 新页面）
    └─ 内嵌播放器 (video.js) 结合 Markdown 笔记编辑器
```

## 详细执行计划

### 阶段 1: Rust 后端 - FFmpeg 增强与 Sidecar 生成

#### 步骤 1.1: 扩展 `native_video.rs`
扩展现有的 `get_video_info`。实现提取特征帧（缩略图）并在内存中直接转换为 JPEG Base64 字符串的功能。

```rust
pub struct LocalVideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub file_size: u64,
    pub thumbnail_base64: Option<String>,
}

// 提取第 2 秒的帧并返回 base64 字符串 (data:image/jpeg;base64,...)
pub fn extract_metadata_and_thumbnail(video_path: &Path) -> Result<LocalVideoMetadata, String>
```

#### 步骤 1.2: 实现 Sidecar 生成逻辑 (`scanner.rs`)
遍历给定目录，寻找 `.mp4`, `.mkv` 等视频文件。如果发现 `video.mp4` 但没有 `video.md`，则触发 FFmpeg 提取元数据和 Base64 缩略图，创建初始的 `video.md` 文件。

```rust
// 扫描目录并补全缺失的 sidecar .md 文件
pub async fn scan_and_generate_sidecars(dir_path: &Path, app: AppHandle) -> Result<ScanReport, String>
```

### 阶段 2: 前端 - 改进的视频库视图

#### 步骤 2.1: UI 组件升级
1. `FolderTree.tsx` 重构为允许选中顶级文件夹(库)。
2. 增加 `VideoGallery.tsx`：当选中一个文件夹时，展示带缩略图的视频网格（解析目录下的所有 `.md`并使用 frontmatter 中的 Data URI 渲染图片）。

#### 步骤 2.2: 播放与编辑整合
当在网格中点击一个视频项时，打开当前的 `MarkdownEditor.tsx`。编辑器可以同时加载视频路径到播放器，加载 MD 内容到编辑器。

### 阶段 3: 性能与用户体验保障

由于 FFmpeg 提取需要时间，当引入包含大量新视频的文件夹时，需提供后台进度提示，防止 UI 阻塞。

```rust
// Tauri 事件: 扫描进度
#[derive(Clone, serde::Serialize)]
struct ScanProgress {
    total_videos: usize,
    processed: usize,
    current_file: String,
}
```

### 阶段 4: 全局状态编排 (Global Scanning Orchestration)

为了确保用户体验的一致性，扫描状态（`ScanProgress`）不应局限于某个侧边栏组件。扫描逻辑已从 `LibrarySidebar` 提升（Lifted）到根组件 `App.tsx`。

1.  **统一状态**: `App.tsx` 维护扫描进度并监听 Tauri `scan-progress` 事件。
2.  **统一下发**: 通过 `onScanRequest` 回调将扫描功能下发给 `LibrarySidebar` 和 `VideoGallery`。
3.  **多点触发**: 无论是侧边栏的刷新图标，还是主面板的"查找新视频"按钮，均操作同一全局扫描流，确保进度条展示同步。

## 验收标准

1. [ ] 用户可以选择本地文件夹作为资源库。
2. [ ] 应用扫描该文件夹，发现无对应 `.md` 的视频文件时，自动使用 FFmpeg 提取时长、分辨率、编码。
3. [ ] 自动提取缩略图，将其转换为 Base64，并在视频同级创建同名 `.md`，缩略图嵌入在 frontmatter 中。
4. [ ] 移动带有视频和MD的文件夹到新电脑或新路径，一切关联依然有效，缩略图也能正常显示（高便携性）。
5. [ ] UI 提供可视化的视频网格展示，使用 Base64 缩略图渲染。
6. [ ] 本地视频处理全程不依赖 yt-dlp。

## 已知问题与应对策略

1. **只读文件夹/无权限**: 如果用户添加了外接硬盘中的只读文件夹，无法写入 `.md`。
   *应对*: 捕获写权限错误，前端给予友好提示，或降级为不保存笔记的"仅浏览"模式。
2. **MD 文件体积变大**: Base64 会使 `.md` 文件大小增加几十 KB。
   *应对*: 缩略图应该使用高压缩率的小尺寸 JPEG（例如 `320x180`，质量 `60%`），将文件大小控制在 10-20KB 左右，这样不会影响 Markdown 渲染性能，且完全满足网格预览需求。
3. **扫描性能**: 包含数百个无 Sidecar 视频的文件夹首次扫描会较慢。
   *应对*: 后台异步执行生成任务，优先分析用户当前可视范围的文件。

## 后续改进 (超出本 RFC 范围)

1. **文件变更监听**: 结合 `notify` crate 在文件夹激活期间监听新增删除文件，做到无需手动刷新的体验。应支持递归监听 (Recursive Mode)，并对文件操作进行必要的防抖 (Debounce) 处理，以应对大文件写入。
2. **清理孤立的 Sidecar**: 如果视频被外部删除了，提供检测清理对应 `.md` 的工具。
3. **相对路径支持**: 确保 `.md` 文件中记录的视频文件名仅为相对路径，以维持 sidecar 的极高便携性。
