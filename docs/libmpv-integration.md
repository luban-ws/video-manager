# LibMPV 在 Tauri 中的工作原理

## 概述

LibMPV 是一个强大的视频播放库，它通过**原生窗口系统**进行视频渲染，而不是在 WebView 的 Canvas 中渲染。

## 工作原理

### 1. 架构图

```
┌─────────────────────────────────────────┐
│         Tauri 应用窗口 (WebView)        │
│  ┌───────────────────────────────────┐  │
│  │      React 前端 (HTML/CSS/JS)     │  │
│  │  ┌─────────────────────────────┐ │  │
│  │  │   视频播放区域 (占位符)       │ │  │
│  │  │   <div id="video-container"> │ │  │
│  │  └─────────────────────────────┘ │  │
│  └───────────────────────────────────┘  │
│              ↕ IPC 通信                  │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│         Rust 后端 (Tauri)               │
│  ┌───────────────────────────────────┐  │
│  │      LibMPV 播放器实例            │  │
│  │  ┌─────────────────────────────┐ │  │
│  │  │   原生窗口句柄 (Window ID)   │ │  │
│  │  │   嵌入到 WebView 的特定位置  │ │  │
│  │  └─────────────────────────────┘ │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2. 工作流程

#### 步骤 1: 前端请求播放视频
```typescript
// 前端调用 Tauri 命令
await invoke("start_native_video_playback", {
  videoPath: "/path/to/video.mp4",
  containerId: "video-container", // DOM 元素 ID
  x: 100,  // 在 WebView 中的位置
  y: 200,
  width: 800,
  height: 600
});
```

#### 步骤 2: Rust 后端创建 LibMPV 实例
```rust
// 在 Rust 后端
let mpv = Mpv::new().unwrap();
mpv.set_option("vo", "gpu").unwrap(); // 使用 GPU 渲染
mpv.set_option("hwdec", "auto").unwrap(); // 硬件解码

// 获取原生窗口句柄
let window_handle = app.get_window("main").unwrap();
let native_handle = window_handle.native_window_handle();
```

#### 步骤 3: 嵌入到 WebView 的特定位置
```rust
// 将 LibMPV 的输出窗口嵌入到 WebView 的指定位置
mpv.set_option("wid", native_handle).unwrap();
mpv.command(&["loadfile", video_path]).unwrap();
```

#### 步骤 4: 控制播放
```typescript
// 前端通过 IPC 控制播放
await invoke("video_play");
await invoke("video_pause");
await invoke("video_seek", { time: 100 });
```

## 为什么不能直接在 Canvas 中渲染？

### 技术原因

1. **LibMPV 的设计哲学**
   - LibMPV 使用操作系统的原生窗口系统（Win32, Cocoa, X11）
   - 它直接与 GPU 通信，进行硬件加速渲染
   - 输出是**原生窗口**，不是像素数据

2. **性能考虑**
   - 原生窗口渲染：GPU 直接输出，零拷贝，性能最优
   - Canvas 渲染：需要解码 → 传输 → 绘制，有性能损失

3. **格式支持**
   - 原生窗口：支持所有格式（包括 RMVB、AVI 等）
   - Canvas：受浏览器限制，只能播放浏览器支持的格式

## 实际实现方式

### 方案 A: 使用 tauri-plugin-libmpv-api（推荐）

```rust
// Cargo.toml
[dependencies]
tauri-plugin-libmpv-api = "0.1"

// main.rs
use tauri_plugin_libmpv_api::Mpv;

tauri::Builder::default()
    .plugin(tauri_plugin_libmpv_api::init())
    // ...
```

### 方案 B: 直接集成 libmpv-rs

```rust
// Cargo.toml
[dependencies]
libmpv = "2.0"

// 创建播放器
use libmpv::{Mpv, Format};

let mpv = Mpv::new().unwrap();
mpv.set_option("vo", "gpu").unwrap();
mpv.set_option("wid", window_handle).unwrap();
```

## 视觉效果

在用户看来，视频播放区域看起来就像是在 WebView 中：

```
┌─────────────────────────────────────┐
│  视频管理器                        │
├─────────────────────────────────────┤
│  [文件夹树] │ [视频播放区域]        │
│            │ ┌───────────────────┐ │
│            │ │                   │ │
│            │ │   视频内容        │ │ ← 看起来像在 WebView 中
│            │ │  (实际是原生窗口)  │ │
│            │ │                   │ │
│            │ └───────────────────┘ │
└─────────────────────────────────────┘
```

但实际上，视频播放区域是一个**嵌入的原生窗口**，覆盖在 WebView 之上。

## 优缺点

### 优点 ✅
- **性能优秀**：GPU 硬件加速，零拷贝渲染
- **格式支持全面**：支持所有视频格式（RMVB、AVI、MPEG 等）
- **功能强大**：支持字幕、滤镜、硬件解码等高级功能
- **跨平台**：Windows、macOS、Linux 都支持

### 缺点 ❌
- **不能直接在 Canvas 中渲染**：必须使用原生窗口
- **集成复杂度较高**：需要处理窗口嵌入、坐标转换等
- **样式限制**：原生窗口的样式定制有限
- **调试困难**：原生窗口的调试不如 Web 技术方便

## 总结

LibMPV 通过**嵌入原生窗口**的方式工作，虽然不能直接在 Canvas 中渲染，但可以通过**窗口嵌入技术**实现视觉上的无缝集成。对于需要支持所有视频格式的应用，这是最佳方案。
