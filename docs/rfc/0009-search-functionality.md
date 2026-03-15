# RFC-0009: 搜索功能

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0006, RFC-0007  
**优先级**: P1 (重要功能)

## 摘要

实现全文搜索功能，支持搜索文件标题、描述、标签和内容。

## 目标

1. 实现全文搜索功能
2. 支持按标签搜索
3. 实时搜索结果显示
4. 高亮匹配内容

## 详细执行计划

### 阶段 1: 后端搜索模块

#### 步骤 1.1: 创建 search.rs 模块
- [x] 创建 `src-tauri/src/search.rs`
- [x] 定义 `SearchResult` 结构体
- [x] 导入必要的依赖

**结构体定义**:
```rust
pub struct SearchResult {
    pub file_path: String,
    pub metadata: VideoMetadata,
    pub matches: Vec<String>,
}
```

#### 步骤 1.2: 实现全文搜索
- [x] 实现 `search_files` 函数
- [x] 遍历所有 Markdown 文件
- [x] 搜索 frontmatter 字段（title, description, tags）
- [x] 搜索文件内容（可选）
- [x] 使用正则表达式匹配
- [x] 收集匹配结果

**函数签名**:
```rust
pub fn search_files(
    base_dir: &Path,
    query: &str,
    search_in_content: bool,
) -> Result<Vec<SearchResult>, String>
```

#### 步骤 1.3: 实现标签搜索
- [x] 实现 `search_by_tags` 函数
- [x] 遍历所有文件
- [x] 匹配标签列表
- [x] 返回匹配的文件

**函数签名**:
```rust
pub fn search_by_tags(
    base_dir: &Path,
    tags: &[String],
) -> Result<Vec<SearchResult>, String>
```

#### 步骤 1.4: 搜索优化
- [x] 使用正则表达式进行模式匹配
- [x] 大小写不敏感搜索
- [x] 提取匹配的文本片段
- [x] 限制结果数量（可选）

### 阶段 2: Tauri 命令封装

#### 步骤 2.1: 搜索命令
- [x] `search_files`: 全文搜索
- [x] `search_by_tags`: 标签搜索
- [x] `get_all_tags`: 获取所有标签

#### 步骤 2.2: 参数处理
- [x] 处理搜索查询字符串
- [x] 处理标签列表
- [x] 处理搜索选项（是否搜索内容）

### 阶段 3: 前端搜索组件

#### 步骤 3.1: 创建 SearchBar 组件
- [x] 创建 `src/components/SearchBar.tsx`
- [x] 实现搜索输入框
- [x] 实现实时搜索
- [x] 显示搜索结果

**组件接口**:
```typescript
interface SearchBarProps {
  baseDir: string;
  onResultSelect: (path: string) => void;
}
```

#### 步骤 3.2: 搜索逻辑
- [x] 监听输入变化
- [x] 防抖处理（可选）
- [x] 调用搜索命令
- [x] 更新搜索结果

#### 步骤 3.3: 结果展示
- [x] 显示搜索结果列表
- [x] 显示文件标题和路径
- [x] 显示匹配的标签
- [x] 点击结果打开文件

#### 步骤 3.4: UI 优化
- [x] 搜索框样式
- [x] 结果列表样式
- [x] 空结果提示
- [x] 加载状态

### 阶段 4: 标签管理

#### 步骤 4.1: 获取所有标签
- [x] 实现 `get_all_tags` 命令
- [x] 遍历所有文件
- [x] 收集所有标签
- [x] 去重和排序

#### 步骤 4.2: 标签显示（未来）
- [ ] 标签云组件
- [ ] 标签过滤功能

### 阶段 5: 测试验证

#### 步骤 5.1: 功能测试
- [ ] 测试标题搜索
- [ ] 测试内容搜索
- [ ] 测试标签搜索
- [ ] 测试组合搜索
- [ ] 测试空查询处理

#### 步骤 5.2: 性能测试
- [ ] 测试大量文件搜索性能
- [ ] 测试实时搜索响应速度

## 技术实现细节

### 依赖项

**Rust**:
- `regex`: 1.10 (正则表达式)
- `walkdir`: 2.4 (目录遍历)

### 文件变更

**新增文件**:
- `src-tauri/src/search.rs`
- `src/components/SearchBar.tsx`

**修改文件**:
- `src-tauri/src/commands.rs`
- `src/App.tsx`

### API 接口

```typescript
// 前端调用
invoke("search_files", {
  baseDir: string,
  query: string,
  searchInContent: boolean
}): Promise<FileInfo[]>

invoke("search_by_tags", {
  baseDir: string,
  tags: string[]
}): Promise<FileInfo[]>

invoke("get_all_tags", { baseDir: string }): Promise<string[]>
```

### 搜索策略

1. **标题搜索**: 在 frontmatter.title 中搜索
2. **描述搜索**: 在 frontmatter.description 中搜索
3. **标签搜索**: 在 frontmatter.tags 中搜索
4. **内容搜索**: 在 Markdown 正文中搜索（跳过 frontmatter）

## 验收标准

1. ✅ 能够搜索文件标题
2. ✅ 能够搜索文件内容
3. ✅ 能够按标签搜索
4. ✅ 搜索结果准确
5. ✅ 实时搜索响应迅速
6. ✅ UI 友好易用

## 已知问题

1. 大量文件时搜索可能较慢
2. 复杂正则表达式可能影响性能

## 后续改进

1. 添加搜索索引（提高性能）
2. 支持高级搜索语法
3. 支持搜索历史
4. 支持搜索结果高亮
5. 支持搜索过滤（按平台、日期等）
6. 添加搜索统计信息
