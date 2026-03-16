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
        "m2ts", "rmvb", "rm", "ogm", "ogv", "vob", "divx", "asf"
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
    let dir_path_for_loop = PathBuf::from(&dir_path);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            handle_event(event, &app, &dir_path_for_loop).await;
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

async fn handle_event(event: Event, app: &AppHandle, base_dir: &Path) {
    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) => {
            for path in event.paths {
                if is_video_file(&path) {
                    println!("Tauri Watcher: Detected potentially new/modified video: {path:?}");
                    
                    sleep(Duration::from_secs(3)).await;

                    if path.exists() {
                        let result = process_video_file(&path, base_dir, false);
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
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_is_video_file() {
        assert!(is_video_file(Path::new("video.mp4")));
        assert!(is_video_file(Path::new("movie.mkv")));
        assert!(is_video_file(Path::new("CLIP.MOV")));
        assert!(is_video_file(Path::new("old.rmvb")));
        assert!(!is_video_file(Path::new("backup.rmvb.bak"))); // This should be false as .bak is the extension
        assert!(!is_video_file(Path::new("notes.md")));
        assert!(!is_video_file(Path::new("image.png")));
        assert!(!is_video_file(Path::new("no_extension")));
    }
}
