import { useEffect } from "react";
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
      <div className="p-6 flex items-center justify-between border-b border-[var(--border)]">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-80">Libraries</h2>
        <button
          onClick={handleAdd}
          className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] hover:opacity-80 transition-smooth"
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {libraries.length === 0 ? (
          <div className="text-[10px] text-center text-[var(--text-secondary)] mt-8 font-mono opacity-50 uppercase tracking-widest italic">No libraries added</div>
        ) : (
          libraries.map((lib) => {
            const isSelected = lib === selectedLibrary;
            const folderName = lib.split(/[\\/]/).pop() || lib;
            return (
              <div
                key={lib}
                onClick={() => onSelectLibrary(lib)}
                className={`group flex flex-col p-3.5 cursor-pointer rounded-sm border transition-smooth ${
                  isSelected 
                    ? "bg-[var(--bg-tertiary)] border-[var(--accent)] shadow-lg shadow-[var(--accent)]/5" 
                    : "hover:bg-[var(--bg-tertiary)]/40 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black truncate tracking-tight ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`} title={lib}>
                    {folderName.toUpperCase()}
                  </span>
                  <div className="hidden group-hover:flex items-center space-x-3">
                    <button onClick={(e) => handleScan(lib, e)} title="Scan for videos" className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-smooth">
                        ⟳
                    </button>
                    <button onClick={async (e) => { 
                      e.stopPropagation(); 
                      try { await invoke("unwatch_directory", { dirPath: lib }); } catch { /* ignore */ }
                      onRemoveLibrary(lib); 
                    }} title="Remove library" className="text-xs text-[var(--text-secondary)] hover:text-white transition-smooth">
                      ×
                    </button>
                  </div>
                </div>
                <div className="text-[9px] text-[var(--text-secondary)] mt-1.5 opacity-40 truncate font-mono" title={lib}>{lib}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <label className="flex items-center space-x-3 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={rebuildMetadata} 
            onChange={(e) => setRebuildMetadata(e.target.checked)}
            className="rounded-sm border-[var(--border)] bg-[var(--bg-primary)] text-[var(--accent)] focus:ring-[var(--accent)] transition-smooth"
          />
          <span className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-smooth">
            Rebuild Metadata
          </span>
        </label>
      </div>

      {scanProgress && (
        <div className="p-6 bg-[var(--bg-primary)] border-t border-[var(--border)] shadow-2xl">
          <div className="mb-2 text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest flex justify-between">
            <span>Scanning Media</span>
            <span className="text-[var(--accent)]">{Math.round(scanProgress.total_videos > 0 ? (scanProgress.processed / scanProgress.total_videos) * 100 : 0)}%</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1 mb-2">
            <div
              className="bg-[var(--accent)] h-1 rounded-full transition-all duration-300 shadow-[0_0_12px_var(--accent)]"
              style={{ width: `${scanProgress.total_videos > 0 ? (scanProgress.processed / scanProgress.total_videos) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="text-[9px] text-[var(--text-secondary)] truncate font-mono opacity-50" title={scanProgress.current_file}>
            {scanProgress.current_file || "READY"}
          </div>
        </div>
      )}
    </div>
  );
}
