# RFC 0014: Path-Based Automatic Tagging & Filename-Centric Identity

## Context & Motivation
In a "Portable Sidecar" architecture, the file system itself is a primary source of organization. Users often organize videos into hierarchical folders (e.g., `Movies/Sci-Fi/2020s/`). Manually adding these as tags to frontmatter is redundant and prone to error.

This RFC proposes automatically extracting directory names as tags and ensuring the association between the video file and its Markdown sidecar is driven primarily by the filename.

## Proposed Changes

### 1. Automatic Tag Extraction from Folders
When scanning a library root (e.g., `/Videos`), any subdirectory names between the root and the video file will be added to the `tags` array in the Markdown frontmatter.

**Example**:
- Library Root: `/Volumes/Media/Videos`
- Video Path: `/Volumes/Media/Videos/Documentaries/History/WWII.mp4`
- **Resulting Tags**: `["Documentaries", "History"]`

### 2. Filename-MD Linkage
The system should enforce that the Markdown sidecar always shares the same base name as the video file.
- If `WWII.mp4` is renamed to `WorldWarII.mp4`, the system should provide a way to sync the `.md` file.
- The `title` field in frontmatter should default to the filename stem if not explicitly set.

### 3. Scanner Update (`scanner.rs`)
- Modify `process_video_file` to accept the `library_root` path.
- Calculate the relative path from `library_root` to `video_path`.
- Split the relative path by the system separator and extract directory names as tags.
- Update the default `markdown_content` template to include these auto-tags.

### 4. Logic for Existing Sidecars
- If a sidecar already exists, the "Rebuild" feature should have an option to "Merge Tags" (keep manual tags + update path tags) or "Overwrite Tags".

## User Experience
- No more manual tagging for folder-organized libraries.
- Tags are automatically updated when files are moved to different folders (during a "Rebuild" scan).
- The sidebar "Tags" view will naturally reflect the folder hierarchy.

## Implementation Plan
1. Update `scanner.rs` to pass `dir_path` (root) into `process_video_file`.
2. Implement `extract_tags_from_path(root, file_path)` helper.
3. Update `VideoMetadata` struct and template in `scanner.rs`.
4. Update frontend to better display these path-derived tags in the gallery cards.
