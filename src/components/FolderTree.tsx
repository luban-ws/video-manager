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
      console.error("加载文件列表失败:", error);
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
      // 加载子目录的文件
      try {
        const subFiles = await invoke<FileInfo[]>("list_files", { dirPath });
        setFiles((prev) => {
          // 合并新文件和已有文件，去重
          const existingPaths = new Set(prev.map((f) => f.path));
          const newFiles = subFiles.filter((f) => !existingPaths.has(f.path));
          return [...prev, ...newFiles];
        });
      } catch (error) {
        console.error("加载子目录失败:", error);
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
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
              isSelected 
                ? "bg-[var(--base03)] border-l-2 border-[var(--accent)]" 
                : "hover:bg-[var(--base03)]/50"
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              toggleDirectory(file.path).catch((error) => {
                console.error("切换目录失败:", error);
              });
            }}
          >
            <span className="text-base flex-shrink-0">
              {isExpanded ? "📂" : "📁"}
            </span>
            <span className={`text-sm ${isSelected ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
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

    // 根据文件类型选择图标
    const getFileIcon = () => {
      switch (file.file_type) {
        case "video":
          return "🎬";
        case "markdown":
          return "📝";
        default:
          return "📄";
      }
    };

    return (
      <div
        key={file.path}
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
          isSelected 
            ? "bg-[var(--base03)] border-l-2 border-[var(--accent)]" 
            : "hover:bg-[var(--base03)]/50"
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onFileSelect(file.path, file.file_type)}
      >
        <span className="text-base flex-shrink-0">{getFileIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm truncate ${isSelected ? "font-medium text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
            {file.metadata.title || file.name}
          </div>
          {file.metadata.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {file.metadata.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-[var(--base03)] text-[var(--accent)] text-xs rounded border border-[var(--accent)]/30"
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

  if (loading) {
    return (
      <div className="p-4 text-center text-[var(--text-secondary)] bg-[var(--bg-primary)] h-full">
        <p>加载中...</p>
      </div>
    );
  }

  // 按目录组织文件 - 只显示根目录下的文件和目录
  const rootFiles = files.filter((f) => {
    const relativePath = f.path.replace(baseDir, "").trim().replace(/^\/+/, "");
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    return parts.length <= 1; // 根目录或一级子目录/文件
  });

  return (
    <div className="h-full overflow-auto bg-[var(--bg-primary)]">
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <h3 className="font-semibold text-sm text-[var(--text-secondary)]">文件</h3>
      </div>
      <div className="py-1">
        {rootFiles.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-secondary)] opacity-50 text-sm italic">
            暂无文件
          </div>
        ) : (
          rootFiles.map((file) => renderFile(file, 0))
        )}
      </div>
    </div>
  );
}
