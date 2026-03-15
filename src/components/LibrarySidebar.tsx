import React, { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";


export interface ScanProgress {
  total_videos: number;
  processed: number;
  current_file: string;
}

interface Props {
  libraries: string[];
  selectedLibrary: string | null;
  onSelectLibrary: (path: string) => void;
  onAddLibrary: (path: string) => void;
  onRemoveLibrary: (path: string) => void;
  onScanRequest: (path: string) => void;
  scanProgress: ScanProgress | null;
  rebuildMetadata: boolean;
  setRebuildMetadata: (val: boolean) => void;
}

export default function LibrarySidebar({
  libraries,
  selectedLibrary,
  onSelectLibrary,
  onAddLibrary,
  onRemoveLibrary,
  onScanRequest,
  scanProgress,
  rebuildMetadata,
  setRebuildMetadata
}: Props) {
  // No local scanProgress state needed anymore

  // Ensure all registered libraries are being watched natively
  useEffect(() => {
    const watchLibraries = async () => {
      for (const lib of libraries) {
        try {
          await invoke("watch_directory", { dirPath: lib });
        } catch (e) {
          console.error("Failed to watch directory: " + lib, e);
        }
      }
    };
    watchLibraries();
  }, [libraries]);

  const handleAdd = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      onAddLibrary(selected);
    }
  };

  const handleScan = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onScanRequest(path);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] min-w-[200px] max-w-sm overflow-hidden text-[var(--text-primary)]">
      <div className="p-4 flex items-center justify-between border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">我的资料库</h2>
        <button
          onClick={handleAdd}
          className="text-xs font-medium text-[var(--accent)] hover:underline transition-colors"
        >
          + 添加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {libraries.length === 0 ? (
          <div className="text-xs text-center text-gray-400 mt-4">暂无资料库</div>
        ) : (
          libraries.map((lib) => {
            const isSelected = lib === selectedLibrary;
            const folderName = lib.split(/[\\/]/).pop() || lib;
            return (
              <div
                key={lib}
                onClick={() => onSelectLibrary(lib)}
                className={`group flex flex-col p-2.5 cursor-pointer rounded-lg transition-colors ${
                  isSelected ? "bg-[var(--base03)] shadow-sm ring-1 ring-[var(--border)]" : "hover:bg-[var(--base03)]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium truncate ${isSelected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`} title={lib}>
                    {folderName}
                  </span>
                  <div className="hidden group-hover:flex items-center space-x-2">
                    <button onClick={(e) => handleScan(lib, e)} title="扫描视频" className="text-sm text-gray-400 hover:text-green-600 transition-colors">
                      ⟳
                    </button>
                    <button onClick={async (e) => { 
                      e.stopPropagation(); 
                      try { await invoke("unwatch_directory", { dirPath: lib }); } catch { /* ignore */ }
                      onRemoveLibrary(lib); 
                    }} title="移除" className="text-sm text-gray-400 hover:text-red-500 transition-colors">
                      ×
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate" title={lib}>{lib}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--border)]">
        <label className="flex items-center space-x-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={rebuildMetadata} 
            onChange={(e) => setRebuildMetadata(e.target.checked)}
            className="rounded border-[var(--border)] bg-[var(--bg-primary)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
            重构元数据 (重新扫描)
          </span>
        </label>
      </div>

      {scanProgress && (
        <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--border)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="mb-1.5 text-xs text-[var(--text-secondary)] font-medium flex justify-between">
            <span>扫描媒体</span>
            <span className="text-[var(--accent)]">{Math.round(scanProgress.total_videos > 0 ? (scanProgress.processed / scanProgress.total_videos) * 100 : 0)}%</span>
          </div>
          <div className="w-full bg-[var(--base02)] rounded-full h-1.5 mb-1.5">
            <div
              className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_var(--accent)]"
              style={{ width: `${scanProgress.total_videos > 0 ? (scanProgress.processed / scanProgress.total_videos) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] truncate" title={scanProgress.current_file}>
            {scanProgress.current_file || "..."}
          </div>
        </div>
      )}
    </div>
  );
}
