# RFC 0015: Auto-Recovery for Interrupted Transcode Jobs

## Context & Motivation
Transcoding high-resolution or long-duration videos is a time-consuming process. If the application crashes, the system reboots, or power is lost, current transcoding jobs in the memory-only queue are lost. The user must manually identify which files failed and restart the process.

This RFC proposes a persistent job tracking mechanism to allow the application to automatically resume or report interrupted transcode jobs upon restart.

## Proposed Changes

### 1. Persistent Job Store
- Switch from a purely memory-based `VecDeque` in `TranscoderManager` to a file-backed store (e.g., `transcode_jobs.json`) located in the application's data directory.
- Every state change (`Pending` -> `Processing` -> `Completed`/`Failed`) will be mirrored to this file.

### 2. Startup Recovery Logic
- Upon `TranscoderManager::new()` initialization, the manager will:
    1. Read `transcode_jobs.json`.
    2. Identify any jobs left in the `Processing` state (which implies an ungraceful shutdown).
    3. Transition those jobs to `Pending` (to retry) or a new `Interrupted` state, depending on user configuration.
    4. Automatically trigger the worker loop if `Pending` jobs exist.

### 3. Cleanup of Partial Files
- FFmpeg might leave behind partial `.mp4` files if interrupted.
- The recovery logic should detect these partial files (based on the `output_path` in the job record) and either resume (using FFmpeg's concat/append if possible, though re-transcoding is safer) or delete them before restarting the job.

### 4. Quit Prevention & User Alert
- Implement a Tauri Window Event listener for `tauri::window::WindowEvent::CloseRequested`.
- If `TranscoderManager` has active jobs (`Processing` or `Pending` status):
    - INTERCEPT the close event.
    - Show a native dialog (`tauri-plugin-dialog`) asking: "You have active transcoding jobs. Are you sure you want to quit? This will interrupt the conversion."
    - Options: "Quit and Stop Jobs" or "Keep Working".
- This ensures the user is aware of background work that would be lost or need recovery.

### 5. UI Enhancements
- Indicators for "Recovered" or "Resumed" jobs in the `TranscodeQueueUI`.
- A "Clear History" button that actually prunes the persistent JSON file.

## Implementation Plan
1. Define a `PersistentJobStore` trait/struct to handle JSON serialization.
2. Update `TranscoderManager` to load state during `setup`.
3. Add a "Recovered" status to `TranscodeStatus` enum.
4. Ensure the worker thread correctly handles pre-existing files at the `output_path`.
