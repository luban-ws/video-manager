# Video Manager (Linus Torvalds Edition) - Roadmap

## Phase 1: Core Functionality (Current)
- [x] Basic UI layout (Tauri + React + Tailwind)
- [x] Folder tree navigation and markdown editing
- [x] Initial FFmpeg integration for inline frame extraction

## Phase 2: Portable Sidecar Architecture (In Progress)
- [x] Multi-directory Library Management (Add/Remove folders)
- [x] FFmpeg native thumbnail generation and Base64 storage
- [x] Generate sidecar `.md` records natively for `.mp4` and other videos
- [x] Implement robust background file watching (`notify` crate) to auto-sync sidecar files
- [x] Video playback inline annotations & timeline synchronisation

## Phase 3: Metadata & Search
- [ ] Read/Write deep metadata tagging & platform-agnostic storage
- [ ] Full-text searching via Tantivy (Rust backend indexing) or simple in-memory cache
- [ ] Git versioning bindings (`git2-rs`) to backup notes seamlessly

## Phase 4: Polish & Export
- [ ] Dark Mode and custom themes
- [ ] Export notes to PDF/HTML
- [ ] Hardware acceleration for FFmpeg transcoding and processing
