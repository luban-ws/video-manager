# RFC-0006: 文件系统操作模块

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0007  
**优先级**: P0 (核心功能)

## 摘要

实现完整的文件系统操作模块，支持 Markdown 文件的创建、读取、更新、删除和列表操作。

## 目标

1. 实现 Markdown 文件的 CRUD 操作
2. 支持目录遍历和文件列表
3. 安全的文件名处理
4. 完善的错误处理

## 详细执行计划

### 阶段 1: 基础文件操作

#### 步骤 1.1: 创建 filesystem.rs 模块
- [x] 创建 `src-tauri/src/filesystem.rs`
- [x] 定义 `FileInfo` 结构体
- [x] 导入必要的依赖

**结构体定义**:
```rust
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub metadata: VideoMetadata,
    pub is_directory: bool,
}
```

#### 步骤 1.2: 实现文件读取
- [x] 实现 `read_markdown_file` 函数
- [x] 读取文件内容
- [x] 调用 frontmatter 解析（见 RFC-0007）
- [x] 返回元数据和内容

**函数签名**:
```rust
pub fn read_markdown_file(file_path: &Path) -> Result<(VideoMetadata, String), String>
```

#### 步骤 1.3: 实现文件写入
- [x] 实现 `write_markdown_file` 函数
- [x] 调用 frontmatter 生成（见 RFC-0007）
- [x] 确保目录存在
- [x] 写入文件内容

**函数签名**:
```rust
pub fn write_markdown_file(
    file_path: &Path,
    metadata: &VideoMetadata,
    content: &str,
) -> Result<(), String>
```

#### 步骤 1.4: 实现文件创建
- [x] 实现 `create_markdown_file` 函数
- [x] 生成安全的文件名
- [x] 处理文件名冲突（添加时间戳）
- [x] 调用写入函数

**文件名生成**:
```rust
let safe_title = sanitize_filename(&metadata.title);
let file_name = format!("{}.md", safe_title);
```

#### 步骤 1.5: 实现文件删除
- [x] 实现 `delete_markdown_file` 函数
- [x] 验证文件存在
- [x] 删除文件
- [x] 错误处理

### 阶段 2: 目录操作

#### 步骤 2.1: 实现文件列表
- [x] 实现 `list_markdown_files` 函数
- [x] 读取目录内容
- [x] 过滤 Markdown 文件
- [x] 解析每个文件的 frontmatter
- [x] 返回文件信息列表

#### 步骤 2.2: 实现递归列表
- [x] 实现 `list_all_markdown_files` 函数
- [x] 使用 `walkdir` 递归遍历
- [x] 过滤 Markdown 文件
- [x] 解析 frontmatter

#### 步骤 2.3: 文件名清理
- [x] 实现 `sanitize_filename` 函数
- [x] 移除不安全字符
- [x] 处理特殊字符替换

**实现**:
```rust
fn sanitize_filename(name: &str) -> String {
    let re = Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
    re.replace_all(name, "_").to_string()
}
```

### 阶段 3: Tauri 命令封装

#### 步骤 3.1: 文件操作命令
- [x] `read_markdown_file`: 读取文件
- [x] `save_markdown_file`: 保存文件
- [x] `delete_markdown_file`: 删除文件
- [x] `list_files`: 列出目录文件

#### 步骤 3.2: 错误处理
- [x] 文件不存在错误
- [x] 权限错误
- [x] 解析错误
- [x] IO 错误

### 阶段 4: 测试验证

#### 步骤 4.1: 单元测试
- [ ] 测试文件读取
- [ ] 测试文件写入
- [ ] 测试文件创建
- [ ] 测试文件删除
- [ ] 测试文件列表
- [ ] 测试文件名清理

#### 步骤 4.2: 集成测试
- [ ] 测试完整 CRUD 流程
- [ ] 测试并发操作
- [ ] 测试错误恢复

## 技术实现细节

### 依赖项

**Rust**:
- `walkdir`: 2.4 (目录遍历)
- `regex`: 1.10 (文件名清理)

### 文件变更

**新增文件**:
- `src-tauri/src/filesystem.rs`

**修改文件**:
- `src-tauri/src/commands.rs`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`

### API 接口

```typescript
// 前端调用
invoke("read_markdown_file", { filePath: string }): Promise<VideoDocument>
invoke("save_markdown_file", {
  filePath: string,
  metadata: VideoMetadata,
  content: string
}): Promise<void>
invoke("delete_markdown_file", { filePath: string }): Promise<void>
invoke("list_files", { dirPath: string }): Promise<FileInfo[]>
```

### 错误处理策略

1. **文件不存在**: 返回明确的错误消息
2. **权限不足**: 提示用户检查权限
3. **解析失败**: 记录错误，跳过文件
4. **IO 错误**: 返回详细的错误信息

## 验收标准

1. ✅ 能够正确读取 Markdown 文件
2. ✅ 能够正确保存 Markdown 文件
3. ✅ 能够正确创建新文件
4. ✅ 能够正确删除文件
5. ✅ 能够列出目录中的文件
6. ✅ 文件名清理功能正常
7. ✅ 所有错误都有友好提示

## 已知问题

1. 大文件可能影响性能
2. 并发写入可能导致数据丢失

## 后续改进

1. 添加文件锁定机制
2. 支持文件变更监听
3. 添加文件缓存
4. 支持批量操作
5. 添加文件版本历史
