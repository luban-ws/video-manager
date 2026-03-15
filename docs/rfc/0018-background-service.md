# RFC 0018: Headless Background Transcoding Service (Decoupled Worker)

## Context & Motivation
Currently, transcoding is managed within the main application process using a worker thread. For CPU-bound tasks like video encoding, this can lead to:
- **UI Lag**: Even with threading, heavy process management can impact the main event loop's responsiveness.
- **Process Instability**: If a conversion triggers a catastrophic failure or memory leak in a dependency (like FFmpeg bindings), it could crash the entire application.
- **Limited Lifetime**: Transcoding stops as soon as the main window is closed.

This RFC proposes moving the transcoding logic into a **Headless Background Service** (Tauri Sidecar) that runs independently from the main UI process.

## Proposed Design

### 1. The Sidecar Architecture
The transcoding logic will be moved to a standalone Rust binary (e.g., `video-worker`). This binary will:
- Be compiled as a **Tauri Sidecar**.
- Launch on application startup or when a job is first submitted.
- Persist even if the main UI is closed (standard "background worker" behavior).

### 2. Communication Bridge (IPC)
The Main App and the Worker will communicate via a lightweight protocol:
- **Commands**: Main App sends `ADD_JOB`, `CANCEL_JOB`, `GET_STATUS` to the Worker via `stdin` or a local socket.
- **Events**: Worker sends `PROGRESS_UPDATE`, `JOB_COMPLETE`, `JOB_FAILED` to the Main App via `stdout` or a message queue.

### 3. Benefits of Decoupling
- **Stability**: The main process becomes purely a UI orchestrator. A crash in the worker doesn't kill the app.
- **Resource Management**: The OS can prioritize the UI process over the worker process more effectively.
- **Persistence**: Allows for "Transcode on Quit" where the UI closes but the worker stays alive until the current queue is finished.

### 4. Integration with RFC 0015 (Auto-Recovery)
The `PersistentJobStore` defined in RFC 0015 becomes the "Single Source of Truth" shared between the Main App and the Worker. Both can read/write to the JSON store to synchronize state.

## Implementation Plan
1. Create a new Rust binary target in `src-tauri` for the worker.
2. Refactor `TranscoderManager` to act as a "Worker Client" rather than a "Worker Host."
3. Implement a simple JSON-RPC or message-based protocol for IPC.
4. Configure Tauri to bundle and execute the sidecar.

## User Experience
- App remains perfectly fluid even when 100% of CPU is dedicated to transcoding.
- Professional "Status Bar" application feel where background work doesn't hinder the foreground experience.
