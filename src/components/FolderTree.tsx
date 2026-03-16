import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FileInfo {
  path: string;
  name: string;
  metadata: {
    title: string;
    url: string;
    platform: string;
    tags: string[];
  };
  is_directory: boolean;
  file_type: "markdown" | "video" | "directory" | "other";
}

interface FolderTreeProps {
  baseDir: string;
  onFileSelect: (path: string, fileType: "markdown" | "video" | "directory" | "other") => void;
  selectedPath: string | null;
}

const IconFolder = () => (
  <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-smooth" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

const IconFolderOpen = () => (
  <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5M5 19l2-5a2 2 0 011.888-1.333h8.111a2 2 0 011.888 1.333l1 3.5" />
  </svg>
);

const IconFile = ({ type }: { type: string }) => {
  const isVideo = type === "video";
  const isMD = type === "markdown";
  
  return (
    <svg className={`w-4 h-4 ${isVideo ? 'text-blue-400' : isMD ? 'text-orange-400' : 'opacity-30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {isVideo ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      )}
    </svg>
  );
};

export default function FolderTree({ baseDir, onFileSelect, selectedPath }: FolderTreeProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([baseDir]));

  useEffect(() => {
    if (baseDir) {
      loadFiles(baseDir);
    }
  }, [baseDir]);

  const loadFiles = async (dir: string) => {
    setLoading(true);
    try {
      const fileList = await invoke<FileInfo[]>("list_files", { dirPath: dir });
      setFiles(fileList);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = async (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
      try {
        const subFiles = await invoke<FileInfo[]>("list_files", { dirPath });
        setFiles((prev) => {
          const existingPaths = new Set(prev.map((f) => f.path));
          const newFiles = subFiles.filter((f) => !existingPaths.has(f.path));
          return [...prev, ...newFiles];
        });
      } catch (error) {
        console.error("Failed to load sub-directory:", error);
      }
    }
    setExpandedDirs(newExpanded);
  };

  const renderFile = (file: FileInfo, level: number = 0) => {
    const isSelected = file.path === selectedPath;
    const isExpanded = expandedDirs.has(file.path);

    if (file.is_directory) {
      return (
        <div key={file.path}>
          <div
            className={`group flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-smooth ${
              isSelected 
                ? "bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent)]" 
                : "hover:bg-[var(--bg-tertiary)]/50"
            }`}
            style={{ paddingLeft: `${level * 16 + 16}px` }}
            onClick={() => {
              toggleDirectory(file.path).catch(console.error);
            }}
          >
            {isExpanded ? <IconFolderOpen /> : <IconFolder />}
            <span className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] opacity-80"}`}>
              {file.name}
            </span>
          </div>
          {isExpanded && (
            <div>
              {files
                .filter((f) => f.path.startsWith(file.path + "/") && f.path !== file.path)
                .map((f) => renderFile(f, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={file.path}
        className={`group flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-smooth ${
          isSelected 
            ? "bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent)]" 
            : "hover:bg-[var(--bg-tertiary)]/50"
        }`}
        style={{ paddingLeft: `${level * 16 + 16}px` }}
        onClick={() => onFileSelect(file.path, file.file_type)}
      >
        <IconFile type={file.file_type} />
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-medium truncate ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
            {file.metadata.title || file.name}
          </div>
          {file.metadata.tags.length > 0 && (
            <div className="flex gap-1.5 mt-1.5">
              {file.metadata.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="px-1 py-0.5 bg-[var(--bg-tertiary)] text-[var(--accent)] text-[8px] font-black uppercase tracking-widest rounded-sm border border-[var(--accent)]/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && files.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)] font-black uppercase tracking-tighter opacity-20">
        Loading...
      </div>
    );
  }

  const rootFiles = files.filter((f) => {
    const relativePath = f.path.replace(baseDir, "").trim().replace(/^\/+/, "");
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    return parts.length <= 1;
  });

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-primary)]">
      <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] sticky top-0 z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Filesystem</h3>
      </div>
      <div className="py-2">
        {rootFiles.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] font-mono text-[10px] uppercase opacity-30 italic">
            Empty Directory
          </div>
        ) : (
          rootFiles.map((file) => renderFile(file, 0))
        )}
      </div>
    </div>
  );
}
