use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use uuid::Uuid;
use crate::{native_video, frontmatter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TranscodeStatus {
    Pending,
    Processing,
    Completed,
    Failed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeJob {
    pub id: String,
    pub video_path: String,
    pub markdown_path: String,
    pub output_path: String,
    pub status: TranscodeStatus,
    pub progress: f64,
    pub title: String,
}

pub struct TranscoderManager {
    jobs: Arc<Mutex<VecDeque<TranscodeJob>>>,
    sender: mpsc::Sender<String>,
}

impl TranscoderManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, mut rx) = mpsc::channel::<String>(100);
        let jobs = Arc::new(Mutex::new(VecDeque::<TranscodeJob>::new()));
        let jobs_inner = Arc::clone(&jobs);

        // Start worker thread
        tauri::async_runtime::spawn(async move {
            while let Some(job_id) = rx.recv().await {
                // Find job
                let job_opt = {
                    let mut jobs = jobs_inner.lock().unwrap();
                    if let Some(job) = jobs.iter_mut().find(|j| j.id == job_id) {
                        job.status = TranscodeStatus::Processing;
                        Some(job.clone())
                    } else {
                        None
                    }
                };

                if let Some(mut job) = job_opt {
                    // Update frontend
                    let _ = app_handle.emit("transcode:status", &job);

                    // Execute transcode
                    let input_path = Path::new(&job.video_path);
                    let output_path = Path::new(&job.output_path);
                    
                    let app_clone = app_handle.clone();
                    let job_id_clone = job_id.clone();
                    let jobs_inner_clone = Arc::clone(&jobs_inner);

                    match native_video::transcode_to_mp4(input_path, output_path, move |progress| {
                        let mut jobs = jobs_inner_clone.lock().unwrap();
                        if let Some(j) = jobs.iter_mut().find(|j| j.id == job_id_clone) {
                            j.progress = progress;
                            let _ = app_clone.emit("transcode:status", &*j);
                        }
                    }) {
                        Ok(_) => {
                            // Update sidecar
                            if let Err(e) = update_sidecar_after_transcode(&job.markdown_path, output_path) {
                                job.status = TranscodeStatus::Failed(format!("Update metadata failed: {e}"));
                            } else {
                                job.status = TranscodeStatus::Completed;
                                job.progress = 100.0;
                                
                                // Optional: Original file backup handle
                                let bak_path = input_path.with_extension(format!("{}.bak", input_path.extension().unwrap_or_default().to_string_lossy()));
                                let _ = std::fs::rename(input_path, bak_path);
                            }
                        }
                        Err(e) => {
                            job.status = TranscodeStatus::Failed(e);
                        }
                    }

                    // Final update
                    {
                        let mut jobs = jobs_inner.lock().unwrap();
                        if let Some(j) = jobs.iter_mut().find(|j| j.id == job_id) {
                            *j = job.clone();
                        }
                    }
                    let _ = app_handle.emit("transcode:status", &job);
                    let _ = app_handle.emit("scan-progress", ()); // Refresh UI lists
                }
            }
        });

        Self { jobs, sender: tx }
    }

    pub fn add_job(&self, video_path: String, markdown_path: String, title: String) -> String {
        let id = Uuid::new_v4().to_string();
        let output_path = Path::new(&video_path).with_extension("mp4").to_string_lossy().to_string();
        
        let job = TranscodeJob {
            id: id.clone(),
            video_path,
            markdown_path,
            output_path,
            status: TranscodeStatus::Pending,
            progress: 0.0,
            title,
        };

        {
            let mut jobs = self.jobs.lock().unwrap();
            jobs.push_back(job);
        }

        let _ = self.sender.try_send(id.clone());
        id
    }

    pub fn get_jobs(&self) -> Vec<TranscodeJob> {
        let jobs = self.jobs.lock().unwrap();
        jobs.iter().cloned().collect()
    }
}

fn update_sidecar_after_transcode(markdown_path: &str, output_path: &Path) -> Result<(), String> {
    println!("[Transcoder] Updating sidecar: {markdown_path}");
    let md_path = Path::new(markdown_path);
    if !md_path.exists() {
        return Err(format!("Sidecar file not found at: {markdown_path}"));
    }
    
    let mut content = std::fs::read_to_string(md_path)
        .map_err(|e| format!("Failed to read sidecar: {e}"))?;

    let (mut fm, body) = frontmatter::parse_markdown(&content)?;
    
    // Extract new metadata (from the generated MP4)
    let new_metadata = native_video::extract_metadata_and_thumbnail(output_path)?;
    
    // DELIBERATELY DO NOT OVERWRITE fm.video_filename!
    // The user wants to keep the original file name (e.g. foo.rmvb) in the markdown sidecar.
    // The Smart Source Selection logic (in filesystem.rs) will automatically detect and play the .mp4.
    
    fm.source_type = "local".to_string();
    fm.duration = Some(new_metadata.duration as i64);
    fm.width = Some(new_metadata.width);
    fm.height = Some(new_metadata.height);
    fm.fps = Some(new_metadata.fps as f64);
    fm.codec = Some(new_metadata.codec);
    fm.file_size = Some(new_metadata.file_size);
    if let Some(thumb) = new_metadata.thumbnail_base64 {
        fm.thumbnail = Some(thumb);
    }
    fm.updated_at = chrono::Utc::now().to_rfc3339();

    content = frontmatter::generate_markdown(&fm, &body)?;
    std::fs::write(md_path, content)
        .map_err(|e| format!("Failed to save sidecar: {e}"))?;

    Ok(())
}
