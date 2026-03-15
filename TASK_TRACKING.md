# Task Tracking

## Active Sprint: Local Video Refactoring & Robustness

### Current Goals
- Stabilize the multi-library `LibrarySidebar` and grid thumbnail `VideoGallery`.
- Implement background file system monitoring.

### To Do
- [ ] Introduce error handling boundaries if video playback decoding fails for unsupported formats.
- [ ] Add unit tests for `scanner.rs` and the new FFmpeg extraction logic.
- [ ] Fix any remaining typescript IDE errors or warnings.

### In Progress
- [ ] None right now - transitioning to the file watching features.

### Done (Recent)
- [x] Researched and implemented the `notify` crate within Tauri backend (`watcher.rs`).
- [x] Emitting robust events (`file-added`, `file-deleted`) when new video files are physically managed inside a watched Library folder.
- [x] Reconfigured `App.tsx`/`VideoGallery.tsx` frontend bindings to interpret `file-added` events and auto-refresh the gallery pool.
- [x] RFC-0011 architectural changes implemented.
- [x] Replaced yt-dlp with `ffmpeg-next` v8.0.
- [x] Embedded Base64 thumbnail generation within Markdown frontmatter.
- [x] React refactor to split `App.tsx` layout into `LibrarySidebar`, `VideoGallery`, and `MarkdownEditor`.
