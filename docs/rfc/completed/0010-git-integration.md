# RFC-0010: Git 版本控制集成

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0002  
**优先级**: P2 (增强功能)

## 摘要

集成 Git 版本控制功能，允许用户对工作目录进行版本管理。

## 目标

1. 支持初始化 Git 仓库
2. 支持添加文件到暂存区
3. 支持提交更改
4. 支持查看仓库状态
5. 支持查看提交历史

## 详细执行计划

### 阶段 1: Git 库集成

#### 步骤 1.1: 添加依赖
- [x] 在 `Cargo.toml` 中添加 `git2` 依赖
- [x] 配置依赖版本

**依赖配置**:
```toml
git2 = "0.18"
```

#### 步骤 1.2: 创建 git.rs 模块
- [x] 创建 `src-tauri/src/git.rs`
- [x] 导入 git2 库
- [x] 定义错误处理

### 阶段 2: 基础 Git 操作

#### 步骤 2.1: 仓库初始化
- [x] 实现 `init_repo` 函数
- [x] 实现 `open_repo` 函数
- [x] 实现 `get_or_init_repo` 函数

**函数签名**:
```rust
pub fn init_repo(repo_path: &Path) -> Result<Repository, String>
pub fn open_repo(repo_path: &Path) -> Result<Repository, String>
pub fn get_or_init_repo(repo_path: &Path) -> Result<Repository, String>
```

#### 步骤 2.2: 文件添加
- [x] 实现 `add_file` 函数
- [x] 计算相对路径
- [x] 添加到暂存区
- [x] 写入索引

#### 步骤 2.3: 提交操作
- [x] 实现 `commit` 函数
- [x] 创建签名（作者信息）
- [x] 创建提交
- [x] 处理首次提交（无父提交）

**函数签名**:
```rust
pub fn commit(
    repo: &Repository,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> Result<String, String>
```

#### 步骤 2.4: 状态查询
- [x] 实现 `get_status` 函数
- [x] 获取仓库状态
- [x] 返回变更文件列表

#### 步骤 2.5: 历史查询
- [x] 实现 `get_commit_history` 函数
- [x] 定义 `CommitInfo` 结构体
- [x] 遍历提交历史
- [x] 限制返回数量

**结构体定义**:
```rust
#[derive(Debug, serde::Serialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}
```

### 阶段 3: Tauri 命令封装

#### 步骤 3.1: Git 命令
- [x] `git_init`: 初始化仓库
- [x] `git_add`: 添加文件
- [x] `git_commit`: 提交更改
- [x] `git_status`: 获取状态
- [x] `git_history`: 获取历史

#### 步骤 3.2: 错误处理
- [x] 仓库不存在错误
- [x] Git 操作失败错误
- [x] 权限错误

### 阶段 4: 前端集成（未来）

#### 步骤 4.1: Git UI 组件（待实现）
- [ ] 创建 Git 操作面板
- [ ] 显示仓库状态
- [ ] 显示提交历史
- [ ] 提供提交表单

#### 步骤 4.2: 自动提交（可选）
- [ ] 保存文件后自动添加
- [ ] 定期自动提交
- [ ] 提交前确认

### 阶段 5: 测试验证

#### 步骤 5.1: 功能测试
- [ ] 测试仓库初始化
- [ ] 测试文件添加
- [ ] 测试提交操作
- [ ] 测试状态查询
- [ ] 测试历史查询

#### 步骤 5.2: 错误测试
- [ ] 测试重复初始化
- [ ] 测试无效路径
- [ ] 测试权限不足

## 技术实现细节

### 依赖项

**Rust**:
- `git2`: 0.18 (Git 操作库)

### 文件变更

**新增文件**:
- `src-tauri/src/git.rs`

**修改文件**:
- `src-tauri/src/commands.rs`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`

### API 接口

```typescript
// 前端调用
invoke("git_init", { repoPath: string }): Promise<void>
invoke("git_add", { repoPath: string, filePath: string }): Promise<void>
invoke("git_commit", {
  repoPath: string,
  message: string,
  authorName: string,
  authorEmail: string
}): Promise<string> // 返回提交 ID

invoke("git_status", { repoPath: string }): Promise<string[]>
invoke("git_history", { repoPath: string, limit: number }): Promise<CommitInfo[]>
```

### Git 工作流

1. **初始化**: 用户在工作目录运行 `git_init`
2. **添加文件**: 编辑文件后运行 `git_add`
3. **提交**: 运行 `git_commit` 提交更改
4. **查看状态**: 运行 `git_status` 查看变更
5. **查看历史**: 运行 `git_history` 查看提交记录

## 验收标准

1. ✅ 能够初始化 Git 仓库
2. ✅ 能够添加文件到暂存区
3. ✅ 能够提交更改
4. ✅ 能够查看仓库状态
5. ✅ 能够查看提交历史
6. ✅ 错误处理完善

## 已知问题

1. 需要用户手动配置 Git 用户信息
2. 大文件可能影响 Git 性能

## 后续改进

1. 添加 Git UI 界面
2. 支持分支操作
3. 支持远程仓库操作
4. 支持自动提交
5. 支持 .gitignore 配置
6. 支持冲突解决
7. 集成 GitHub/GitLab 同步
