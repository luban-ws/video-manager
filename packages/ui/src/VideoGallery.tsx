import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { formatBytes, formatDuration, type FileInfo } from "@luban-ws/shared";
import { useVirtualizer } from "@tanstack/react-virtual";

interface Props {
  libraryPath: string;
  onVideoSelect: (video: FileInfo) => void;
  onScanRequest: () => void;
}

const CARD_MIN_WIDTH = 240;
const CARD_GAP = 24;

export default function VideoGallery({ libraryPath, onVideoSelect, onScanRequest }: Props) {
  const [videos, setVideos] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Measure parent width
  useEffect(() => {
    if (!parentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setParentWidth(entry.contentRect.width);
      }
    });
    observer.observe(parentRef.current);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (parentWidth === 0) return 1;
    return Math.max(1, Math.floor((parentWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)));
  }, [parentWidth]);

  const loadVideos = useCallback(async () => {
    if (!libraryPath) return;
    setIsLoading(true);
    try {
      const allFiles: FileInfo[] = await invoke("list_files", { dirPath: libraryPath });
      
      const localVideos = allFiles.filter(f => 
        f.file_type === "markdown" && 
        (f.metadata.source_type === "local" || f.metadata.video_filename)
      );

      localVideos.sort((a, b) => {
        const tA = new Date((a.metadata.created_at as string) || 0).getTime();
        const tB = new Date((b.metadata.created_at as string) || 0).getTime();
        return tB - tA;
      });

      setVideos(localVideos);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [libraryPath]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const query = searchQuery.toLowerCase().trim();
    return videos.filter(video => {
      const titleMatch = (video.metadata.title || "").toLowerCase().includes(query);
      const fileMatch = (video.metadata.video_filename || "").toLowerCase().includes(query);
      const tagMatch = (video.metadata.tags || []).some((tag: string) => tag.toLowerCase().includes(query));
      return titleMatch || fileMatch || tagMatch;
    });
  }, [videos, searchQuery]);

  useEffect(() => {
    if (!libraryPath) return;
    loadVideos();
    
    let unlistenAdded: UnlistenFn | null = null;
    let unlistenDeleted: UnlistenFn | null = null;
    
    const setupListeners = async () => {
        unlistenAdded = await listen("file-added", () => loadVideos());
        unlistenDeleted = await listen("file-deleted", () => loadVideos());
    };
    setupListeners();

    const interval = setInterval(loadVideos, 30000);
    
    return () => {
        clearInterval(interval);
        if (unlistenAdded) unlistenAdded();
        if (unlistenDeleted) unlistenDeleted();
    };
  }, [libraryPath, loadVideos]);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(filteredVideos.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 3,
  });

  if (!libraryPath) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] bg-[var(--bg-primary)]">
        <p className="text-lg opacity-60">请从左侧选择一个资料库，或添加新资料库</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="p-8 border-b border-[var(--border)] bg-[var(--bg-primary)] sticky top-0 z-20">
        <div className="flex items-center justify-between mb-8">
            <div>
            <h1 className="text-3xl font-black tracking-tighter text-[var(--text-primary)]">
                LIBRARY <span className="text-[var(--accent)]">({filteredVideos.length})</span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-2 opacity-50 uppercase tracking-widest">{libraryPath}</p>
            </div>
            <div className="flex space-x-4">
                <button 
                    onClick={loadVideos}
                    className="px-6 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-sm text-xs font-black uppercase tracking-widest transition-smooth"
                >
                    Refresh
                </button>
                <button 
                    onClick={onScanRequest}
                    className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-sm text-xs font-black uppercase tracking-widest hover:opacity-90 transition-smooth"
                >
                    Scan Library
                </button>
            </div>
        </div>

        {/* Unified Search Bar */}
        <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none opacity-30 group-focus-within:opacity-100 transition-smooth">
                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH BY FILENAME, TITLE OR TAGS..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] pl-12 pr-4 py-4 rounded-sm text-xs font-mono tracking-widest focus:outline-none focus:border-[var(--accent)] transition-smooth uppercase placeholder:opacity-30"
            />
        </div>
      </div>

      {/* Grid Content */}
      <div ref={parentRef} className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)] h-full">
        {isLoading && filteredVideos.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-secondary)] font-black uppercase tracking-tighter">Loading...</div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-sm border border-[var(--border)] border-dashed">
            <svg className="w-12 h-12 opacity-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-[var(--text-primary)] font-black uppercase tracking-tighter mb-1">
                {searchQuery ? "No Matches Found" : "No Videos Found"}
            </p>
            <p className="text-xs opacity-50 font-mono">
                {searchQuery ? "Try a different query or tag" : "Scan directory to discover media"}
            </p>
          </div>
        ) : (
          <div 
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${CARD_GAP}px`,
                  paddingBottom: `${CARD_GAP}px`,
                }}
              >
                {Array.from({ length: columns }).map((_, colIndex) => {
                  const videoIndex = virtualRow.index * columns + colIndex;
                  const video = filteredVideos[videoIndex];
                  if (!video) return <div key={colIndex} />;

                  return (
                    <div 
                      key={video.path}
                      className="group flex flex-col bg-[var(--bg-secondary)] rounded-sm border border-[var(--border)] overflow-hidden cursor-pointer hover:border-[var(--accent)] transition-smooth relative h-fit"
                    >
                      {/* Thumbnail Container */}
                      <div 
                        className="relative aspect-video bg-black/20 overflow-hidden"
                        onClick={() => onVideoSelect(video)}
                      >
                        {video.metadata.thumbnail ? (
                          <img 
                            src={video.metadata.thumbnail} 
                            alt={video.metadata.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-out"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs font-black uppercase tracking-tighter opacity-20">No Cover</div>
                        )}
                        
                        {video.metadata.duration && (
                          <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] rounded-sm font-black tracking-widest">
                            {formatDuration(video.metadata.duration)}
                          </div>
                        )}
                        
                        {/* High-Fidelity Action Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center space-x-3">
                           <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                                  invoke("open_player_window", { 
                                      videoPath: `${mdDir}/${video.metadata.video_filename}`,
                                      title: video.metadata.title || video.name
                                  });
                              }}
                              className="p-3 bg-white text-black rounded-full hover:scale-110 transition-smooth shadow-2xl"
                              title="Play Attached"
                           >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                              </svg>
                           </button>
                           
                           {/* Reveal in Explorer */}
                           <button
                               onClick={(e) => {
                                   e.stopPropagation();
                                   const mdDir = video.path.substring(0, video.path.lastIndexOf('/'));
                                   invoke("reveal_in_finder", {
                                       path: `${mdDir}/${video.metadata.video_filename}`
                                   });
                               }}
                               className="p-3 bg-[var(--bg-tertiary)] text-white rounded-full hover:scale-110 transition-smooth shadow-2xl"
                               title="Reveal in Finder"
                           >
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                               </svg>
                           </button>
                        </div>
                      </div>

                      {/* Header/Title Section */}
                      <div className="p-4" onClick={() => onVideoSelect(video)}>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-tight group-hover:text-[var(--accent)] transition-smooth mb-2">
                          {video.metadata.title || video.name}
                        </h3>
                        
                        {/* Tags Display */}
                        {video.metadata.tags && video.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {video.metadata.tags.slice(0, 3).map((tag: string) => (
                                    <span 
                                        key={tag} 
                                        className={`text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter ${
                                            searchQuery && tag.toLowerCase().includes(searchQuery.toLowerCase())
                                            ? "bg-[var(--accent)] text-white"
                                            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] opacity-60"
                                        }`}
                                    >
                                        {tag}
                                    </span>
                                ))}
                                {video.metadata.tags.length > 3 && (
                                    <span className="text-[9px] text-[var(--text-secondary)] opacity-40 font-black">+{video.metadata.tags.length - 3}</span>
                                )}
                            </div>
                        )}

                        <div className="mt-auto text-[10px] font-mono text-[var(--text-secondary)] opacity-50 flex items-center justify-between uppercase tracking-widest">
                          <span className="truncate max-w-[120px]">{video.metadata.video_filename || "Master"}</span>
                          <div className="flex space-x-2">
                             {video.metadata.codec && (
                                <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded-sm font-black">
                                    {(video.metadata.codec as string).split('/')[0]}
                                </span>
                            )}
                             {video.metadata.file_size && (
                                <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded-sm font-black">
                                    {formatBytes(video.metadata.file_size)}
                                </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
