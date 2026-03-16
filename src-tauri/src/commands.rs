use crate::{filesystem, frontmatter::{VideoMetadata, update_timestamp}, video, search, git, transcoder};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, State};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoDocument {
    pub path: String,
    pub metadata: VideoMetadata,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub metadata: VideoMetadata,
    pub is_directory: bool,
    pub file_type: String, // "markdown" | "video" | "directory" | "other"
}

// 扫描媒体库（RFC-0011）
#[tauri::command]
pub async fn scan_library(
    library_path: String,
    rebuild: bool,
    app: tauri::AppHandle,
) -> Result<crate::scanner::ScanReport, String> {
    let dir = std::path::Path::new(&library_path);
    crate::scanner::scan_and_generate_sidecars(dir, rebuild, app).await
}

// 提取视频信息并创建 Markdown 文件
#[tauri::command]
pub async fn extract_video_and_create_file(
    url: String,
    base_dir: String,
    _app: AppHandle,
) -> Result<VideoDocument, String> {
    // 提取视频信息
    let video_info = video::extract_video_info(&url)?;

    // 创建元数据
    let now = Utc::now().to_rfc3339();
    let metadata = VideoMetadata {
        title: video_info.title.clone(),
        source_type: "remote".to_string(),
        url: video_info.url.clone(),
        platform: video_info.platform.clone(),
        thumbnail: video_info.thumbnail.clone(),
        duration: video_info.duration,
        description: video_info.description.clone(),
        created_at: now.clone(),
        updated_at: now,
        ..Default::default()
    };

    // 生成初始 Markdown 内容
    let content = format!(
        r#"# {}

## 视频信息
- **平台**: {}
- **链接**: [观看视频]({})
- **时长**: {}

## 笔记
在这里添加你的笔记、想法、总结等...

"#,
        video_info.title,
        video_info.platform,
        url,
        format_duration(video_info.duration),
    );

    // 创建文件
    let base_path = PathBuf::from(&base_dir);
    let file_path = filesystem::create_markdown_file(&base_path, metadata.clone(), &content)?;

    Ok(VideoDocument {
        path: file_path.to_string_lossy().to_string(),
        metadata,
        content,
    })
}

// 读取 Markdown 文件
#[tauri::command]
pub async fn read_markdown_file(file_path: String) -> Result<VideoDocument, String> {
    let path = PathBuf::from(&file_path);
    let (metadata, content) = filesystem::read_markdown_file(&path)?;

    Ok(VideoDocument {
        path: file_path,
        metadata,
        content,
    })
}

// 保存 Markdown 文件
#[tauri::command]
pub async fn save_markdown_file(
    file_path: String,
    metadata: VideoMetadata,
    content: String,
) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    let mut metadata = metadata;
    update_timestamp(&mut metadata);
    filesystem::write_markdown_file(&path, &metadata, &content)?;
    Ok(())
}

// 删除 Markdown 文件
#[tauri::command]
pub async fn delete_markdown_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    filesystem::delete_markdown_file(&path)?;
    Ok(())
}

// 列出目录中的文件
#[tauri::command]
pub async fn list_files(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let path = PathBuf::from(&dir_path);
    let files = filesystem::list_markdown_files(&path)?;

    Ok(files.into_iter().map(|f| FileInfo {
        path: f.path,
        name: f.name,
        metadata: f.metadata,
        is_directory: f.is_directory,
        file_type: match f.file_type {
            filesystem::FileType::Markdown => "markdown".to_string(),
            filesystem::FileType::Video => "video".to_string(),
            filesystem::FileType::Directory => "directory".to_string(),
            filesystem::FileType::Other => "other".to_string(),
        },
    }).collect())
}

// 搜索文件
#[tauri::command]
pub async fn search_files(
    base_dir: String,
    query: String,
    search_in_content: bool,
) -> Result<Vec<FileInfo>, String> {
    let path = PathBuf::from(&base_dir);
    let results = search::search_files(&path, &query, search_in_content)?;

    Ok(results.into_iter().map(|r| {
        let file_path = r.file_path.clone();
        let path_buf = PathBuf::from(&file_path);
        FileInfo {
            path: r.file_path,
            name: path_buf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            metadata: r.metadata,
            is_directory: false,
            file_type: "markdown".to_string(), // 搜索结果都是 Markdown 文件
        }
    }).collect())
}

// 按标签搜索
#[tauri::command]
pub async fn search_by_tags(
    base_dir: String,
    tags: Vec<String>,
) -> Result<Vec<FileInfo>, String> {
    let path = PathBuf::from(&base_dir);
    let results = search::search_by_tags(&path, &tags)?;

    Ok(results.into_iter().map(|r| {
        let file_path = r.file_path.clone();
        let path_buf = PathBuf::from(&file_path);
        FileInfo {
            path: r.file_path,
            name: path_buf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            metadata: r.metadata,
            is_directory: false,
            file_type: "markdown".to_string(), // 搜索结果都是 Markdown 文件
        }
    }).collect())
}

// 获取所有标签
#[tauri::command]
pub async fn get_all_tags(base_dir: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&base_dir);
    let files = filesystem::list_all_markdown_files(&path)?;

    let mut tags = std::collections::HashSet::new();
    for file in files {
        for tag in file.metadata.tags {
            tags.insert(tag);
        }
    }

    let mut tag_vec: Vec<String> = tags.into_iter().collect();
    tag_vec.sort();
    Ok(tag_vec)
}

// Git 操作：初始化仓库
#[tauri::command]
pub async fn git_init(repo_path: String) -> Result<(), String> {
    let path = PathBuf::from(&repo_path);
    git::get_or_init_repo(&path)?;
    Ok(())
}

// Git 操作：添加文件
#[tauri::command]
pub async fn git_add(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = git::open_repo(&PathBuf::from(&repo_path))?;
    git::add_file(&repo, &PathBuf::from(&file_path))?;
    Ok(())
}

// Git 操作：提交
#[tauri::command]
pub async fn git_commit(
    repo_path: String,
    message: String,
    author_name: String,
    author_email: String,
) -> Result<String, String> {
    let repo = git::open_repo(&PathBuf::from(&repo_path))?;
    let commit_id = git::commit(&repo, &message, &author_name, &author_email)?;
    Ok(commit_id)
}

// Git 操作：获取状态
#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<Vec<String>, String> {
    let repo = git::open_repo(&PathBuf::from(&repo_path))?;
    git::get_status(&repo)
}

// Git 操作：获取提交历史
#[tauri::command]
pub async fn git_history(repo_path: String, limit: usize) -> Result<Vec<git::CommitInfo>, String> {
    let repo = git::open_repo(&PathBuf::from(&repo_path))?;
    git::get_commit_history(&repo, limit)
}

// 检查目录是否为空
#[tauri::command]
pub async fn is_directory_empty(dir_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&dir_path);
    
    if !path.exists() {
        return Ok(true);
    }

    if !path.is_dir() {
        return Err("路径不是目录".to_string());
    }

    let mut entries = std::fs::read_dir(&path)
        .map_err(|e| format!("读取目录失败: {e}"))?;

    Ok(entries.next().is_none())
}

// 创建新目录
#[tauri::command]
pub async fn create_directory(
    parent_path: String,
    folder_name: String,
) -> Result<String, String> {
    let parent = PathBuf::from(&parent_path);
    let new_dir = parent.join(&folder_name);

    // 检查父目录是否存在
    if !parent.exists() {
        return Err("父目录不存在".to_string());
    }

    // 检查新目录是否已存在
    if new_dir.exists() {
        return Err("目录已存在".to_string());
    }

    // 创建目录
    std::fs::create_dir_all(&new_dir)
        .map_err(|e| format!("创建目录失败: {e}"))?;

    Ok(new_dir.to_string_lossy().to_string())
}

// 保存粘贴的图片
#[tauri::command]
pub async fn save_pasted_image(
    _base_dir: String,
    file_path: String,
    image_data: Vec<u8>,
    image_name: String,
) -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    // 获取 Markdown 文件所在的目录
    let md_file_path = PathBuf::from(&file_path);
    let md_dir = md_file_path.parent()
        .ok_or("无法获取文件目录")?;

    // 创建 images 文件夹（相对于 Markdown 文件）
    let images_dir = md_dir.join("images");
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("创建图片目录失败: {e}"))?;

    // 生成唯一的文件名
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // 从原始文件名提取扩展名，或使用默认的 png
    let image_path_buf = PathBuf::from(&image_name);
    let extension_str = image_path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    let extension = extension_str.to_string();
    
    let safe_name = sanitize_filename(&image_name);
    let safe_path_buf = PathBuf::from(&safe_name);
    let base_name_str = safe_path_buf
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let base_name = base_name_str.to_string();
    
    let final_name = format!("{base_name}-{timestamp}.{extension}");
    let image_path = images_dir.join(&final_name);

    // 保存图片
    std::fs::write(&image_path, image_data)
        .map_err(|e| format!("保存图片失败: {e}"))?;

    // 返回相对路径（相对于 Markdown 文件）
    let relative_path = image_path.strip_prefix(md_dir)
        .map_err(|e| format!("计算相对路径失败: {e}"))?;

    Ok(format!("./{}", relative_path.to_string_lossy()))
}

// 辅助函数：清理文件名
fn sanitize_filename(name: &str) -> String {
    use regex::Regex;
    let re = Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
    re.replace_all(name, "_").to_string()
        .trim()
        .to_string()
}

// 使用 VLC 播放视频
#[tauri::command]
pub async fn play_video_with_vlc(video_path: String) -> Result<(), String> {
    video::play_video_with_vlc(&video_path)
}

// 检查 VLC 是否可用
#[tauri::command]
pub async fn check_vlc_available() -> Result<bool, String> {
    Ok(video::check_vlc_available())
}

// 辅助函数：格式化时长
fn format_duration(seconds: Option<i64>) -> String {
    match seconds {
        Some(secs) => {
            let hours = secs / 3600;
            let minutes = (secs % 3600) / 60;
            let secs = secs % 60;
            if hours > 0 {
                format!("{hours}:{minutes:02}:{secs:02}")
            } else {
                format!("{minutes}:{secs:02}")
            }
        }
        None => "未知".to_string(),
    }
}

// 永久升级视频为 MP4 (添加到队列)
#[tauri::command]
pub async fn upgrade_video_to_mp4(
    video_path: String,
    markdown_path: String,
    title: String,
    transcoder: State<'_, transcoder::TranscoderManager>,
) -> Result<String, String> {
    Ok(transcoder.add_job(video_path, markdown_path, title))
}

// 获取当前转码任务列表
#[tauri::command]
pub async fn get_transcode_jobs(
    transcoder: State<'_, transcoder::TranscoderManager>,
) -> Result<Vec<transcoder::TranscodeJob>, String> {
    Ok(transcoder.get_jobs())
}

pub fn resolve_player_video_path(video_path: &str) -> String {
    let mut final_path = video_path.to_string();
    let p = std::path::Path::new(video_path);
    if p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) != Some("mp4".to_string()) {
        let mp4_candidate = p.with_extension("mp4");
        if mp4_candidate.exists() {
            final_path = mp4_candidate.to_string_lossy().to_string();
        }
    }
    final_path
}

// 打开独立播放器窗口
#[tauri::command]
pub async fn open_player_window(
    app: tauri::AppHandle,
    video_path: String,
    title: String,
) -> Result<(), String> {
    let window_label = format!("player-{}", uuid::Uuid::new_v4());
    
    // Smart MP4 Fallback: If UI asks to play .rmvb but .mp4 exists, use .mp4
    let final_path = resolve_player_video_path(&video_path);

    // 设置播放器路由
    let url = format!("/player?videoPath={}&title={}",
        urlencoding::encode(&final_path),
        urlencoding::encode(&title)
    );
    
    let window = tauri::WebviewWindowBuilder::new(
        &app,
        window_label,
        tauri::WebviewUrl::App(url.into())
    )
    .title(format!("播放 - {title}"))
    .inner_size(1280.0, 720.0)
    .min_inner_size(640.0, 360.0)
    .resizable(true)
    .build()
    .map_err(|e| format!("无法创建播放器窗口: {e}"))?;

    let _ = window.set_focus();

    Ok(())
}


pub fn find_primary_source_path(video_path: &str) -> std::path::PathBuf {
    let p = std::path::Path::new(video_path);
    let mut source_path = p.to_path_buf();

    // If we were passed the MP4 path, let's look for the original source file 
    // (e.g. .rmvb, .avi) so we can re-encode from the raw source, not a compressed mp4.
    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
        if ext.to_lowercase() == "mp4" {
            if let Some(parent) = p.parent() {
                if let Some(stem) = p.file_stem() {
                    // Supported legacy extensions from our scanner
                    let legacy_exts = [
                        "mkv", "mov", "avi", "webm", "m4v", "flv", "wmv", "mpg", "mpeg", 
                        "3gp", "ts", "m2ts", "rmvb", "rm", "ogm", "ogv", "vob", "divx", "asf"
                    ];
                    for l_ext in &legacy_exts {
                        let candidate = parent.join(stem).with_extension(l_ext);
                        if candidate.exists() && candidate.is_file() {
                            source_path = candidate;
                            break; // prioritize the first one we find
                        }
                        
                        // Check for .bak versions of legacy files
                        let bak_candidate = parent.join(stem).with_extension(format!("{l_ext}.bak"));
                        if bak_candidate.exists() && bak_candidate.is_file() {
                            source_path = bak_candidate;
                            break;
                        }
                    }
                }
            }
        }
    }
    source_path
}

// ─── Re-transcode: delete existing MP4 then re-queue ─────────────────────────
#[tauri::command]
pub async fn retranscode_video(
    video_path: String,
    markdown_path: String,
    title: String,
    transcoder: State<'_, transcoder::TranscoderManager>,
) -> Result<String, String> {
    let p = std::path::Path::new(&video_path);
    let output_path = p.with_extension("mp4");
    
    // Find the original raw source (e.g. .rmvb) if current video_path is the .mp4
    let source_path = find_primary_source_path(&video_path);

    // Delete the old MP4 so the job truly restarts from scratch, and 
    // the frontend won't accidentally play the old one during transcode.
    // Guard: don't delete if input IS already the mp4 and we couldn't find a raw source.
    if output_path.exists() && source_path != output_path {
        std::fs::remove_file(&output_path)
            .map_err(|e| format!("无法删除旧 MP4: {e}"))?;
    }

    Ok(transcoder.add_job(source_path.to_string_lossy().to_string(), markdown_path, title))
}

// ─── Reveal in Finder / Explorer ─────────────────────────────────────────────
#[tauri::command]
pub async fn reveal_in_finder(
    path: String,
    _app: tauri::AppHandle,
) -> Result<(), String> {
    let _p = std::path::Path::new(&path);

    // macOS: `open -R <file>` reveals and selects the exact file in Finder.
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法在 Finder 中显示文件: {e}"))?;
    }
    // Windows / Linux: open the parent directory via the opener plugin.
    #[cfg(not(target_os = "macos"))]
    {
        use tauri_plugin_opener::OpenerExt;
        let dir = if _p.is_file() {
            _p.parent().unwrap_or(_p)
        } else {
            _p
        };
        _app.opener()
            .open_path(dir.to_string_lossy().as_ref(), None::<&str>)
            .map_err(|e| format!("无法打开文件夹: {e}"))?;
    }

    Ok(())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_resolve_player_video_path_mp4_remains_mp4() {
        let dir = tempdir().unwrap();
        let mp4_path = dir.path().join("video.mp4");
        File::create(&mp4_path).unwrap();
        
        let resolved = resolve_player_video_path(mp4_path.to_str().unwrap());
        assert_eq!(resolved, mp4_path.to_str().unwrap());
    }

    #[test]
    fn test_resolve_player_video_path_rmvb_to_mp4_if_exists() {
        let dir = tempdir().unwrap();
        let rmvb_path = dir.path().join("video.rmvb");
        let mp4_path = dir.path().join("video.mp4");
        File::create(&rmvb_path).unwrap();
        File::create(&mp4_path).unwrap();
        
        let resolved = resolve_player_video_path(rmvb_path.to_str().unwrap());
        assert_eq!(resolved, mp4_path.to_str().unwrap());
    }

    #[test]
    fn test_resolve_player_video_path_rmvb_remains_rmvb_if_no_mp4() {
        let dir = tempdir().unwrap();
        let rmvb_path = dir.path().join("video.rmvb");
        File::create(&rmvb_path).unwrap();
        
        let resolved = resolve_player_video_path(rmvb_path.to_str().unwrap());
        assert_eq!(resolved, rmvb_path.to_str().unwrap());
    }

    #[test]
    fn test_find_primary_source_path_rmvb_returns_rmvb() {
        let dir = tempdir().unwrap();
        let rmvb_path = dir.path().join("video.rmvb");
        File::create(&rmvb_path).unwrap();
        
        let source = find_primary_source_path(rmvb_path.to_str().unwrap());
        assert_eq!(source, rmvb_path);
    }

    #[test]
    fn test_find_primary_source_path_mp4_returns_rmvb_if_exists() {
        let dir = tempdir().unwrap();
        let mp4_path = dir.path().join("video.mp4");
        let rmvb_path = dir.path().join("video.rmvb");
        File::create(&mp4_path).unwrap();
        File::create(&rmvb_path).unwrap();
        
        let source = find_primary_source_path(mp4_path.to_str().unwrap());
        assert_eq!(source, rmvb_path);
    }

    #[test]
    fn test_find_primary_source_path_mp4_returns_avi_if_exists() {
        let dir = tempdir().unwrap();
        let mp4_path = dir.path().join("video.mp4");
        let avi_path = dir.path().join("video.avi");
        File::create(&mp4_path).unwrap();
        File::create(&avi_path).unwrap();
        
        let source = find_primary_source_path(mp4_path.to_str().unwrap());
        assert_eq!(source, avi_path);
    }

    #[test]
    fn test_find_primary_source_path_mp4_returns_mp4_if_no_raw_source() {
        let dir = tempdir().unwrap();
        let mp4_path = dir.path().join("video.mp4");
        File::create(&mp4_path).unwrap();
        
        let source = find_primary_source_path(mp4_path.to_str().unwrap());
        assert_eq!(source, mp4_path);
    }

    #[test]
    fn test_find_primary_source_path_mp4_returns_bak_if_exists() {
        let dir = tempdir().unwrap();
        let mp4_path = dir.path().join("video.mp4");
        // Simulated backup of original rmvb
        let bak_path = dir.path().join("video.rmvb.bak");
        File::create(&mp4_path).unwrap();
        File::create(&bak_path).unwrap();
        
        let source = find_primary_source_path(mp4_path.to_str().unwrap());
        assert_eq!(source, bak_path);
    }
}
