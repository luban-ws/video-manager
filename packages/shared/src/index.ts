export interface VideoMetadata {
  title?: string;
  thumbnail?: string;
  duration?: number;
  source_type?: string;
  video_filename?: string;
  created_at?: string;
  codec?: string;
  file_size?: number;
  width?: number;
  height?: number;
  fps?: number;
  tags?: string[];
}

export interface FileInfo {
  path: string;
  name: string;
  metadata: VideoMetadata;
  is_directory: boolean;
  file_type: string;
}

export interface ScanProgress {
  total_videos: number;
  processed: number;
  current_file: string;
}

export * from "./format";
