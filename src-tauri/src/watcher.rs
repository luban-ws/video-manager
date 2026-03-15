use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tokio::time::sleep;

use crate::scanner::process_video_file;

// Define a struct to hold our active watchers.
// We map directory paths to their corresponding notify Watcher instances.
pub struct WatcherState {
    pub watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self::new()
    }
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

pub fn is_video_file(path: &Path) -> bool {
    let video_exts = [
        "mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "mpg", "mpeg", "3gp", "ts",
        "m2ts",
    ];
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        video_exts.contains(&ext.to_lowercase().as_str())
    } else {
        false
    }
}

// Ensure a directory is being watched
#[tauri::command]
pub async fn watch_directory(
    dir_path: String,
    state: State<'_, WatcherState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|_| "Mutex poisoned")?;
    
    // If we're already watching this directory, skip.
    if watchers.contains_key(&dir_path) {
        return Ok(());
    }

    let path = PathBuf::from(&dir_path);
    if !path.exists() || !path.is_dir() {
        return Err("Path is not a valid directory".into());
    }

    let (tx, mut rx) = mpsc::channel(100);

    // Create the standard notify watcher
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                // We forward the raw events to our async tokio task
                let _ = tx.blocking_send(event);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {e}"))?;

    watchers.insert(dir_path.clone(), watcher);

    // Spawn an async task to process events
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            handle_event(event, &app).await;
        }
    });

    println!("Now watching directory: {dir_path}");
    Ok(())
}

#[tauri::command]
pub async fn unwatch_directory(
    dir_path: String,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|_| "Mutex poisoned")?;
    if let Some(mut watcher) = watchers.remove(&dir_path) {
        let _ = watcher.unwatch(Path::new(&dir_path));
        println!("Stopped watching directory: {dir_path}");
    }
    Ok(())
}

async fn handle_event(event: Event, app: &AppHandle) {
    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) => {
            for path in event.paths {
                if is_video_file(&path) {
                    println!("Tauri Watcher: Detected potentially new/modified video: {path:?}");
                    
                    // DEBOUNCE WAIT:
                    // If a user drops a large file, the OS might fire Create/Modify events continuously.
                    // Instead of full debouncing map, we wait a few seconds and check if file size stabilized,
                    // or just optimistically wait 3 seconds before processing it.
                    sleep(Duration::from_secs(3)).await;

                    if path.exists() {
                        let result = process_video_file(&path);
                        if let Ok(true) = result {
                            // Successfully grabbed a new sidecar, alert the UI
                            println!("Tauri Watcher: Generated sidecar for {path:?}");
                            let _ = app.emit("file-added", path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        EventKind::Remove(_) => {
            for path in event.paths {
                if is_video_file(&path) {
                    println!("Tauri Watcher: Detected video removal: {path:?}");
                    // Emit a deletion event so the frontend can remove the UI tile
                    let _ = app.emit("file-deleted", path.to_string_lossy().to_string());
                    
                    // We also potentially want to delete the .md sidecar file here
                    let md_path = path.with_extension("md");
                    if md_path.exists() {
                        let _ = std::fs::remove_file(md_path);
                    }
                }
            }
        }
        _ => {}
    }
}
