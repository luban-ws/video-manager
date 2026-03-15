import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import LibrarySidebar, { ScanProgress } from "./components/LibrarySidebar";
import VideoGallery from "./components/VideoGallery";
import MarkdownEditor from "./components/MarkdownEditor";
import ResizableSplitter from "./components/ResizableSplitter";

const STORAGE_KEY = "video-manager-libraries";
const SELECTED_LIB_KEY = "video-manager-selected-lib";

function App() {
  const [libraries, setLibraries] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });

  const [selectedLibrary, setSelectedLibrary] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_LIB_KEY);
  });
  
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<"markdown" | "video" | "directory" | "other">("markdown");

  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn;
    const setup = async () => {
      unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        setScanProgress(event.payload);
        if (event.payload.processed === event.payload.total_videos && event.payload.total_videos > 0) {
          setTimeout(() => setScanProgress(null), 2000);
        }
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // No need for initial load useEffect anymore

  const handleAddLibrary = (path: string) => {
    if (!libraries.includes(path)) {
      const newLibs = [...libraries, path];
      setLibraries(newLibs);
      setSelectedLibrary(path);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLibs));
      localStorage.setItem(SELECTED_LIB_KEY, path);
    }
  };

  const handleRemoveLibrary = (path: string) => {
    const newLibs = libraries.filter(l => l !== path);
    setLibraries(newLibs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLibs));
    if (selectedLibrary === path) {
      const next = newLibs.length > 0 ? newLibs[0] : null;
      setSelectedLibrary(next);
      if (next) localStorage.setItem(SELECTED_LIB_KEY, next);
      else localStorage.removeItem(SELECTED_LIB_KEY);
      setSelectedFilePath(null);
    }
  };

  const handleSelectLibrary = (path: string) => {
    setSelectedLibrary(path);
    localStorage.setItem(SELECTED_LIB_KEY, path);
    setSelectedFilePath(null); // Switch back to gallery view
  };

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setSelectedFileType("markdown");
  };

  const handleBackToGallery = () => {
    setSelectedFilePath(null);
  };

  const handleScanLibrary = async (path: string) => {
    if (!path) return;
    try {
      setScanProgress({ total_videos: 0, processed: 0, current_file: "准备扫描..." });
      await invoke("scan_library", { libraryPath: path });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("扫描失败: " + errorMessage);
      setScanProgress(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden text-gray-900 font-sans">
      <div className="flex-1 overflow-hidden">
        <ResizableSplitter
          left={
            <LibrarySidebar
              libraries={libraries}
              selectedLibrary={selectedLibrary}
              onSelectLibrary={handleSelectLibrary}
              onAddLibrary={handleAddLibrary}
              onRemoveLibrary={handleRemoveLibrary}
              onScanRequest={handleScanLibrary}
              scanProgress={scanProgress}
            />
          }
          right={
            <div className="h-full w-full bg-white relative">
              {selectedFilePath && selectedLibrary ? (
                <MarkdownEditor
                  filePath={selectedFilePath}
                  baseDir={selectedLibrary}
                  onSave={() => {}}
                  fileType={selectedFileType}
                  onBack={handleBackToGallery}
                />
              ) : (
                <VideoGallery
                  libraryPath={selectedLibrary || ""}
                  onSelectVideo={handleFileSelect}
                  onScanRequest={() => selectedLibrary && handleScanLibrary(selectedLibrary)}
                />
              )}
            </div>
          }
          defaultLeftWidth={260}
          minLeftWidth={200}
          maxLeftWidth={400}
          storageKey="video-manager-main-splitter"
        />
      </div>
    </div>
  );
}

export default App;
