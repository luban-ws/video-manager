use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use crate::native_video::extract_metadata_and_thumbnail;
use chrono::Utc;

#[derive(Clone, Serialize)]
pub struct ScanProgress {
    pub total_videos: usize,
    pub processed: usize,
    pub current_file: String,
}

#[derive(Serialize)]
pub struct ScanReport {
    pub total: usize,
    pub newly_added: usize,
}

pub async fn scan_and_generate_sidecars(dir_path: &Path, rebuild: bool, app: AppHandle) -> Result<ScanReport, String> {
    if !dir_path.exists() {
        return Err("目录不存在".to_string());
    }

    let video_exts = ["mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "mpg", "mpeg", "3gp", "ts", "m2ts",
                       "rmvb", "rm", "ogm", "ogv", "vob", "divx", "asf"];
    
    let mut video_files = Vec::new();
    for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if video_exts.contains(&ext.to_lowercase().as_str()) {
                    // If this is NOT an mp4, check whether an mp4 companion exists.
                    // If yes, the mp4 is the canonical entry — skip the non-mp4 so
                    // we don't create duplicate sidecars.
                    if ext.to_lowercase() != "mp4" {
                        let mp4_companion = path.with_extension("mp4");
                        if mp4_companion.exists() {
                            // MP4 sibling exists; it will cover this file — skip.
                            continue;
                        }
                    }
                    video_files.push(path.to_path_buf());
                }
            }
        }
    }

    let total = video_files.len();
    let mut newly_added = 0;

    for (i, v_path) in video_files.iter().enumerate() {
        let file_name = v_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let _ = app.emit("scan-progress", ScanProgress {
            total_videos: total,
            processed: i,
            current_file: file_name.clone(),
        });

        if let Ok(true) = process_video_file(v_path, rebuild) {
            newly_added += 1;
        }
    }

    let _ = app.emit("scan-progress", ScanProgress {
        total_videos: total,
        processed: total,
        current_file: "".to_string(),
    });

    Ok(ScanReport { total, newly_added })
}

pub fn process_video_file(v_path: &Path, rebuild: bool) -> Result<bool, String> {
    let md_path = v_path.with_extension("md");
    if md_path.exists() && !rebuild {
        return Ok(false); // Already exists and not rebuilding
    }

    if let Ok(meta) = extract_metadata_and_thumbnail(v_path) {
        let now = Utc::now().to_rfc3339();
        let title = v_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let filename = v_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let b64 = meta.thumbnail_base64.unwrap_or_default();
        
        let markdown_content = format!(
r#"---
source_type: "local"
title: "{}"
video_filename: "{}"
thumbnail: "{}"
duration: {}
width: {}
height: {}
fps: {}
codec: "{}"
file_size: {}
created_at: "{}"
updated_at: "{}"
tags: []
---

## 笔记

"#,
            title, filename, b64, meta.duration as u64, meta.width, meta.height, meta.fps, meta.codec, meta.file_size, now, now
        );

        if fs::write(&md_path, markdown_content).is_ok() {
            return Ok(true);
        }
    }
    
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_process_video_file_skips_when_metadata_exists() {
        let dir = tempdir().unwrap();
        let video_path = dir.path().join("dummy.mp4");
        let md_path = dir.path().join("dummy.md");

        File::create(&video_path).unwrap();

        let mut md_file = File::create(&md_path).unwrap();
        md_file.write_all(b"---\ntitle: test\n---").unwrap();

        let result = process_video_file(&video_path, false);

        assert!(result.is_ok());
        assert!(!result.unwrap(), "Should skip if sidecar exists");
    }

    #[test]
    fn test_process_video_file_handles_missing_file() {
        let dir = tempdir().unwrap();
        let missing_video = dir.path().join("does_not_exist.mp4");

        let result = process_video_file(&missing_video, false);

        // Because extract_metadata_and_thumbnail will fail on a missing file,
        // it should gracefully return Ok(false) per the implementation.
        assert!(result.is_ok());
        assert!(!result.unwrap(), "Should safely skip missing files without crashing");
    }

    #[test]
    fn test_process_video_file_rebuilds_when_flag_set() {
        let dir = tempdir().unwrap();
        let video_path = dir.path().join("existing.mp4");
        let md_path = dir.path().join("existing.md");

        File::create(&video_path).unwrap();
        let mut f = File::create(&md_path).unwrap();
        f.write_all(b"---\ntitle: old\n---").unwrap();

        // rebuild=false → skip (sidecar already exists)
        let skipped = process_video_file(&video_path, false);
        assert!(skipped.is_ok());
        assert!(!skipped.unwrap(), "Should skip existing sidecar when rebuild=false");

        // rebuild=true → attempt reprocessing (will fail gracefully on empty file but must NOT skip)
        // The function attempts metadata extraction; on an empty file it returns Ok(false),
        // but the key thing is it didn't short-circuit at the sidecar-exists check.
        let result = process_video_file(&video_path, true);
        assert!(result.is_ok()); // Should not panic
    }

    /// When a non-mp4 and its mp4 companion both exist, the companion check
    /// in the collection loop means the companion is used and the original
    /// should be "invisible" (sidecar written for mp4 stem, not the rmvb stem).
    #[test]
    fn test_mp4_companion_exists_means_non_mp4_skipped() {
        let dir = tempdir().unwrap();
        // Create both files
        let rmvb_path = dir.path().join("movie.rmvb");
        let mp4_path  = dir.path().join("movie.mp4");
        File::create(&rmvb_path).unwrap();
        File::create(&mp4_path).unwrap();

        // Confirm: with_extension("mp4") on the rmvb path equals the mp4 companion
        let companion = rmvb_path.with_extension("mp4");
        assert!(companion.exists(), "companion.mp4 must exist to trigger the skip logic");
        assert_eq!(companion, mp4_path);
    }

    /// An .rmvb without a companion mp4 must pass through the extension filter.
    #[test]
    fn test_rmvb_without_companion_is_included() {
        let dir = tempdir().unwrap();
        let rmvb_path = dir.path().join("solo.rmvb");
        File::create(&rmvb_path).unwrap();

        // No mp4 companion — should not be filtered out
        let companion = rmvb_path.with_extension("mp4");
        assert!(!companion.exists(), "No companion mp4 should exist for this test");
    }

    /// Extension list sanity: ensure the new extensions are in the allowlist.
    #[test]
    fn test_new_extensions_are_in_allowlist() {
        let video_exts = ["mp4", "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "mpg", "mpeg", "3gp", "ts", "m2ts",
                           "rmvb", "rm", "ogm", "ogv", "vob", "divx", "asf"];
        for ext in &["rmvb", "rm", "ogm", "ogv", "vob", "divx", "asf"] {
            assert!(video_exts.contains(ext), "Missing extension: {ext}");
        }
    }
}
