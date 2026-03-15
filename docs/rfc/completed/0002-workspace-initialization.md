# RFC-0002: 工作目录初始化功能

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0001  
**优先级**: P0 (核心功能)

## 摘要

实现应用启动时的工作目录选择功能，允许用户选择或创建一个空文件夹作为所有内容的存储根目录（Vision Base）。

## 目标

1. 应用首次启动时自动提示用户选择工作目录
2. 支持选择现有文件夹（空或非空）
3. 支持创建新文件夹
4. 将选择的目录保存到 localStorage
5. 提供"设置目录"功能允许用户更改工作目录

## 详细执行计划

### 阶段 1: 后端支持 (Rust)

#### 步骤 1.1: 添加目录检查命令
- [x] 在 `commands.rs` 中实现 `is_directory_empty` 命令
- [x] 检查目录是否存在
- [x] 检查目录是否为空
- [x] 返回布尔值结果

**实现细节**:
```rust
#[tauri::command]
pub async fn is_directory_empty(dir_path: String) -> Result<bool, String>
```

#### 步骤 1.2: 添加目录创建命令
- [x] 在 `commands.rs` 中实现 `create_directory` 命令
- [x] 验证父目录存在
- [x] 检查新目录是否已存在
- [x] 创建目录并返回路径

**实现细节**:
```rust
#[tauri::command]
pub async fn create_directory(
    parent_path: String,
    folder_name: String,
) -> Result<String, String>
```

#### 步骤 1.3: 注册命令
- [x] 在 `main.rs` 中注册新命令
- [x] 确保 Tauri dialog 插件已初始化

### 阶段 2: 前端对话框组件 (React)

#### 步骤 2.1: 创建 FolderSelectDialog 组件
- [x] 创建 `src/components/FolderSelectDialog.tsx`
- [x] 实现模态对话框 UI
- [x] 使用 Tailwind CSS 样式

**组件结构**:
```typescript
interface FolderSelectDialogProps {
  onSelect: (path: string) => void;
}
```

#### 步骤 2.2: 实现选择现有文件夹功能
- [x] 使用 `@tauri-apps/plugin-dialog` 的 `open` 函数
- [x] 配置为目录选择模式
- [x] 调用后端检查目录是否为空
- [x] 如果非空，显示确认对话框
- [x] 调用 `onSelect` 回调

**代码示例**:
```typescript
const selected = await open({
  directory: true,
  multiple: false,
  title: "选择工作目录",
});
```

#### 步骤 2.3: 实现创建新文件夹功能
- [x] 添加父目录选择功能
- [x] 添加文件夹名称输入框
- [x] 调用后端创建目录
- [x] 验证输入有效性
- [x] 显示创建状态

#### 步骤 2.4: 错误处理
- [x] 处理用户取消操作
- [x] 处理目录创建失败
- [x] 显示友好的错误消息

### 阶段 3: 集成到主应用

#### 步骤 3.1: 更新 App.tsx
- [x] 添加 `showFolderDialog` 状态
- [x] 在 `useEffect` 中检查 localStorage
- [x] 如果没有保存的目录，显示对话框
- [x] 实现 `handleFolderSelect` 函数
- [x] 保存到 localStorage (key: `video-manager-base-dir`)

#### 步骤 3.2: 添加"设置目录"按钮
- [x] 在顶部栏添加按钮
- [x] 点击时显示文件夹选择对话框
- [x] 显示当前工作目录路径

#### 步骤 3.3: 持久化存储
- [x] 使用 `localStorage.setItem` 保存路径
- [x] 使用 `localStorage.getItem` 读取路径
- [x] 处理 localStorage 不可用的情况

### 阶段 4: 测试验证

#### 步骤 4.1: 功能测试
- [ ] 测试首次启动显示对话框
- [ ] 测试选择现有空文件夹
- [ ] 测试选择现有非空文件夹（确认提示）
- [ ] 测试创建新文件夹
- [ ] 测试更改工作目录
- [ ] 测试 localStorage 持久化

#### 步骤 4.2: 错误处理测试
- [ ] 测试取消对话框
- [ ] 测试无效路径
- [ ] 测试权限不足
- [ ] 测试 localStorage 禁用

## 技术实现细节

### 依赖项

**前端**:
- `@tauri-apps/plugin-dialog`: ^2.0.0

**后端**:
- `tauri-plugin-dialog`: 2.0

### 文件变更

**新增文件**:
- `src/components/FolderSelectDialog.tsx`

**修改文件**:
- `src/App.tsx`
- `src-tauri/src/commands.rs`
- `src-tauri/src/main.rs`
- `package.json`
- `src-tauri/Cargo.toml`

### API 接口

```typescript
// 前端调用
invoke("is_directory_empty", { dirPath: string }): Promise<boolean>
invoke("create_directory", { parentPath: string, folderName: string }): Promise<string>
```

## 验收标准

1. ✅ 应用首次启动时自动显示文件夹选择对话框
2. ✅ 用户可以选择现有文件夹（空或非空）
3. ✅ 用户可以创建新文件夹
4. ✅ 选择的目录正确保存到 localStorage
5. ✅ 下次启动时自动加载保存的目录
6. ✅ 用户可以随时更改工作目录
7. ✅ 所有错误情况都有友好的提示

## 已知问题

无

## 后续改进

1. 支持多个工作目录切换
2. 记住最近使用的工作目录列表
3. 支持从命令行参数指定工作目录
