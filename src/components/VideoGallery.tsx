import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface VideoMetadata {
  title?: string;
  thumbnail?: string;
  duration?: number;
  source_type?: string;
  video_filename?: string;
  created_at?: string;
  [key: string]: unknown;
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!libraryPath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-white">
        <p>请从左侧选择一个资料库，或添加新资料库</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">所有视频 ({videos.length})</h1>
          <p className="text-sm text-gray-500 font-mono mt-1">{libraryPath}</p>
        </div>
        <div className="flex space-x-3">
            <button 
                onClick={loadVideos}
                className="px-4 py-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
                刷新
            </button>
            <button 
                onClick={onScanRequest}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
                查找新视频
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {loading && videos.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">加载中...</div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 font-medium mb-1">未找到视频文件</p>
            <p className="text-sm text-gray-400">点击右上角的"查找新视频"来扫描该目录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {videos.map(video => (
              <div 
                key={video.path}
                onClick={() => onSelectVideo(video.path)}
                className="group flex flex-col bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-300"
              >
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                  {video.metadata.thumbnail ? (
                    <img 
                      src={video.metadata.thumbnail} 
                      alt={video.metadata.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">无封面</div>
                  )}
                  {video.metadata.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm text-white text-[11px] rounded font-medium shadow-sm">
                      {formatDuration(video.metadata.duration)}
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors" title={video.metadata.title || video.name}>
                    {video.metadata.title || video.name}
                  </h3>
                  <div className="mt-1.5 text-xs text-gray-400 truncate flex items-center">
                    <svg className="w-3 h-3 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    {video.metadata.video_filename || "Unknown"}
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
