use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VideoMetadata {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub source_type: String, // "local" or "remote"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_video_filename: Option<String>,
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
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_markdown_with_frontmatter() {
        let content = "---\ntitle: My Video\nsource_type: local\ncreated_at: '2024-01-01T00:00:00Z'\nupdated_at: '2024-01-01T00:00:00Z'\ntags: []\n---\n\n## Notes\n";
        let (meta, body) = parse_markdown(content).unwrap();
        assert_eq!(meta.title, "My Video");
        assert_eq!(meta.source_type, "local");
        assert!(body.contains("Notes"));
    }

    #[test]
    fn test_parse_markdown_without_frontmatter_uses_defaults() {
        let content = "Just some plain markdown.";
        let (meta, body) = parse_markdown(content).unwrap();
        assert_eq!(meta.title, "未命名文档");
        assert_eq!(body, content);
    }

    #[test]
    fn test_generate_then_parse_roundtrip() {
        let meta = VideoMetadata {
            title: "Round Trip".to_string(),
            source_type: "local".to_string(),
            video_filename: Some("video.mp4".to_string()),
            tags: vec!["foo".to_string(), "bar".to_string()],
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            ..Default::default()
        };
        let generated = generate_markdown(&meta, "## Body").unwrap();
        let (parsed_meta, parsed_body) = parse_markdown(&generated).unwrap();
        assert_eq!(parsed_meta.title, "Round Trip");
        assert_eq!(parsed_meta.tags, vec!["foo", "bar"]);
        assert!(parsed_body.contains("Body"));
    }

    #[test]
    fn test_parse_tags_default_empty() {
        let content = "---\ntitle: NoTags\nsource_type: local\ncreated_at: '2024-01-01T00:00:00Z'\nupdated_at: '2024-01-01T00:00:00Z'\n---\n";
        let (meta, _) = parse_markdown(content).unwrap();
        assert!(meta.tags.is_empty(), "tags should default to empty vec");
    }

    #[test]
    fn test_update_timestamp_changes_field() {
        let mut meta = VideoMetadata {
            updated_at: "2000-01-01T00:00:00Z".to_string(),
            created_at: "2000-01-01T00:00:00Z".to_string(),
            title: "t".to_string(),
            source_type: "local".to_string(),
            ..Default::default()
        };
        let old = meta.updated_at.clone();
        // small sleep to ensure clock advances
        std::thread::sleep(std::time::Duration::from_millis(10));
        update_timestamp(&mut meta);
        assert_ne!(meta.updated_at, old, "updated_at must be updated");
    }
}
