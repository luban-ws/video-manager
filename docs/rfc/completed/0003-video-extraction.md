# RFC-0003: 视频信息提取功能

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0002, RFC-0005, RFC-0006  
**优先级**: P0 (核心功能)

## 摘要

实现从 YouTube、Vimeo 等视频平台提取视频元数据的功能，并自动创建包含视频信息的 Markdown 文件。

## 目标

1. 从视频 URL 提取元数据（标题、描述、缩略图、时长等）
2. 检测视频平台类型
3. 生成包含 frontmatter 的 Markdown 文件
4. 自动保存到工作目录
5. 创建后自动打开文件进行编辑

## 详细执行计划

### 阶段 1: 后端视频提取模块 (Rust)

#### 步骤 1.1: 创建 video.rs 模块
- [x] 创建 `src-tauri/src/video.rs`
- [x] 定义 `VideoInfo` 结构体
- [x] 实现 `detect_platform` 函数

**结构体定义**:
```rust
pub struct VideoInfo {
    pub url: String,
    pub title: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<i64>,
    pub platform: String,
}
```

#### 步骤 1.2: 实现 yt-dlp 集成
- [x] 检查 yt-dlp 是否安装
- [x] 调用 yt-dlp 提取 JSON 元数据
- [x] 解析 JSON 输出
- [x] 提取所需字段
- [x] 错误处理

**命令调用**:
```rust
Command::new("yt-dlp")
    .args(&["--dump-json", "--no-download", url])
    .output()
```

#### 步骤 1.3: 平台检测
- [x] 实现 URL 模式匹配
- [x] 支持 YouTube (youtube.com, youtu.be)
- [x] 支持 Vimeo
- [x] 支持 Bilibili
- [x] 默认"其他"平台

### 阶段 2: 文件创建命令

#### 步骤 2.1: 实现 extract_video_and_create_file 命令
- [x] 在 `commands.rs` 中实现命令
- [x] 调用 `video::extract_video_info` 提取信息
- [x] 创建 `VideoMetadata` 结构
- [x] 生成初始 Markdown 内容模板
- [x] 调用 `filesystem::create_markdown_file` 创建文件
- [x] 返回创建的文件信息

**命令签名**:
```rust
#[tauri::command]
pub async fn extract_video_and_create_file(
    url: String,
    base_dir: String,
    app: AppHandle,
) -> Result<VideoDocument, String>
```

#### 步骤 2.2: Markdown 模板生成
- [x] 生成包含视频信息的 Markdown 模板
- [x] 包含视频链接、平台、时长等信息
- [x] 预留笔记区域

**模板示例**:
```markdown
# {title}

## 视频信息
- **平台**: {platform}
- **链接**: [观看视频]({url})
- **时长**: {duration}
```

### 阶段 3: 前端集成

#### 步骤 3.1: 更新 VideoInput 组件
- [x] 添加 URL 输入框
- [x] 添加"提取"按钮
- [x] 添加"打开链接"按钮
- [x] 实现加载状态显示

#### 步骤 3.2: 实现提取流程
- [x] 验证 URL 格式
- [x] 调用 `extract_video_and_create_file` 命令
- [x] 处理成功响应
- [x] 自动打开新创建的文件
- [x] 可选：在浏览器中打开视频链接

#### 步骤 3.3: 错误处理
- [x] yt-dlp 未安装提示
- [x] 网络错误处理
- [x] 无效 URL 提示
- [x] 文件创建失败处理

### 阶段 4: 测试验证

#### 步骤 4.1: 功能测试
- [ ] 测试 YouTube URL 提取
- [ ] 测试 Vimeo URL 提取
- [ ] 测试 Bilibili URL 提取
- [ ] 测试无效 URL 处理
- [ ] 测试 yt-dlp 未安装情况
- [ ] 测试网络错误情况

#### 步骤 4.2: 数据验证
- [ ] 验证提取的元数据完整性
- [ ] 验证生成的 Markdown 格式
- [ ] 验证文件保存位置正确

## 技术实现细节

### 外部依赖

- **yt-dlp**: 需要系统安装
  - macOS: `brew install yt-dlp`
  - Linux: `sudo pip install yt-dlp`
  - Windows: `pip install yt-dlp`

### 文件变更

**修改文件**:
- `src-tauri/src/video.rs` (已存在)
- `src-tauri/src/commands.rs`
- `src/components/VideoInput.tsx`
- `src/App.tsx`

### API 接口

```typescript
// 前端调用
invoke("extract_video_and_create_file", {
  url: string,
  baseDir: string
}): Promise<VideoDocument>
```

### 错误处理策略

1. **yt-dlp 未安装**: 返回明确的错误消息，提示用户安装
2. **网络错误**: 捕获并显示友好的错误提示
3. **无效 URL**: 验证 URL 格式，提供具体错误信息
4. **解析失败**: 记录详细错误日志，返回通用错误消息

## 验收标准

1. ✅ 能够从 YouTube URL 提取完整元数据
2. ✅ 能够从 Vimeo URL 提取完整元数据
3. ✅ 正确检测视频平台类型
4. ✅ 生成的 Markdown 文件格式正确
5. ✅ 文件保存到正确的工作目录
6. ✅ 创建后自动打开文件
7. ✅ 所有错误情况都有友好提示

## 已知问题

1. 某些平台可能需要特殊处理（如需要登录）
2. yt-dlp 更新可能影响 API 兼容性

## 后续改进

1. 支持更多视频平台
2. 支持播放列表提取
3. 支持批量提取
4. 缓存提取的元数据
5. 支持自定义提取模板
