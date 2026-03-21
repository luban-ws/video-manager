use serde::{Deserialize, Serialize};
use std::process::Command;
use std::str;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub url: String,
    pub title: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<i64>,
    pub platform: String,
}

// 从 URL 检测平台
pub fn detect_platform(url: &str) -> String {
    if url.contains("youtube.com") || url.contains("youtu.be") {
        "YouTube".to_string()
    } else if url.contains("vimeo.com") {
        "Vimeo".to_string()
    } else if url.contains("bilibili.com") {
        "Bilibili".to_string()
    } else {
        "其他".to_string()
    }
}

// 使用 yt-dlp 提取视频信息
pub fn extract_video_info(url: &str) -> Result<VideoInfo, String> {
    // 检查 yt-dlp 是否可用
    let yt_dlp_check = Command::new("yt-dlp").arg("--version").output();

    if yt_dlp_check.is_err() {
        return Err("yt-dlp 未安装。请先安装 yt-dlp: https://github.com/yt-dlp/yt-dlp".to_string());
    }

    // 提取视频信息（JSON 格式）
    let output = Command::new("yt-dlp")
        .args(["--dump-json", "--no-download", url])
        .output()
        .map_err(|e| format!("执行 yt-dlp 失败: {e}"))?;

    if !output.status.success() {
        let error_msg = str::from_utf8(&output.stderr)
            .unwrap_or("未知错误")
            .to_string();
        return Err(format!("yt-dlp 执行失败: {error_msg}"));
    }

    // 解析 JSON 输出
    let json_str = str::from_utf8(&output.stdout).map_err(|e| format!("解析输出失败: {e}"))?;

    let json: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("解析 JSON 失败: {e}"))?;

    // 提取信息
    let title = json["title"].as_str().unwrap_or("未知标题").to_string();

    let description = json["description"].as_str().map(|s| s.to_string());

    let thumbnail = json["thumbnail"].as_str().map(|s| s.to_string());

    let duration = json["duration"].as_f64().map(|d| d as i64);

    let platform = detect_platform(url);

    Ok(VideoInfo {
        url: url.to_string(),
        title,
        description,
        thumbnail,
        duration,
        platform,
    })
}

// 下载视频
#[allow(dead_code)]
pub fn download_video(url: &str, output_path: &str) -> Result<(), String> {
    let output = Command::new("yt-dlp")
        .args(["-o", output_path, url])
        .output()
        .map_err(|e| format!("执行 yt-dlp 失败: {e}"))?;

    if !output.status.success() {
        let error_msg = str::from_utf8(&output.stderr)
            .unwrap_or("未知错误")
            .to_string();
        return Err(format!("下载失败: {error_msg}"));
    }

    Ok(())
}

// 使用 VLC 播放视频文件
pub fn play_video_with_vlc(video_path: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        // macOS: 优先使用 open 命令（更可靠）
        let first_attempt = Command::new("open")
            .args(["-a", "VLC", video_path])
            .spawn();

        match first_attempt {
            Ok(_) => Ok(()),
            Err(e) => {
                // 如果 open 失败，尝试直接路径
                Command::new("/Applications/VLC.app/Contents/MacOS/VLC")
                    .arg(video_path)
                    .spawn()
                    .map_err(|e2| {
                        format!(
                            "无法启动 VLC: {e} (尝试直接路径也失败: {e2})。请确保 VLC 已安装。"
                        )
                    })?;
                Ok(())
            }
        }
    } else if cfg!(target_os = "windows") {
        // Windows: 尝试使用 vlc 命令
        Command::new("vlc")
            .arg(video_path)
            .spawn()
            .map_err(|e| format!("无法启动 VLC: {e}。请确保 VLC 已安装并在 PATH 中。"))?;
        Ok(())
    } else {
        // Linux: 使用 vlc 命令
        Command::new("vlc")
            .arg(video_path)
            .spawn()
            .map_err(|e| format!("无法启动 VLC: {e}。请确保 VLC 已安装并在 PATH 中。"))?;
        Ok(())
    }
}

// 检查 VLC 是否可用
pub fn check_vlc_available() -> bool {
    if cfg!(target_os = "macos") {
        // macOS: 检查应用程序是否存在
        std::path::Path::new("/Applications/VLC.app/Contents/MacOS/VLC").exists()
            || Command::new("which").arg("vlc").output().is_ok()
    } else if cfg!(target_os = "windows") {
        // Windows: 尝试查找 vlc.exe
        Command::new("where").arg("vlc").output().is_ok()
    } else {
        // Linux: 使用 which 命令
        Command::new("which").arg("vlc").output().is_ok()
    }
}
