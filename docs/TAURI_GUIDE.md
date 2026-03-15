# Tauri 2.0 开发指南

本文档记录了在开发 video-manager 项目过程中遇到的 Tauri 2.0 相关问题及解决方案。

## 目录

1. [项目配置](#项目配置)
2. [常见问题与解决方案](#常见问题与解决方案)
3. [权限配置](#权限配置)
4. [开发流程](#开发流程)
5. [最佳实践](#最佳实践)

---

## 项目配置

### 1. 基本项目结构

```
video-manager/
├── src/                    # React 前端代码
├── src-tauri/              # Rust 后端代码
│   ├── src/                # Rust 源代码
│   ├── capabilities/       # 权限配置文件（重要！）
│   │   └── main.json      # 主窗口权限配置
│   ├── icons/              # 应用图标
│   │   └── icon.png       # 必须是 8-bit RGBA 格式
│   ├── tauri.conf.json    # Tauri 配置文件
│   └── Cargo.toml         # Rust 依赖配置
├── package.json
└── vite.config.ts
```

### 2. package.json 脚本配置

```json
{
  "scripts": {
    "dev": "vite",                    // 仅启动 Vite 开发服务器
    "build": "tsc && vite build",     // 构建前端
    "tauri:dev": "tauri dev",         // 启动完整 Tauri 应用（推荐）
    "tauri:build": "tauri build"     // 构建生产版本
  }
}
```

**重要**：`dev` 脚本应该运行 `vite`，而不是 `tauri dev`。Tauri 会在 `beforeDevCommand` 中自动调用它。

### 3. tauri.conf.json 配置要点

```json
{
  "app": {
    "windows": [
      {
        "label": "main",        // ⚠️ 必须设置 label，用于权限匹配
        "title": "视频管理器",
        "width": 1200,
        "height": 800
      }
    ]
  },
  "build": {
    "beforeDevCommand": "pnpm dev",  // 启动 Vite 服务器
    "devUrl": "http://localhost:1421",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "plugins": {
    "opener": {
      "requireLiteralLeadingDot": false  // ⚠️ Tauri 2.0 新格式
    }
  }
}
```

### 4. vite.config.ts 配置

```typescript
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1421,              // 必须与 tauri.conf.json 中的 devUrl 端口一致
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],  // 忽略 Rust 代码变化
    },
  },
}));
```

---

## 常见问题与解决方案

### 问题 1: 图标格式错误

**错误信息**：
```
invalid icon: The specified dimensions (512x512) don't match the number of pixels 
supplied by the `rgba` argument (524288). For those dimensions, the expected pixel count is 262144.
```

**原因**：图标是 16-bit RGBA 格式，Tauri 需要 8-bit RGBA 格式。

**解决方案**：
```bash
cd src-tauri/icons
magick -size 512x512 xc:none \
  -fill '#3b82f6' \
  -draw 'circle 256,256 256,50' \
  -pointsize 200 \
  -fill white \
  -gravity center \
  -annotate +0+0 'VM' \
  -depth 8 icon.png  # ⚠️ 关键：-depth 8 确保是 8-bit
```

**验证**：
```bash
file icon.png
# 应该显示：PNG image data, 512 x 512, 8-bit/color RGBA
```

### 问题 2: 插件权限未配置

**错误现象**：点击按钮没有任何反应，控制台没有错误信息。

**原因**：Tauri 2.0 要求所有插件命令都必须通过 capabilities 配置权限。如果没有配置，前端无法调用后端命令。

**解决方案**：创建 `src-tauri/capabilities/main.json` 文件（见下方权限配置章节）。

### 问题 3: 权限名称错误

**错误信息**：
```
Permission fs:allow-create-dir not found
```

**原因**：Tauri 2.0 的权限名称与 1.x 不同。

**解决方案**：使用正确的权限名称：

| 错误名称 | 正确名称 |
|---------|---------|
| `fs:allow-create-dir` | `fs:allow-mkdir` |
| `fs:allow-remove-dir` | `fs:allow-remove` |
| `fs:allow-remove-file` | `fs:allow-remove` |
| `fs:allow-rename-file` | `fs:allow-rename` |

### 问题 4: 窗口 label 未设置

**错误现象**：权限配置了但不起作用。

**原因**：`tauri.conf.json` 中的窗口必须设置 `label`，capabilities 中的 `windows` 字段才能匹配。

**解决方案**：
```json
{
  "app": {
    "windows": [
      {
        "label": "main",  // ⚠️ 必须设置
        "title": "视频管理器"
      }
    ]
  }
}
```

### 问题 5: opener 插件配置格式错误

**错误信息**：
```
Error deserializing 'plugins.opener': unknown field `open`, expected `requireLiteralLeadingDot`
```

**原因**：Tauri 2.0 的 opener 插件配置格式改变了。

**解决方案**：
```json
{
  "plugins": {
    "opener": {
      "requireLiteralLeadingDot": false  // 不是 "open": true
    }
  }
}
```

---

## 权限配置

### 1. 创建 Capabilities 文件

在 `src-tauri/capabilities/` 目录下创建权限配置文件：

**文件路径**：`src-tauri/capabilities/main.json`

```json
{
  "$schema": "../gen/schemas/capabilities.json",
  "identifier": "main-capability",
  "description": "Main window capability with all required permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-maximize",
    "core:window:allow-minimize",
    "core:window:allow-unmaximize",
    "core:window:allow-unminimize",
    "core:window:allow-start-dragging",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "dialog:allow-confirm",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-read-dir",
    "fs:allow-copy-file",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-exists",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "opener:default",
    "opener:allow-open-url",
    "opener:allow-open-path"
  ]
}
```

### 2. 权限说明

#### Dialog 插件权限
- `dialog:default` - 包含所有 dialog 权限
- `dialog:allow-open` - 允许打开文件/文件夹对话框
- `dialog:allow-save` - 允许保存文件对话框
- `dialog:allow-message` - 允许显示消息对话框
- `dialog:allow-ask` - 允许询问对话框
- `dialog:allow-confirm` - 允许确认对话框

#### FS 插件权限
- `fs:default` - 包含所有文件系统权限
- `fs:allow-mkdir` - 创建目录（⚠️ 不是 `fs:allow-create-dir`）
- `fs:allow-remove` - 删除文件或目录（⚠️ 不是 `fs:allow-remove-dir`）
- `fs:allow-rename` - 重命名文件（⚠️ 不是 `fs:allow-rename-file`）
- `fs:allow-read-file` - 读取文件
- `fs:allow-write-file` - 写入文件
- `fs:allow-read-dir` - 读取目录
- `fs:allow-read-text-file` - 读取文本文件
- `fs:allow-write-text-file` - 写入文本文件

#### Opener 插件权限
- `opener:default` - 包含所有 opener 权限
- `opener:allow-open-url` - 允许打开 URL
- `opener:allow-open-path` - 允许打开文件路径

### 3. 查看可用权限

所有可用权限定义在：
- `src-tauri/gen/schemas/desktop-schema.json`
- `src-tauri/gen/schemas/macOS-schema.json`

可以通过搜索权限名称来确认正确的权限标识符。

---

## 开发流程

### 1. 启动开发模式

```bash
# 推荐方式：使用 Tauri 命令（自动启动 Vite + Tauri）
pnpm tauri:dev

# 或直接使用 Tauri CLI
pnpm tauri dev

# 如果只想启动 Vite 服务器（不启动 Tauri 窗口）
pnpm dev
```

### 2. 工作流程

1. **Tauri 执行 `beforeDevCommand`** → 运行 `pnpm dev` → 启动 Vite 服务器（端口 1421）
2. **Tauri 编译 Rust 后端**
3. **Tauri 连接到 Vite 服务器** → `http://localhost:1421`
4. **打开应用窗口**

### 3. 调试技巧

#### 前端调试
- 使用浏览器 DevTools（在 Tauri 窗口中右键 → 检查）
- 查看控制台日志
- 检查网络请求

#### 后端调试
- Rust 编译错误会显示在终端
- 使用 `println!` 或 `dbg!` 宏输出日志
- 检查 `target/debug/` 目录下的编译产物

#### 权限问题调试
- 检查浏览器控制台是否有权限错误
- 验证 `capabilities/main.json` 文件格式
- 确认窗口 `label` 与 capabilities 中的 `windows` 匹配

---

## 最佳实践

### 1. 图标准备

- **格式**：必须是 8-bit RGBA PNG
- **尺寸**：512x512 像素（推荐）
- **验证**：使用 `file icon.png` 确认格式
- **创建**：使用 ImageMagick 的 `-depth 8` 参数

### 2. 权限配置

- **最小权限原则**：只配置应用实际需要的权限
- **使用 default 权限集**：优先使用 `plugin:default` 而不是列出所有权限
- **窗口 label**：始终为窗口设置 `label`，并在 capabilities 中引用

### 3. 开发环境

- **端口一致性**：确保 `vite.config.ts` 的端口与 `tauri.conf.json` 的 `devUrl` 一致
- **依赖管理**：使用 `pnpm` 或 `npm`，保持一致性
- **Rust 工具链**：确保 Rust 和 Cargo 是最新稳定版

### 4. 错误处理

- **先检查权限**：如果命令不工作，首先检查 capabilities 配置
- **查看编译错误**：Rust 编译错误通常很明确，按提示修复
- **验证配置格式**：使用 JSON schema 验证配置文件格式

### 5. 性能优化

- **开发模式**：使用 `tauri dev` 自动处理热重载
- **构建优化**：生产构建时使用 `tauri build --release`
- **资源优化**：图标文件不要太大（推荐 < 100KB）

---

## 参考资源

- [Tauri 2.0 官方文档](https://v2.tauri.app/)
- [Tauri 权限系统](https://v2.tauri.app/plugin/fs/)
- [Tauri 插件开发](https://v2.tauri.app/plugin/)
- [Rust 官方文档](https://doc.rust-lang.org/)

---

## 问题记录

### 2024-01-05: 初始配置问题

1. **图标格式问题**
   - 问题：16-bit RGBA 图标导致启动失败
   - 解决：使用 `-depth 8` 创建 8-bit 图标

2. **权限配置缺失**
   - 问题：点击按钮无反应
   - 解决：创建 `capabilities/main.json` 并配置权限

3. **权限名称错误**
   - 问题：`fs:allow-create-dir` 不存在
   - 解决：使用 `fs:allow-mkdir`

4. **窗口 label 缺失**
   - 问题：权限配置不生效
   - 解决：在 `tauri.conf.json` 中添加窗口 `label`

5. **opener 插件配置格式**
   - 问题：`"open": true` 格式错误
   - 解决：使用 `"requireLiteralLeadingDot": false`

---

## 快速检查清单

在遇到问题时，按以下顺序检查：

- [ ] 图标格式是否正确（8-bit RGBA）
- [ ] 窗口是否设置了 `label`
- [ ] `capabilities/main.json` 是否存在且格式正确
- [ ] 权限名称是否正确（参考本文档）
- [ ] `vite.config.ts` 端口与 `tauri.conf.json` 的 `devUrl` 是否一致
- [ ] 插件是否在 `main.rs` 中正确初始化
- [ ] 命令是否在 `main.rs` 的 `invoke_handler` 中注册
- [ ] Rust 编译是否有错误（查看终端输出）

---

**最后更新**：2024-01-05  
**维护者**：AI Assistant  
**项目**：video-manager
