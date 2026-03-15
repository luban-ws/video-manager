use crate::filesystem::list_all_markdown_files;
use crate::frontmatter::VideoMetadata;
use std::path::Path;
use regex::Regex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub metadata: VideoMetadata,
    pub matches: Vec<String>, // 匹配的文本片段
}

// 搜索 Markdown 文件内容
pub fn search_files(
    base_dir: &Path,
    query: &str,
    search_in_content: bool,
) -> Result<Vec<SearchResult>, String> {
    let all_files = list_all_markdown_files(base_dir)?;
    let query_lower = query.to_lowercase();
    let query_regex = Regex::new(&regex::escape(query))
        .map_err(|e| format!("创建正则表达式失败: {e}"))?;

    let mut results = Vec::new();

    for file_info in all_files {
        let mut matches = Vec::new();
        let mut matched = false;

        // 搜索元数据
        if file_info.metadata.title.to_lowercase().contains(&query_lower) {
            matches.push(format!("标题: {}", file_info.metadata.title));
            matched = true;
        }

        // 注意：description 字段可能不存在于旧版本的文件中
        if let Some(desc) = &file_info.metadata.description {
            if desc.to_lowercase().contains(&query_lower) {
                matches.push(format!("描述: {desc}"));
                matched = true;
            }
        }

        // 搜索标签
        for tag in &file_info.metadata.tags {
            if tag.to_lowercase().contains(&query_lower) {
                matches.push(format!("标签: {tag}"));
                matched = true;
            }
        }

        // 搜索文件内容
        if search_in_content {
            match std::fs::read_to_string(&file_info.path) {
                Ok(content) => {
                    // 跳过 frontmatter，只搜索内容部分
                    if let Some(content_start) = content.find("---\n") {
                        if let Some(content_end) = content[content_start + 4..].find("---\n") {
                            let markdown_content = &content[content_start + content_end + 8..];
                            
                            for line in markdown_content.lines() {
                                if query_regex.is_match(line) {
                                    let trimmed = line.trim();
                                    if !trimmed.is_empty() {
                                        matches.push(trimmed.to_string());
                                        matched = true;
                                    }
                                }
                            }
                        } else {
                            // 没有 frontmatter，搜索整个内容
                            for line in content.lines() {
                                if query_regex.is_match(line) {
                                    let trimmed = line.trim();
                                    if !trimmed.is_empty() {
                                        matches.push(trimmed.to_string());
                                        matched = true;
                                    }
                                }
                            }
                        }
                    } else {
                        // 没有 frontmatter，搜索整个内容
                        for line in content.lines() {
                            if query_regex.is_match(line) {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    matches.push(trimmed.to_string());
                                    matched = true;
                                }
                            }
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        if matched {
            results.push(SearchResult {
                file_path: file_info.path,
                metadata: file_info.metadata,
                matches,
            });
        }
    }

    Ok(results)
}

// 按标签搜索
pub fn search_by_tags(
    base_dir: &Path,
    tags: &[String],
) -> Result<Vec<SearchResult>, String> {
    let all_files = list_all_markdown_files(base_dir)?;
    let mut results = Vec::new();

    for file_info in all_files {
        let file_tags: Vec<String> = file_info.metadata.tags.iter()
            .map(|t| t.to_lowercase())
            .collect();

        let matched = tags.iter()
            .any(|tag| file_tags.contains(&tag.to_lowercase()));

        if matched {
            results.push(SearchResult {
                file_path: file_info.path,
                metadata: file_info.metadata,
                matches: vec!["标签匹配".to_string()],
            });
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frontmatter::VideoMetadata;
    use crate::filesystem::write_markdown_file;
    use tempfile::tempdir;

    #[test]
    fn test_search_files_by_title() {
        let dir = tempdir().unwrap();
        let meta = VideoMetadata {
            title: "Unique Video Title".to_string(),
            source_type: "local".to_string(),
            video_filename: Some("test.mp4".to_string()),
            url: "".to_string(),
            platform: "local".to_string(),
            thumbnail: None,
            duration: None,
            width: None,
            height: None,
            fps: None,
            codec: None,
            file_size: None,
            tags: vec!["tag1".to_string()],
            description: Some("Description here".to_string()),
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };
        write_markdown_file(&dir.path().join("test.md"), &meta, "## Content").unwrap();

        let results = search_files(dir.path(), "Unique", false).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metadata.title, "Unique Video Title");
    }

    #[test]
    fn test_search_by_tags() {
        let dir = tempdir().unwrap();
        let meta = VideoMetadata {
            title: "Video 1".to_string(),
            source_type: "local".to_string(),
            video_filename: Some("v1.mp4".to_string()),
            url: "".to_string(),
            platform: "local".to_string(),
            thumbnail: None,
            duration: None,
            width: None,
            height: None,
            fps: None,
            codec: None,
            file_size: None,
            tags: vec!["rust".to_string(), "tauri".to_string()],
            description: None,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };
        write_markdown_file(&dir.path().join("v1.md"), &meta, "").unwrap();

        let results = search_by_tags(dir.path(), &["RUST".to_string()]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].metadata.title, "Video 1");
    }
}
