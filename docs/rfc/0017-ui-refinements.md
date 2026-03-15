# RFC 0017: UI & Gallery Refinements

## Context & Motivation
The Video Gallery is the primary entry point for users. While it currently shows thumbnails and titles, users often need quick access to technical details like file size to manage their storage or decide which files to transcode/upgrade.

## Proposed Changes

### 1. Enhanced Video Card Information
- **Video Size Display**: The video card will now display the file size in a human-readable format (e.g., `1.2 GB`, `450 MB`) in the metadata overlay.
- **Location**: Bottom-right or near the duration/resolution overlay on the video thumbnail.
- **Formatting**: Implement a `formatFileSize` utility in the frontend to convert bytes into MB/GB.

### 2. Technical Badge Integration
- Display a small badge if the video is using a "Compatible MP4" (as per RFC 0013).
- Display a "High Res" badge for 4K+ content.

### 3. Layout Adjustments
- Slightly increase the spacing in the metadata footer of the card to accommodate the newer information without feeling cluttered ("Good Taste").

## User Experience
- Immediate visibility into storage usage within the gallery.
- Easier identification of large legacy files that are prime candidates for H.264 "Upgrading".

## Implementation Plan
1. Update `VideoMetadata` TypeScript interface to ensure `file_size` is always present.
2. Update `VideoGallery.tsx` to include the size display in the card overlay.
3. Add `formatBytes` utility to a new `src/utils/format.ts` file.
4. Refine CSS in `VideoGallery.tsx` for the new overlays.
