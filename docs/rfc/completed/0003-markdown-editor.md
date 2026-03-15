# RFC-0003: Markdown 编辑器功能

**状态**: 已实现  
**创建日期**: 2024-01-05  
**依赖**: RFC-0002, RFC-0006  
**优先级**: P0 (核心功能)

## 摘要

实现功能完整的 Markdown 编辑器，支持实时预览、语法高亮、图片粘贴等功能。

## 目标

1. 集成 Markdown 编辑器组件
2. 实现文件加载和保存
3. 支持实时预览
4. 支持图片粘贴（见 RFC-0004）
5. 提供友好的编辑体验

## 详细执行计划

### 阶段 1: 编辑器组件集成

#### 步骤 1.1: 安装依赖
- [x] 安装 `@uiw/react-md-editor`
- [x] 配置 TypeScript 类型

**依赖版本**:
```json
"@uiw/react-md-editor": "^3.4.0"
```

#### 步骤 1.2: 创建 MarkdownEditor 组件
- [x] 创建 `src/components/MarkdownEditor.tsx`
- [x] 定义组件 Props 接口
- [x] 实现基础编辑器布局

**组件接口**:
```typescript
interface MarkdownEditorProps {
  filePath: string | null;
  baseDir: string;
  onSave: () => void;
}
```

#### 步骤 1.3: 集成 MDEditor
- [x] 导入 MDEditor 组件
- [x] 配置编辑器选项
- [x] 设置主题为 light mode
- [x] 实现双向数据绑定

### 阶段 2: 文件操作功能

#### 步骤 2.1: 文件加载
- [x] 实现 `loadFile` 函数
- [x] 调用 `read_markdown_file` 命令
- [x] 解析返回的文档
- [x] 更新 content 和 metadata 状态
- [x] 显示加载状态

#### 步骤 2.2: 文件保存
- [x] 实现 `handleSave` 函数
- [x] 调用 `save_markdown_file` 命令
- [x] 更新 metadata 的 updated_at
- [x] 显示保存状态
- [x] 错误处理

#### 步骤 2.3: 自动加载
- [x] 使用 `useEffect` 监听 filePath 变化
- [x] filePath 变化时自动加载文件
- [x] filePath 为 null 时清空编辑器

### 阶段 3: UI 优化

#### 步骤 3.1: 工具栏设计
- [x] 显示文件标题和平台信息
- [x] 显示标签
- [x] 添加保存按钮
- [x] 显示保存状态

#### 步骤 3.2: 空状态处理
- [x] 文件未选择时显示提示
- [x] 加载中显示加载提示
- [x] 友好的空状态 UI

#### 步骤 3.3: 样式优化
- [x] 使用 Tailwind CSS 样式
- [x] 响应式布局
- [x] 编辑器全屏显示

### 阶段 4: 图片粘贴集成

#### 步骤 4.1: 粘贴事件监听
- [x] 添加全局粘贴事件监听器
- [x] 检测剪贴板中的图片
- [x] 阻止默认粘贴行为

#### 步骤 4.2: 图片处理
- [x] 读取图片数据
- [x] 调用图片保存命令（见 RFC-0004）
- [x] 在光标位置插入 Markdown 图片语法

**实现细节** (见 RFC-0004)

### 阶段 5: 测试验证

#### 步骤 5.1: 功能测试
- [ ] 测试文件加载
- [ ] 测试文件保存
- [ ] 测试编辑器输入
- [ ] 测试实时预览
- [ ] 测试图片粘贴

#### 步骤 5.2: 边界测试
- [ ] 测试大文件加载
- [ ] 测试并发保存
- [ ] 测试文件不存在情况
- [ ] 测试保存失败处理

## 技术实现细节

### 依赖项

**前端**:
- `@uiw/react-md-editor`: ^3.4.0

### 文件变更

**新增文件**:
- `src/components/MarkdownEditor.tsx`

**修改文件**:
- `src/App.tsx`
- `package.json`

### API 接口

```typescript
// 前端调用
invoke("read_markdown_file", { filePath: string }): Promise<VideoDocument>
invoke("save_markdown_file", {
  filePath: string,
  metadata: VideoMetadata,
  content: string
}): Promise<void>
```

### 编辑器配置

```typescript
<MDEditor
  value={content}
  onChange={(value) => setContent(value || "")}
  height="100%"
  data-color-mode="light"
/>
```

## 验收标准

1. ✅ 编辑器正确显示 Markdown 内容
2. ✅ 实时预览功能正常
3. ✅ 文件加载和保存功能正常
4. ✅ 图片粘贴功能正常（见 RFC-0004）
5. ✅ UI 友好，响应迅速
6. ✅ 错误处理完善

## 已知问题

1. 大文件可能影响编辑器性能
2. 某些 Markdown 扩展语法可能不支持

## 后续改进

1. 支持更多 Markdown 扩展语法
2. 添加代码块语法高亮
3. 支持自定义主题
4. 添加快捷键支持
5. 支持分屏编辑模式
6. 添加撤销/重做功能
