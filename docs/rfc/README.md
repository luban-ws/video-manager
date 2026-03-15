# RFC 文档索引

本文档列出了所有 RFC（Request for Comments）文档，用于跟踪项目功能的设计和实现。

## RFC 列表

### 核心功能 (P0)

- **[RFC-0001: 项目架构与设计规范](./0001-architecture.md)** - 整体架构设计
- **[RFC-0002: 工作目录初始化](./0002-workspace-initialization.md)** - 工作目录选择功能
- **[RFC-0003: Markdown 编辑器](./0003-markdown-editor.md)** - 编辑器功能
- **[RFC-0004: 图片粘贴功能](./0004-image-paste.md)** - 图片管理
- **[RFC-0005: 视频信息提取](./0005-video-extraction.md)** - 视频元数据提取
- **[RFC-0006: 文件系统操作](./0006-filesystem-operations.md)** - 文件 CRUD 操作
- **[RFC-0007: Frontmatter 处理](./0007-frontmatter-processing.md)** - YAML frontmatter 解析

### 重要功能 (P1)

- **[RFC-0008: 文件夹树组件](./0008-folder-tree.md)** - 文件树导航
- **[RFC-0009: 搜索功能](./0009-search-functionality.md)** - 全文搜索

### 增强功能 (P2)

- **[RFC-0010: Git 版本控制集成](./0010-git-integration.md)** - Git 操作

### 核心重构 (P0)

- **[RFC-0011: 本地视频库管理](./0011-local-video-library.md)** - 本地文件夹视频库，FFmpeg 元数据提取，文件监听自动同步

## RFC 状态说明

- **已实现**: 功能已完成并测试通过
- **进行中**: 功能正在开发
- **计划中**: 功能已规划但未开始
- **已废弃**: 功能已取消

## 如何使用 RFC

1. **阅读 RFC**: 了解功能的设计和实现计划
2. **执行计划**: 按照 RFC 中的详细执行计划实现功能
3. **更新状态**: 实现完成后更新 RFC 状态
4. **记录问题**: 在 RFC 中记录已知问题和后续改进

## 创建新 RFC

1. 复制模板（参考现有 RFC 格式）
2. 编号：使用下一个可用编号（如 0011）
3. 命名：`{编号}-{主题}.md`（如 `0011-new-feature.md`）
4. 填写完整信息：摘要、目标、执行计划等
5. 更新本 README

## RFC 模板结构

```markdown
# RFC-XXXX: 功能名称

**状态**: 计划中/进行中/已实现  
**创建日期**: YYYY-MM-DD  
**依赖**: RFC-XXXX, RFC-YYYY  
**优先级**: P0/P1/P2

## 摘要
简要描述功能

## 目标
列出功能目标

## 详细执行计划
分阶段列出实现步骤

## 技术实现细节
技术选型和实现细节

## 验收标准
功能验收标准

## 已知问题
已知问题和限制

## 后续改进
未来改进计划
```
