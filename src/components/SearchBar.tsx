import { useState } from "react";
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
  file_type: "markdown" | "video" | "directory" | "other";
}

interface SearchBarProps {
  baseDir: string;
  onResultSelect: (path: string, fileType: "markdown" | "video" | "directory" | "other") => void;
}

export default function SearchBar({ baseDir, onResultSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (!baseDir) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const searchResults = await invoke<FileInfo[]>("search_files", {
        baseDir,
        query: searchQuery,
        searchInContent: true,
      });
      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error("搜索失败:", error);
      setResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    handleSearch(value);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="搜索文件..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
        />
        {searching && (
          <span className="text-gray-400 text-xs">搜索中...</span>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-t-0 shadow-lg z-50 max-h-96 overflow-auto">
          {results.map((result) => (
            <div
              key={result.path}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b"
              onClick={() => {
                onResultSelect(result.path, result.file_type);
                setShowResults(false);
                setQuery("");
              }}
            >
              <div className="font-medium">{result.metadata.title}</div>
              <div className="text-sm text-gray-500">{result.path}</div>
              {result.metadata.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {result.metadata.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-1 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query && (
        <div className="absolute top-full left-0 right-0 bg-white border border-t-0 shadow-lg z-50 p-4 text-center text-gray-500">
          未找到匹配的文件
        </div>
      )}
    </div>
  );
}
