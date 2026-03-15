use crate::frontmatter::{VideoMetadata, generate_markdown, parse_markdown};
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum FileType {
    Markdown,
    Video,
    Directory,
    Other,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub metadata: VideoMetadata,
    pub is_directory: bool,
    pub file_type: FileType,
}

// 检测文件类型
fn detect_file_type(path: &Path) -> FileType {
    if path.is_dir() {
        return FileType::Directory;
    }

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        match ext_lower.as_str() {
            "md" | "markdown" => FileType::Markdown,
            // 常见视频格式
            "mp4" | "m4v" | "mov" | "qt" => FileType::Video, // MP4 系列
            "avi" | "divx" | "xvid" => FileType::Video, // AVI 系列
            "mkv" | "webm" | "ogv" | "ogg" => FileType::Video, // 开源格式
            "flv" | "f4v" => FileType::Video, // Flash 视频
            "wmv" | "asf" => FileType::Video, // Windows Media
            "rm" | "rmvb" | "ra" => FileType::Video, // RealMedia
            "mpg" | "mpeg" | "mpe" | "m2v" | "mpv" => FileType::Video, // MPEG 系列
            "3gp" | "3g2" => FileType::Video, // 移动设备格式
            "ts" | "mts" | "m2ts" => FileType::Video, // 传输流
            "vob" => FileType::Video, // DVD 视频
            "dat" => FileType::Video, // VCD 视频
            _ => FileType::Other,
        }
    } else {
        FileType::Other
    }
}

// 读取 Markdown 文件
pub fn read_markdown_file(file_path: &Path) -> Result<(VideoMetadata, String), String> {
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("读取文件失败: {e}"))?;

    parse_markdown(&content)
}

// 写入 Markdown 文件
pub fn write_markdown_file(
    file_path: &Path,
    metadata: &VideoMetadata,
    content: &str,
) -> Result<(), String> {
    let markdown = generate_markdown(metadata, content)?;

    // 确保目录存在
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {e}"))?;
    }

    fs::write(file_path, markdown)
        .map_err(|e| format!("写入文件失败: {e}"))?;

    Ok(())
}

// 创建新的 Markdown 文件
pub fn create_markdown_file(
    base_dir: &Path,
    metadata: VideoMetadata,
    content: &str,
) -> Result<PathBuf, String> {
    // 生成安全的文件名（基于标题）
    let safe_title = sanitize_filename(&metadata.title);
    let file_name = format!("{safe_title}.md");
    let file_path = base_dir.join(&file_name);

    // 如果文件已存在，添加时间戳
    let final_path = if file_path.exists() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        base_dir.join(format!("{safe_title}-{timestamp}.md"))
    } else {
        file_path
    };

    write_markdown_file(&final_path, &metadata, content)?;
    Ok(final_path)
}

// 删除 Markdown 文件
pub fn delete_markdown_file(file_path: &Path) -> Result<(), String> {
    fs::remove_file(file_path)
        .map_err(|e| format!("删除文件失败: {e}"))?;
    Ok(())
}

// 列出目录中的所有文件（递归搜索 Markdown 和视频文件）
pub fn list_markdown_files(dir_path: &Path) -> Result<Vec<FileInfo>, String> {
    use walkdir::WalkDir;
    let mut files = Vec::new();

    if !dir_path.exists() {
        return Ok(files);
    }

    // 使用 WalkDir 递归遍历，排除隐藏文件和目录
    for entry in WalkDir::new(dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
    {
        let path = entry.path();
        
        // 我们不在这里递归添加目录项到画廊视图，只添加文件
        if path.is_dir() {
            continue;
        }

        let file_type = detect_file_type(path);

        if file_type == FileType::Markdown {
            // 只处理 Markdown 文件，尝试解析 frontmatter
            match read_markdown_file(path) {
                Ok((mut metadata, _)) => {
                    // Smart Source Selection (RFC-0013): 优先使用同名的 .mp4 文件
                    if let Some(ref filename) = metadata.video_filename {
                        let video_p = Path::new(filename);
                        if video_p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) != Some("mp4".to_string()) {
                            let mp4_filename = video_p.with_extension("mp4");
                            if let Some(parent) = path.parent() {
                                let mp4_path = parent.join(&mp4_filename);
                                if mp4_path.exists() {
                                    // 发现同名 mp4，透明优先使用
                                    metadata.video_filename = Some(mp4_filename.to_string_lossy().to_string());
                                }
                            }
                        }
                    }

                    files.push(FileInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        metadata,
                        is_directory: false,
                        file_type: FileType::Markdown,
                    });
                }
                Err(_) => {
                    // 跳过无法解析的文件
                    continue;
                }
            }
        } else if file_type == FileType::Video {
            // 视频文件：使用文件名作为标题
            files.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                name: path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                metadata: VideoMetadata {
                    title: path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                    source_type: "local".to_string(),
                    video_filename: Some(path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string()),
                    platform: "本地视频".to_string(),
                    ..Default::default()
                },
                is_directory: false,
                file_type: FileType::Video,
            });
        }
    }

    Ok(files)
}

// 递归列出所有 Markdown 文件（包括子目录）
pub fn list_all_markdown_files(dir_path: &Path) -> Result<Vec<FileInfo>, String> {
    use walkdir::WalkDir;
    let mut files = Vec::new();

    if !dir_path.exists() {
        return Ok(files);
    }

    for entry in WalkDir::new(dir_path) {
        let entry = entry.map_err(|e| format!("遍历目录失败: {e}"))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            match read_markdown_file(path) {
                Ok((metadata, _)) => {
                    files.push(FileInfo {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string(),
                        metadata,
                        is_directory: false,
                        file_type: FileType::Markdown,
                    });
                }
                Err(_) => continue,
            }
        }
    }

    Ok(files)
}

// 清理文件名（移除不安全字符）
fn sanitize_filename(name: &str) -> String {
    use regex::Regex;
    let re = Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
    re.replace_all(name, "_").to_string()
        .trim()
        .to_string()
}
