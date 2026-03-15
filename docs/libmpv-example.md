# LibMPV 集成示例代码

## 简化的工作流程示例

### 1. 前端代码（React/TypeScript）

```typescript
// src/components/NativeVideoPlayer.tsx
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface NativeVideoPlayerProps {
  videoPath: string;
  width: number;
  height: number;
}

export function NativeVideoPlayer({ videoPath, width, height }: NativeVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 获取容器在页面中的位置
    const rect = containerRef.current.getBoundingClientRect();
    
    // 调用后端，创建原生视频播放窗口
    invoke("create_native_video_player", {
      videoPath,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });

    return () => {
      // 清理：关闭播放器
      invoke("close_native_video_player");
    };
  }, [videoPath, width, height]);

  return (
    <div 
      ref={containerRef}
      className="video-container"
      style={{ width, height, position: "relative" }}
    >
      {/* 这个 div 只是一个占位符，实际视频会覆盖在上面 */}
      <div className="video-placeholder">
        视频加载中...
      </div>
    </div>
  );
}
```

### 2. 后端代码（Rust）

```rust
// src-tauri/src/native_video.rs
use tauri::Window;
use std::sync::Mutex;

// 全局播放器实例
static MPV_PLAYER: Mutex<Option<libmpv::Mpv>> = Mutex::new(None);

#[tauri::command]
pub fn create_native_video_player(
    video_path: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    window: Window,
) -> Result<(), String> {
    // 创建 LibMPV 实例
    let mpv = libmpv::Mpv::new()
        .map_err(|e| format!("无法创建 MPV 播放器: {}", e))?;

    // 配置播放器
    mpv.set_option("vo", "gpu")
        .map_err(|e| format!("设置视频输出失败: {}", e))?;
    mpv.set_option("hwdec", "auto")
        .map_err(|e| format!("设置硬件解码失败: {}", e))?;

    // 获取原生窗口句柄
    #[cfg(target_os = "windows")]
    let native_handle = {
        use raw_window_handle::HasRawWindowHandle;
        let handle = window.native_window_handle();
        // Windows: 使用 HWND
        format!("{}", handle.as_raw())
    };

    #[cfg(target_os = "macos")]
    let native_handle = {
        use raw_window_handle::HasRawWindowHandle;
        let handle = window.native_window_handle();
        // macOS: 使用 NSView
        format!("{}", handle.as_raw())
    };

    #[cfg(target_os = "linux")]
    let native_handle = {
        use raw_window_handle::HasRawWindowHandle;
        let handle = window.native_window_handle();
        // Linux: 使用 X11 Window
        format!("{}", handle.as_raw())
    };

    // 将视频窗口嵌入到指定位置
    mpv.set_option("wid", &native_handle)
        .map_err(|e| format!("设置窗口 ID 失败: {}", e))?;

    // 加载视频
    mpv.command(&["loadfile", &video_path])
        .map_err(|e| format!("加载视频失败: {}", e))?;

    // 保存播放器实例
    *MPV_PLAYER.lock().unwrap() = Some(mpv);

    Ok(())
}

#[tauri::command]
pub fn close_native_video_player() -> Result<(), String> {
    let mut player = MPV_PLAYER.lock().unwrap();
    *player = None;
    Ok(())
}

#[tauri::command]
pub fn video_play() -> Result<(), String> {
    let player = MPV_PLAYER.lock().unwrap();
    if let Some(ref mpv) = *player {
        mpv.command(&["set_property", "pause", "no"])
            .map_err(|e| format!("播放失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn video_pause() -> Result<(), String> {
    let player = MPV_PLAYER.lock().unwrap();
    if let Some(ref mpv) = *player {
        mpv.command(&["set_property", "pause", "yes"])
            .map_err(|e| format!("暂停失败: {}", e))?;
    }
    Ok(())
}
```

## 关键点说明

### 1. **窗口嵌入的工作原理**

```
┌─────────────────────────────────────┐
│  Tauri WebView (主窗口)            │
│  ┌───────────────────────────────┐ │
│  │  React 组件渲染的占位符 div   │ │
│  │  <div id="video-container">   │ │
│  └───────────────────────────────┘ │
│           ↕ 坐标计算                │
│  ┌───────────────────────────────┐ │
│  │  LibMPV 原生窗口 (覆盖在上)   │ │ ← 实际视频渲染在这里
│  │  位置: (x, y)                 │ │
│  │  大小: width × height         │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2. **为什么需要占位符 div？**

- **布局计算**：React 组件需要知道视频播放区域的大小和位置
- **视觉占位**：在视频加载前显示占位内容
- **坐标传递**：将 div 的位置传递给后端，用于定位原生窗口

### 3. **实际渲染流程**

1. **前端**：React 组件渲染一个 `<div>` 作为占位符
2. **前端**：计算 div 在窗口中的位置（`getBoundingClientRect()`）
3. **前端**：通过 IPC 将位置信息发送给后端
4. **后端**：创建 LibMPV 播放器实例
5. **后端**：获取 Tauri 窗口的原生句柄
6. **后端**：将 LibMPV 的输出窗口定位到指定位置
7. **后端**：加载并播放视频
8. **结果**：原生视频窗口覆盖在 WebView 的 div 上方

## 视觉效果

用户看到的效果：

```
┌─────────────────────────────────────┐
│  视频管理器                        │
├──────────┬─────────────────────────┤
│ 文件夹树 │  ┌───────────────────┐  │
│          │  │                   │  │
│ 📁 docs  │  │   视频内容        │  │ ← 看起来像在 WebView 中
│ 📁 src   │  │  (实际是原生窗口)  │  │
│          │  │                   │  │
│          │  └───────────────────┘  │
└──────────┴─────────────────────────┘
```

但实际上，视频播放区域是一个**原生窗口**，通过窗口系统覆盖在 WebView 之上。

## 总结

LibMPV 通过**窗口嵌入**技术实现视频播放：
- ✅ 支持所有视频格式
- ✅ 硬件加速，性能优秀
- ✅ 视觉上无缝集成
- ❌ 不能直接在 Canvas 中渲染
- ❌ 需要处理窗口坐标和生命周期
