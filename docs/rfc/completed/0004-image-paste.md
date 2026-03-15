# RFC-0004: 图片粘贴功能

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0003, RFC-0006, RFC-0007  
**优先级**: P0 (核心功能)

## 摘要

实现图片粘贴功能，自动将粘贴的图片保存到相对路径，并在 Markdown 中插入图片引用。

## 目标

1. 检测剪贴板中的图片
2. 保存图片到 `{markdown文件目录}/images/` 文件夹
3. 生成唯一的文件名
4. 在编辑器中插入图片 Markdown 语法
5. 使用相对路径确保可移植性

## 详细执行计划

### 阶段 1: 后端图片保存

#### 步骤 1.1: 实现保存命令
- [x] 在 `commands.rs` 中实现 `save_pasted_image` 命令
- [x] 接收图片数据和文件名
- [x] 获取 Markdown 文件所在目录
- [x] 创建 images 文件夹（如果不存在）

**命令签名**:
```rust
#[tauri::command]
pub async fn save_pasted_image(
    base_dir: String,
    file_path: String,
    image_data: Vec<u8>,
    image_name: String,
) -> Result<String, String>
```

#### 步骤 1.2: 文件名生成
- [x] 从原始文件名提取扩展名
- [x] 生成唯一文件名（时间戳）
- [x] 清理文件名（移除不安全字符）
- [x] 处理文件名冲突

**命名规则**:
```rust
let final_name = format!("{}-{}.{}", base_name, timestamp, extension);
```

#### 步骤 1.3: 相对路径计算
- [x] 计算图片相对于 Markdown 文件的路径
- [x] 返回相对路径字符串
- [x] 格式：`./images/filename.png`

### 阶段 2: 前端粘贴处理

#### 步骤 2.1: 粘贴事件监听
- [x] 在 MarkdownEditor 组件中添加粘贴监听
- [x] 使用 `useEffect` 注册全局监听器
- [x] 清理监听器（组件卸载时）

**实现**:
```typescript
document.addEventListener("paste", handlePaste);
```

#### 步骤 2.2: 图片检测
- [x] 检查剪贴板 items
- [x] 检测图片类型（`image/*`）
- [x] 获取图片文件
- [x] 阻止默认粘贴行为

**检测逻辑**:
```typescript
if (item.type.startsWith("image/")) {
  e.preventDefault();
  // 处理图片
}
```

#### 步骤 2.3: 图片数据处理
- [x] 读取图片为 ArrayBuffer
- [x] 转换为 Uint8Array
- [x] 转换为数字数组（传递给 Rust）
- [x] 获取图片扩展名

#### 步骤 2.4: 调用保存命令
- [x] 调用 `save_pasted_image` 命令
- [x] 传递图片数据和文件名
- [x] 获取返回的相对路径
- [x] 错误处理

#### 步骤 2.5: 插入 Markdown 语法
- [x] 获取编辑器光标位置
- [x] 生成图片 Markdown 语法
- [x] 在光标位置插入
- [x] 更新编辑器内容

**Markdown 语法**:
```markdown
![图片](./images/pasted-image-1704441234.png)
```

### 阶段 3: 错误处理

#### 步骤 3.1: 错误场景处理
- [x] 图片保存失败
- [x] 目录创建失败
- [x] 权限不足
- [x] 无效的图片数据

#### 步骤 3.2: 用户提示
- [x] 显示友好的错误消息
- [x] 记录详细错误日志
- [x] 提供重试选项（可选）

### 阶段 4: UI 优化

#### 步骤 4.1: 视觉反馈
- [x] 粘贴时显示处理状态（可选）
- [x] 成功插入后更新编辑器
- [x] 保持光标位置

#### 步骤 4.2: 提示信息
- [x] 在工具栏添加提示："💡 提示：可直接粘贴图片"

### 阶段 5: 测试验证

#### 步骤 5.1: 功能测试
- [ ] 测试 PNG 图片粘贴
- [ ] 测试 JPEG 图片粘贴
- [ ] 测试 GIF 图片粘贴
- [ ] 测试文件名生成
- [ ] 测试相对路径计算

#### 步骤 5.2: 边界测试
- [ ] 测试大图片处理
- [ ] 测试并发粘贴
- [ ] 测试权限不足情况
- [ ] 测试磁盘空间不足

## 技术实现细节

### 依赖项

无新增依赖

### 文件变更

**修改文件**:
- `src-tauri/src/commands.rs`
- `src/components/MarkdownEditor.tsx`
- `src-tauri/src/main.rs`

### API 接口

```typescript
// 前端调用
invoke("save_pasted_image", {
  baseDir: string,
  filePath: string,
  imageData: number[],
  imageName: string
}): Promise<string> // 返回相对路径
```

### 文件结构

```
markdown-file.md
images/
  └── pasted-image-1704441234.png
```

### 图片命名规则

- 格式：`{base-name}-{timestamp}.{extension}`
- base-name: 从原始文件名提取，清理不安全字符
- timestamp: Unix 时间戳（秒）
- extension: 从 MIME 类型或原始文件名提取

## 验收标准

1. ✅ 能够检测剪贴板中的图片
2. ✅ 图片正确保存到 images 文件夹
3. ✅ 文件名唯一且安全
4. ✅ 相对路径计算正确
5. ✅ Markdown 语法正确插入
6. ✅ 图片在预览中正确显示
7. ✅ 错误处理完善

## 已知问题

1. 大图片可能影响性能
2. 某些图片格式可能不支持

## 后续改进

1. 支持图片压缩
2. 支持图片格式转换
3. 支持拖拽上传
4. 支持图片预览
5. 支持图片编辑
6. 支持批量粘贴
