use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VideoMetadata {
    pub title: String,
    #[serde(default)]
    pub source_type: String, // "local" or "remote"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_filename: Option<String>,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub platform: String,
    pub thumbnail: Option<String>,
    pub duration: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// 解析 Markdown 文件的 frontmatter 和内容
pub fn parse_markdown(content: &str) -> Result<(VideoMetadata, String), String> {
    // 检查是否有 frontmatter（以 --- 开头）
    if !content.starts_with("---\n") {
        // 如果没有 frontmatter，创建默认的
        let now = chrono::Utc::now().to_rfc3339();
        let metadata = VideoMetadata {
            title: "未命名文档".to_string(),
            source_type: "markdown".to_string(),
            created_at: now.clone(),
            updated_at: now,
            ..Default::default()
        };
        return Ok((metadata, content.to_string()));
    }

    // 找到第二个 --- 的位置
    let end_marker = content[4..]
        .find("---\n")
        .ok_or("文件格式错误：frontmatter 未正确关闭")?;

    let frontmatter_str = &content[4..end_marker + 4];
    let markdown_content = content[end_marker + 8..].trim().to_string();

    // 解析 YAML frontmatter
    let metadata: VideoMetadata = serde_yaml::from_str(frontmatter_str)
        .map_err(|e| format!("解析 frontmatter 失败: {e}"))?;

    Ok((metadata, markdown_content))
}

// 生成带 frontmatter 的 Markdown 内容
pub fn generate_markdown(metadata: &VideoMetadata, content: &str) -> Result<String, String> {
    let yaml_str =
        serde_yaml::to_string(metadata).map_err(|e| format!("生成 frontmatter 失败: {e}"))?;

    Ok(format!("---\n{yaml_str}---\n\n{content}"))
}

// 更新 frontmatter 中的 updated_at 字段
pub fn update_timestamp(metadata: &mut VideoMetadata) {
    metadata.updated_at = chrono::Utc::now().to_rfc3339();
}
