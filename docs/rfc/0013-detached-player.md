# RFC-0013: Detached Global Player Window

## Status
Proposed

## Context
The current video playback is embedded within the `MarkdownEditor` component. While this works, it limits the user's ability to maximize screen real estate for both viewing and note-taking. Furthermore, a detached window is a common requirement for professional video management workflows.

## Goals
1.  Provide a dedicated, high-fidelity video playback window.
2.  Maintain full synchronization (bi-directional) with the Markdown Editor in the main window.
3.  Support native fallback for incompatible formats.

## Proposed Design

### Option A: Detached Tauri Window (Web-based)
- **Architecture**: A new `WebviewWindow` instance.
- **Player Engine**: `video.js` (Web-based).
- **Pros**: Easy to theme (Solarized Dark), seamless bi-direction sync, lightweight.
- **Cons**: Limited by system webview codecs (no native MKV/AVI/AC3 support in some OS).

### Option B: Native libvlc Integration (Rust-based)
- **Architecture**: Use `vlc-rs` to spawn a native window.
- **Pros**: Universal codec support (plays everything), professional grade.
- **Cons**: Harder to theme, complex cross-window sync, adds heavy dependency.

### Option C: Automated Transcoding / Proxy (Hybrid)
- **Architecture**: Use FFmpeg to transcode incompatible files into a hidden `.proxy.mp4` file.
- **Pros**: Guaranteed playback in themed Tauri window, full sync support.
- **Cons**: High CPU usage, initial wait time, takes disk space.

### Option D: "Upgrade to MP4" (Permanent & Queued)
- **Architecture**: A manual or bulk UI action that adds tasks to a background **Transcoding Queue**.
- **Pros**: Fixes legacy codec issues permanently, improves library portability, avoids blocking the UI.
- **Cons**: Requires background task management and progress UI.

## Queued Transcoding Architecture

### 1. Backend Task Manager (`transcoder.rs`)
- **Queue**: A `tokio::sync::mpsc` channel for job submission.
- **Worker**: A long-running background thread that processes jobs one-by-one using FFmpeg.
- **Events**: Emits `transcode:status` events (Pending, Processing, Progress %, Completed, Failed).

### 2. Frontend Queued UI
- **Transcode Monitor**: A floating drawer or status bar showing current and pending jobs.
- **Visual Feedback**: Video cards display a "conversion" overlay or badge when a job is active for that specific file.

### 3. Playback Prioritization
To ensure the best battery life and compatibility, the application will implement a "Smart Source Selection" logic:
- If a video file (e.g., `Tutorial.mkv`) has a corresponding `Tutorial.mp4` file in the same directory, the application will **transparently use the .mp4 file** for playback and metadata thumbnail extraction.
- This allows legacy formats to exist as "originals" while the application operates on the "compatible" version.
- The UI will display a small "Compat" badge if an MP4 version is being used over an original.

## Implementation Plan

### Phase 1: Infrastructure
1.  **Rust**: Implement `open_player_window` command in `commands.rs`.
2.  **Frontend**: Implement a simple routing mechanism or window-type detection in `main.tsx`/`App.tsx`.

### Phase 2: Player Window
1.  Create `src/components/PlayerView.tsx`.
2.  Implement the event bridge using Tauri's `emit` and `listen`.

### Phase 3: Editor Integration
1.  Add a "Detach Player" button in `MarkdownEditor.tsx`.
2.  When detached, the embedded player is replaced with a "Playing in separate window" placeholder.

## Benefits
- **Multi-Monitor Support**: User can have the video on one screen and the editor on another.
- **Professional Workflow**: Aligns with existing video transcription/analysis tools.
- **Codecs**: While still limited by the webview, the "integrated" feel is preserved for most modern formats.
