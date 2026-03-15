# RFC 0016: Post-Transcode Integrity Validation

## Context & Motivation
Transcoding is a complex process. Even if FFmpeg returns a success code, the resulting file might have issues such as:
- Shortened duration (truncated conversion).
- Missing audio tracks.
- Desynchronized audio/video.
- Corruption in specific frames.

To ensure "Good Taste" and technical excellence, we need a validation step after Every transcode to confirm the output meets the user's expectations.

## Proposed Changes

### 1. Multi-Point Validation Suite
After Every transcode, the system will run a validation suite comparing the original video metadata with the transcoded result:

- **Duration Check**: The duration of the transcoded file must match the original within a strict tolerance (e.g., ±0.1s).
- **Stream Consistency**: Ensure the number of video and audio streams matches or exceeds a "playable" threshold.
- **Audio Presence**: Explicitly check that an audio stream exists and has a non-zero bitrate if the original file had audio.
- **Header Integrity**: Use `ffmpeg -v error -i [output] -f null -` to check for elementary stream errors.

### 2. Integration with Transcoder Manager
- The `TranscoderManager` worker loop will call `native_video::validate_transcode(input, output)` before marking a job as `Completed`.
- If validation fails, the job status will transition to `Failed` with a specific validation error message (e.g., "Validation failed: Duration mismatch").

### 3. User Notification of Validation Failure
- If a validation fails, the `TranscodeQueueUI` will display a warning.
- The system will NOT overwrite or backup the original file if validation fails, preserving the original data for manual inspection.

### 4. Implementation in `native_video.rs`
- Add a `validate_transcode` function that performs these checks using `ffprobe` or `ffmpeg-next`.

## User Experience
- Higher confidence in "Upgrade to MP4" actions.
- Automatic protection against silent conversion failures.
- Detailed error reporting for edge-case files that FFmpeg struggle with.

## Implementation Plan
1. Add `validate_transcode` function to `native_video.rs`.
2. Update the `TranscoderManager` worker loop to include the validation step.
3. Update `TranscodeStatus` if new failure types are needed.
4. Add a "Force Complete" override in the UI for users who want to keep a slightly mismatched file.
