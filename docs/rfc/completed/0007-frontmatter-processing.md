# RFC-0007: Frontmatter 处理模块

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: 无  
**优先级**: P0 (核心功能)

## 摘要

实现 YAML frontmatter 的解析和生成功能，用于在 Markdown 文件中存储视频元数据。

## 目标

1. 解析 Markdown 文件中的 YAML frontmatter
2. 生成带 frontmatter 的 Markdown 内容
3. 处理时间戳更新
4. 支持可选字段

## 详细执行计划

### 阶段 1: 数据结构定义

#### 步骤 1.1: 定义 VideoMetadata 结构
- [x] 创建 `src-tauri/src/frontmatter.rs`
- [x] 定义 `VideoMetadata` 结构体
- [x] 使用 serde 进行序列化

**结构体定义**:
```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub title: String,
    pub url: String,
    pub platform: String,
    pub thumbnail: Option<String>,
    pub duration: Option<i64>,
    pub tags: Vec<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

#### 步骤 1.2: 字段验证
- [x] 必需字段：title, url, platform, created_at, updated_at
- [x] 可选字段：thumbnail, duration, tags, description
- [x] 使用 Option 类型处理可选字段

### 阶段 2: Frontmatter 解析

#### 步骤 2.1: 实现解析函数
- [x] 实现 `parse_markdown` 函数
- [x] 检测 frontmatter 分隔符 (`---`)
- [x] 提取 YAML 部分
- [x] 使用 serde_yaml 解析
- [x] 提取 Markdown 内容部分

**函数签名**:
```rust
pub fn parse_markdown(content: &str) -> Result<(VideoMetadata, String), String>
```

#### 步骤 2.2: 处理无 frontmatter 的情况
- [x] 检测文件是否包含 frontmatter
- [x] 如果没有，创建默认 metadata
- [x] 返回完整内容作为 Markdown

#### 步骤 2.3: 错误处理
- [x] YAML 解析错误
- [x] 格式错误
- [x] 缺失必需字段

### 阶段 3: Frontmatter 生成

#### 步骤 3.1: 实现生成函数
- [x] 实现 `generate_markdown` 函数
- [x] 将 metadata 序列化为 YAML
- [x] 组合 frontmatter 和内容
- [x] 确保格式正确

**函数签名**:
```rust
pub fn generate_markdown(metadata: &VideoMetadata, content: &str) -> Result<String, String>
```

#### 步骤 3.2: YAML 格式化
- [x] 使用 serde_yaml 序列化
- [x] 确保 YAML 格式正确
- [x] 处理特殊字符转义

### 阶段 4: 时间戳管理

#### 步骤 4.1: 实现时间戳更新
- [x] 实现 `update_timestamp` 函数
- [x] 使用 chrono 生成 RFC3339 格式时间
- [x] 更新 updated_at 字段

**实现**:
```rust
pub fn update_timestamp(metadata: &mut VideoMetadata) {
    metadata.updated_at = chrono::Utc::now().to_rfc3339();
}
```

#### 步骤 4.2: 创建时间处理
- [x] 新文件自动设置 created_at
- [x] 更新文件时保持 created_at 不变

### 阶段 5: 测试验证

#### 步骤 5.1: 解析测试
- [ ] 测试标准 frontmatter 解析
- [ ] 测试无 frontmatter 文件
- [ ] 测试缺失字段处理
- [ ] 测试特殊字符处理

#### 步骤 5.2: 生成测试
- [ ] 测试标准 metadata 生成
- [ ] 测试可选字段处理
- [ ] 测试 YAML 格式正确性

## 技术实现细节

### 依赖项

**Rust**:
- `serde`: 1.0 (序列化框架)
- `serde_yaml`: 0.9 (YAML 序列化)
- `chrono`: 0.4 (时间处理)

### 文件变更

**新增文件**:
- `src-tauri/src/frontmatter.rs`

**修改文件**:
- `src-tauri/src/filesystem.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/Cargo.toml`

### Frontmatter 格式

```yaml
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
```

## 验收标准

1. ✅ 能够正确解析标准 frontmatter
2. ✅ 能够处理无 frontmatter 的文件
3. ✅ 能够正确生成 frontmatter
4. ✅ 时间戳更新功能正常
5. ✅ 可选字段处理正确
6. ✅ 特殊字符转义正确

## 已知问题

1. 某些特殊 YAML 值可能需要转义
2. 大 frontmatter 可能影响解析性能

## 后续改进

1. 支持 frontmatter 验证
2. 支持自定义字段
3. 支持 frontmatter 模板
4. 添加 frontmatter 编辑器 UI
