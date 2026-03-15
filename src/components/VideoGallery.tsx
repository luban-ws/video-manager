import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { formatBytes, formatDuration } from "../utils/format";

interface VideoMetadata {
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

interface FileInfo {
  path: string;
  name: string;
  metadata: VideoMetadata;
  is_directory: boolean;
  file_type: string;
}

interface Props {
  libraryPath: string;
  onSelectVideo: (filePath: string) => void;
  onScanRequest: () => void;
}

export default function VideoGallery({ libraryPath, onSelectVideo, onScanRequest }: Props) {
  const [videos, setVideos] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const allFiles: FileInfo[] = await invoke("list_files", { dirPath: libraryPath });
      
      const localVideos = allFiles.filter(f => 
        // 过滤出是本地视频的 markdown 文档
        f.file_type === "markdown" && 
        (f.metadata.source_type === "local" || f.metadata.video_filename)
      );

      // 按创建或修改时间降序排序
      localVideos.sort((a, b) => {
        const tA = new Date((a.metadata.created_at as string) || 0).getTime();
        const tB = new Date((b.metadata.created_at as string) || 0).getTime();
        return tB - tA;
      });

      setVideos(localVideos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [libraryPath]);

  useEffect(() => {
    if (!libraryPath) return;
    loadVideos();
    
    let unlistenAdded: UnlistenFn | null = null;
    let unlistenDeleted: UnlistenFn | null = null;
    
    const setupListeners = async () => {
        unlistenAdded = await listen("file-added", () => {
            console.log("File added event received, refreshing gallery...");
            loadVideos();
        });
        unlistenDeleted = await listen("file-deleted", () => {
            console.log("File deleted event received, refreshing gallery...");
            loadVideos();
        });
    };
    setupListeners();

    // Auto-refresh fallback just in case
    const interval = setInterval(loadVideos, 30000); // 30s auto refresh
    
    return () => {
        clearInterval(interval);
        if (unlistenAdded) unlistenAdded();
        if (unlistenDeleted) unlistenDeleted();
    };
  }, [libraryPath, loadVideos]);

// Moved to utils/format.ts

  if (!libraryPath) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] bg-[var(--bg-primary)]">
        <p>请从左侧选择一个资料库，或添加新资料库</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-primary)] sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">所有视频 ({videos.length})</h1>
          <p className="text-sm text-[var(--text-secondary)] font-mono mt-1">{libraryPath}</p>
        </div>
        <div className="flex space-x-3">
            <button 
                onClick={loadVideos}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--base03)] rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
                刷新
            </button>
            <button 
                onClick={onScanRequest}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors shadow-sm flex items-center space-x-2"
            >
                <span>查找新视频</span>
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
        {loading && videos.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">加载中...</div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] border-dashed">
            <svg className="w-12 h-12 text-[var(--base01)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-[var(--text-primary)] font-medium mb-1">未找到视频文件</p>
            <p className="text-sm text-[var(--text-secondary)]">点击右上角的"查找新视频"来扫描该目录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {videos.map(video => (
              <div 
                key={video.path}
                className="group flex flex-col bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border)] overflow-hidden cursor-pointer hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 relative"
              >
                <div 
                  className="relative aspect-video bg-gray-100 overflow-hidden"
                  onClick={() => onSelectVideo(video.path)}
                >
                  {video.metadata.thumbnail ? (
                    <img 
                      src={video.metadata.thumbnail} 
                      alt={video.metadata.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] bg-[var(--bg-primary)]">无封面</div>
                  )}
                  {video.metadata.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm text-white text-[11px] rounded font-medium shadow-sm">
                      {formatDuration(video.metadata.duration)}
                    </div>
                  )}
                  
                  {/* Action Overlays */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            // Resolve relative to markdown file directory
                            const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                            invoke("open_player_window", { 
                                videoPath: `${mdDir}/${video.metadata.video_filename}`,
                                title: video.metadata.title || video.name
                            });
                        }}
                        className="p-2 bg-[var(--accent)] text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="在独立窗口播放"
                     >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                     </button>
                     {video.metadata.codec && !video.metadata.codec.includes("h264") && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                // Resolve relative to markdown file directory
                                const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                                invoke("upgrade_video_to_mp4", { 
                                    videoPath: `${mdDir}/${video.metadata.video_filename}`,
                                    markdownPath: video.path,
                                    title: video.metadata.title || video.name
                                });
                            }}
                            className="p-2 bg-orange-600 text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                            title="升级到 MP4 (H.264)"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                     )}
                     {/* Re-transcode: always available for manual retry */}
                     <button
                         onClick={(e) => {
                             e.stopPropagation();
                             const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                             invoke("retranscode_video", {
                                 videoPath: `${mdDir}/${video.metadata.video_filename}`,
                                 markdownPath: video.path,
                                 title: video.metadata.title || video.name
                             });
                         }}
                         className="p-2 bg-red-700 text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                         title="重新转码 (Re-transcode)"
                     >
                         {/* Refresh/retry icon */}
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                         </svg>
                     </button>
                     {/* Open Location in Finder/Explorer */}
                     <button
                         onClick={(e) => {
                             e.stopPropagation();
                             const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                             invoke("reveal_in_finder", {
                                 path: `${mdDir}/${video.metadata.video_filename}`
                             });
                         }}
                         className="p-2 bg-[var(--base02)] text-[var(--text-primary)] rounded-full hover:scale-110 transition-transform shadow-lg"
                         title="在 Finder 中显示"
                     >
                         {/* Folder icon */}
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                         </svg>
                     </button>
                  </div>
                </div>
                <div className="p-3.5" onClick={() => onSelectVideo(video.path)}>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors" title={video.metadata.title || video.name}>
                    {video.metadata.title || video.name}
                  </h3>
                  <div className="mt-1.5 text-xs text-[var(--text-secondary)] truncate flex items-center">
                    <svg className="w-3 h-3 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    {video.metadata.video_filename || "Unknown"}
                    {video.metadata.codec && (
                        <span className="ml-2 px-1 rounded bg-[var(--base03)] text-[10px]">
                            {(video.metadata.codec as string).split('/')[0]}
                        </span>
                    )}
                    {video.metadata.file_size && (
                        <span className="ml-2 px-1 rounded bg-[var(--base02)] text-[10px] text-[var(--base1)]">
                            {formatBytes(video.metadata.file_size)}
                        </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
