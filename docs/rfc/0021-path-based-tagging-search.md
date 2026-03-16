---
description: Formalize path-based automatic tagging and tag-aware search functionality.
---

# RFC 0021: Path-Based Tagging & Tag-Aware Search

## 1. Problem Statement
Users organize their video collections using nested folder structures (e.g., `Action/2024/Top_Gun.mp4`). Currently, these folder names are not utilized for discovery. The goal is to automatically extract these names as tags and provide a high-performance search interface.

## 2. Proposed Design

### 2.1 Backend: Automatic Path Tagging
During the library scan (`scanner.rs`), we will calculate the relative path of each video file from the library root. 
- **Algorithm**:
  1. Get library root `L`.
  2. Get video file path `V`.
  3. Calculate `R = V.strip_prefix(L)`.
  4. Collect all parent components of `R` as tags.
  5. Include the file stem (filename without extension) as a tag.
- **Example**: `L = /media/videos`, `V = /media/videos/Movies/2024/Hero.mp4`
  - Relative components: `Movies`, `2024`
  - Tags: `["Movies", "2024", "Hero"]`

### 2.2 Backend: Search Logic Enhancement
- Enhance `search::search_files` and `search::search_by_tags` to ensure case-insensitive matching.
- Prioritize matches found in tags during ranking.

### 2.3 Frontend: Unified Search Bar
- **Location**: Top of `VideoGallery.tsx`.
- **Behavior**: Real-time filtering of the `videos` list.
- **Scope**: Matches against `title`, `tags`, and `filename`.
- **UI**: High-fidelity input field reflecting the "Cinema Dark" theme.

## 3. Technical Requirements
- **Rust**: Update `scanner.rs` to handle relative path calculation.
- **TypeScript**: Implement search state and filter logic in `VideoGallery.tsx`.
- **Performance**: Ensure virtualization in `VideoGallery` handles filtered lists smoothly.

## 4. Verification Plan
- **Test Set**: A folder structure with 3 levels of nesting.
- **Criteria**: 
  - Scan correctly populates `tags` field in Markdown frontmatter.
  - Search for a folder name (tag) isolates all contained videos.
  - Search for a filename (tag) isolates the specific video.
