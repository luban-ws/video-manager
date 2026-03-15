use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use base64::Engine;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoFrame {
    pub frame_number: u64,
    pub timestamp: f64, // 时间戳（秒）
    pub width: u32,
    pub height: u32,
    pub data: String, // Base64 编码的 PNG 图像数据
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub frame_count: u64,
}

// 初始化 FFmpeg（需要在应用启动时调用一次）
pub fn init_ffmpeg() -> Result<(), String> {
    ffmpeg_next::init().map_err(|e| format!("FFmpeg 初始化失败: {e}"))?;
    Ok(())
}

// 获取视频信息
pub fn get_video_info(video_path: &str) -> Result<VideoInfo, String> {
    let path = Path::new(video_path);
    if !path.exists() {
        return Err("视频文件不存在".to_string());
    }

    let ictx = ffmpeg_next::format::input(&path)
        .map_err(|e| format!("无法打开视频文件: {e}"))?;

    let video_stream = ictx
        .streams()
        .best(ffmpeg_next::media::Type::Video)
        .ok_or("未找到视频流")?;

    let _video_stream_index = video_stream.index();
    let codec_context = ffmpeg_next::codec::context::Context::from_parameters(video_stream.parameters())
        .map_err(|e| format!("无法创建解码器上下文: {e}"))?;

    let decoder = codec_context
        .decoder()
        .video()
        .map_err(|e| format!("无法创建视频解码器: {e}"))?;

    let time_base = video_stream.time_base();
    let duration = video_stream.duration().max(0) as f64 * f64::from(time_base);
    let fps = video_stream.avg_frame_rate();
    let fps_value = if fps.numerator() > 0 && fps.denominator() > 0 {
        f64::from(fps.numerator()) / f64::from(fps.denominator())
    } else {
        30.0 // 默认帧率
    };

    let frame_count = (duration * fps_value) as u64;

    Ok(VideoInfo {
        duration,
        width: decoder.width(),
        height: decoder.height(),
        fps: fps_value,
        frame_count,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalVideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub file_size: u64,
    pub thumbnail_base64: Option<String>,
}

pub fn extract_metadata_and_thumbnail(video_path: &Path) -> Result<LocalVideoMetadata, String> {
    if !video_path.exists() {
        return Err("视频文件不存在".to_string());
    }

    let file_size = fs::metadata(video_path).map(|m| m.len()).unwrap_or(0);

    let mut ictx = ffmpeg_next::format::input(&video_path)
        .map_err(|e| format!("无法打开视频文件: {e}"))?;

    let video_stream = ictx
        .streams()
        .best(ffmpeg_next::media::Type::Video)
        .ok_or("未找到视频流")?;

    let video_stream_index = video_stream.index();
    let parameters = video_stream.parameters();
    let codec_name = ffmpeg_next::codec::decoder::find(parameters.id())
        .map(|c| c.name().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let codec_context = ffmpeg_next::codec::context::Context::from_parameters(parameters.clone())
        .map_err(|e| format!("无法创建解码器上下文: {e}"))?;

    let mut decoder = codec_context
        .decoder()
        .video()
        .map_err(|e| format!("无法创建视频解码器: {e}"))?;

    let time_base = video_stream.time_base();
    let duration_secs = video_stream.duration().max(0) as f64 * f64::from(time_base);
    let fps = video_stream.avg_frame_rate();
    let fps_value = if fps.numerator() > 0 && fps.denominator() > 0 {
        f64::from(fps.numerator()) / f64::from(fps.denominator())
    } else {
        30.0
    };

    let width = decoder.width();
    let height = decoder.height();

    // seek to 50% to avoid black frames at the beginning
    let seek_target_secs = duration_secs * 0.5;
    let seek_pos = (seek_target_secs / f64::from(time_base)) as i64;
    let _ = ictx.seek(seek_pos, ..seek_pos);

    let mut thumbnail_base64 = None;

    for (stream, packet) in ictx.packets() {
        if stream.index() == video_stream_index {
            let _ = decoder.send_packet(&packet);
            let mut decoded = ffmpeg_next::frame::Video::empty();
            if decoder.receive_frame(&mut decoded).is_ok() {
                // Resize to max 320 width
                let target_w = 320.min(width);
                let target_h = if width > 0 { (height * target_w) / width } else { 180 };
                let mut rgb_frame = ffmpeg_next::frame::Video::empty();
                
                let scaler = ffmpeg_next::software::scaling::Context::get(
                    decoded.format(),
                    decoded.width(),
                    decoded.height(),
                    ffmpeg_next::format::Pixel::RGB24,
                    target_w,
                    target_h,
                    ffmpeg_next::software::scaling::Flags::BILINEAR,
                ).map_err(|e| format!("缩放器错误: {e}"));

                if let Ok(mut scaler) = scaler {
                    let _ = scaler.run(&decoded, &mut rgb_frame);

                    // FFmpeg frames may have padding/stride. Copy row by row to get a tight buffer for the image crate.
                    let actual_w = rgb_frame.width() as usize;
                    let actual_h = rgb_frame.height() as usize;
                    let stride = rgb_frame.stride(0);
                    let data = rgb_frame.data(0);
                    let mut tight_buffer = Vec::with_capacity(actual_w * actual_h * 3);
                    
                    for y in 0..actual_h {
                        let start = y * stride;
                        let end = start + actual_w * 3;
                        if end <= data.len() {
                            tight_buffer.extend_from_slice(&data[start..end]);
                        }
                    }

                    if let Some(img) = image::RgbImage::from_raw(
                        actual_w as u32, 
                        actual_h as u32, 
                        tight_buffer
                    ) {
                        let mut jpg_data = Vec::new();
                        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg_data, 60);
                        if encoder.encode(
                            &img.into_raw(),
                            actual_w as u32,
                            actual_h as u32,
                            image::ColorType::Rgb8,
                        ).is_ok() {
                            let b64 = base64::engine::general_purpose::STANDARD.encode(&jpg_data);
                            thumbnail_base64 = Some(format!("data:image/jpeg;base64,{b64}"));
                        }
                    }
                }
                break; // grabbed one frame
            }
        }
    }

    Ok(LocalVideoMetadata {
        duration: duration_secs,
        width,
        height,
        fps: fps_value,
        codec: codec_name,
        file_size,
        thumbnail_base64
    })
}

// 解码视频帧（返回帧的通道）
pub fn decode_video_frames(
    video_path: &str,
    frame_sender: mpsc::Sender<Result<VideoFrame, String>>,
) -> Result<(), String> {
    let path = PathBuf::from(video_path);
    if !path.exists() {
        return Err("视频文件不存在".to_string());
    }

    thread::spawn(move || {
        let mut ictx = match ffmpeg_next::format::input(&path) {
            Ok(ctx) => ctx,
            Err(e) => {
                let _ = frame_sender.send(Err(format!("无法打开视频文件: {e}")));
                return;
            }
        };

        let video_stream = match ictx.streams().best(ffmpeg_next::media::Type::Video) {
            Some(stream) => stream,
            None => {
                let _ = frame_sender.send(Err("未找到视频流".to_string()));
                return;
            }
        };

        let video_stream_index = video_stream.index();
        let codec_context = match ffmpeg_next::codec::context::Context::from_parameters(
            video_stream.parameters(),
        ) {
            Ok(ctx) => ctx,
            Err(e) => {
                let _ = frame_sender.send(Err(format!("无法创建解码器上下文: {e}")));
                return;
            }
        };

        let mut decoder = match codec_context.decoder().video() {
            Ok(dec) => dec,
            Err(e) => {
                let _ = frame_sender.send(Err(format!("无法创建视频解码器: {e}")));
                return;
            }
        };

        let mut frame_number = 0u64;
        let time_base = video_stream.time_base();

        // 解码视频帧
        for (stream, packet) in ictx.packets() {
            if stream.index() == video_stream_index {
                decoder.send_packet(&packet).unwrap_or(());

                let mut decoded = ffmpeg_next::frame::Video::empty();
                while decoder.receive_frame(&mut decoded).is_ok() {
                    // 转换为 RGB 格式
                    let mut rgb_frame = ffmpeg_next::frame::Video::empty();
                    let scaler = ffmpeg_next::software::scaling::Context::get(
                        decoded.format(),
                        decoded.width(),
                        decoded.height(),
                        ffmpeg_next::format::Pixel::RGB24,
                        decoded.width(),
                        decoded.height(),
                        ffmpeg_next::software::scaling::Flags::BILINEAR,
                    )
                    .map_err(|e| format!("无法创建缩放器: {e}"));

                    if let Ok(mut scaler) = scaler {
                        scaler.run(&decoded, &mut rgb_frame).unwrap_or(());

                        // FFmpeg frames may have padding/stride. Copy row by row.
                        let actual_w = rgb_frame.width() as usize;
                        let actual_h = rgb_frame.height() as usize;
                        let stride = rgb_frame.stride(0);
                        let data = rgb_frame.data(0);
                        let mut tight_buffer = Vec::with_capacity(actual_w * actual_h * 3);
                        
                        for y in 0..actual_h {
                            let start = y * stride;
                            let end = start + actual_w * 3;
                            if end <= data.len() {
                                tight_buffer.extend_from_slice(&data[start..end]);
                            }
                        }

                        let img = image::RgbImage::from_raw(
                            actual_w as u32,
                            actual_h as u32,
                            tight_buffer,
                        );

                        if let Some(img) = img {
                            // 转换为 PNG base64
                            let mut png_data = Vec::new();
                            let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
                            #[allow(deprecated)]
                            if let Ok(()) = encoder.encode(
                                &img.into_raw(),
                                rgb_frame.width(),
                                rgb_frame.height(),
                                image::ColorType::Rgb8,
                            ) {
                                let base64_data = base64::engine::general_purpose::STANDARD
                                    .encode(&png_data);

                                let timestamp = decoded.timestamp().unwrap_or(0) as f64 * f64::from(time_base);

                                let frame = VideoFrame {
                                    frame_number,
                                    timestamp,
                                    width: rgb_frame.width(),
                                    height: rgb_frame.height(),
                                    data: base64_data,
                                };

                                if frame_sender.send(Ok(frame)).is_err() {
                                    return; // 接收端已关闭
                                }

                                frame_number += 1;
                            }
                        }
                    }
                }
            }
        }

        // 发送完成信号
        let _ = frame_sender.send(Err("解码完成".to_string()));
    });

    Ok(())
}

/// 将视频转换为浏览器友好的 MP4 (H.264/AAC)，并报告进度
pub fn transcode_to_mp4<F>(input_path: &Path, output_path: &Path, mut progress_callback: F) -> Result<(), String> 
where F: FnMut(f64) {
    // 1. 获取视频总时长，用于计算进度
    let info = get_video_info(&input_path.to_string_lossy())?;
    let total_duration = info.duration;

    // 2. 检查 ffmpeg 是否可用
    let ffmpeg_check = std::process::Command::new("ffmpeg").arg("-version").output();
    if ffmpeg_check.is_err() {
        return Err("ffmpeg 未安装。请先安装 ffmpeg: https://ffmpeg.org/".to_string());
    }

    // 3. 执行转换并解析 stderr 获取进度
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    let mut child = std::process::Command::new("ffmpeg")
        .args([
            "-i",
            input_path.to_str().ok_or("无效的输入路径")?,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            "-progress",
            "pipe:1", // 将进度信息输出到 stdout
            "-y",
            output_path.to_str().ok_or("无效的输出路径")?,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null()) // Discard stderr to prevent stalling if pipe buffer fills up
        .spawn()
        .map_err(|e| format!("启动 ffmpeg 失败: {e}"))?;

    let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        if let Ok(line) = line {
            // ffmpeg -progress pipe:1 输出格式如:
            // out_time_ms=23000000
            // ...
            // progress=continue
            if line.starts_with("out_time_ms=") {
                if let Ok(ms) = line[12..].parse::<i64>() {
                    let current_secs = ms as f64 / 1_000_000.0;
                    if total_duration > 0.0 {
                        let progress = (current_secs / total_duration * 100.0).min(99.9);
                        progress_callback(progress);
                    }
                }
            }
        }
    }

    let status = child.wait().map_err(|e| format!("等待 ffmpeg 完成失败: {e}"))?;
    if !status.success() {
        return Err("ffmpeg 执行失败".to_string());
    }

    Ok(())
}
