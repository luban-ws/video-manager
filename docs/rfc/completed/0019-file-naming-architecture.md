# RFC 0019: Direct Video Naming & Management (High Fidelity)

## 1. Problem Statement
Confusing naming schemes like `.bak` create a "black box" experience. However, "Direct Output" to the final destination can fail when FFmpeg needs to transcode an existing file into its own path (In-place limitation). We need a system that is transparent, non-destructive, and technically robust.

## 2. Technical Specification

### 2.1 File Relationship & Persistence
We maintain a 1:1:N relationship between Sidecars, Originals, and optimized versions.

| Node Type | Path Pattern | State | Lifecycle |
| :--- | :--- | :--- | :--- |
| **Sidecar (Metadata)** | `filename.md` | Primary | Created on first scan; updated after transcode. |
| **Master Source** | `filename.legacy` | **Immutable** | Never modified. Source of truth for re-transcoding. |
| **Optimized Target**| `filename.mp4` | Generated | Created by Transcoder. Primary for playback. |

### 2.2 Metadata Ledger (Frontmatter Schema)

| Field | Type | Description |
| :--- | :--- | :--- |
| `video_filename` | `string` | The **active** filename used for playback (e.g. `film.mp4`). |
| `original_video_filename` | `string`| The name of the **first raw source file** found (e.g. `film.rmvb`). |

### 2.3 The "Pragmatic Staging" Phase
To ensure atomic completion and avoid FFmpeg's "Output same as Input" error, we use a transient staging area:

1.  **Staging**: FFmpeg writes to a hidden `.[filename].working.[ext]` file (e.g., `.movie.working.mp4`). This preserves the extension for FFmpeg's format auto-detection.
2.  **Visibility**: This file is hidden from the user's primary views to maintain a clean UI.
3.  **Atomic Commit**: On successful exit (code 0), the backend performs an atomic `std::fs::rename` to the final `filename.mp4`.
4.  **Failure Isolation**: On failure, the hidden working file is immediately deleted.

### 2.4 Playback Precedence (Smart Resolution)
1. **Primary**: Read `video_filename` from MD. If it exists, use it.
2. **Auto-Upgrade**: If MD points to `foo.rmvb` BUT `foo.mp4` exists, play `.mp4` anyway.
3. **Audit Resilience**: Always use `original_video_filename` as the re-transcoding input.

## 3. Backend Module Architecture (Good Taste Requirements)

To satisfy the "Good Taste" principle, core logic must be decoupled from the API layer.

### 3.1 Separation of Concerns
-   **Core Domain**: `filesystem.rs` & `frontmatter.rs` define the naming policy and schema. They are pure, non-async, and testable.
-   **Service Layer**: `transcoder.rs` & `native_video.rs` handle the async process execution and staging lifecycle.
-   **API Layer**: `commands.rs` acts as the thin IPC bridge (Userspace).

### 3.2 Crate Evolution
The system is designed to be extracted into a standalone `video-core` crate if cross-project reuse is needed. This ensures the "Full Picture" logic is an immutable dependency of the UI.

## 4. Operational Policies

### 4.1 Short-Circuit Policy (Noop Rule)
To prevent redundant work and "Input same as Output" errors, the system enforces a short-circuit guard:
- **Rule**: If a conversion is requested for a file that already has the `.mp4` extension, the backend MUST return success immediately without spawning FFmpeg.
- **UI Responsibility**: The "Upgrade to MP4" button MUST be hidden for all files with the `.mp4` extension, regardless of perceived codec quality, unless a manual "Re-transcode" is explicitly triggered by the user from the master source.

### 4.2 Implementation Rules
- **Absolute Immutability**: No `.bak` renaming.
- **Hidden Staging**: Use the `.[filename].working.[ext]` pattern for the duration of the transcode ONLY.
- **Ledger-Based Discovery**: The `.md` sidecar is the source of truth for file provenance.
- **Smart Short-Circuit**: Skip conversion if target format is already reached.
