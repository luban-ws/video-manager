import { useState, useEffect, useRef, useCallback } from "react";

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
}

export default function ResizableSplitter({
  left,
  right,
  defaultLeftWidth = 256,
  minLeftWidth = 200,
  maxLeftWidth = 600,
  storageKey,
}: ResizableSplitterProps) {
  const [leftWidth, setLeftWidth] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= minLeftWidth && width <= maxLeftWidth) {
          return width;
        }
      }
    }
    return defaultLeftWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  // 保存宽度到 localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, leftWidth.toString());
    }
  }, [leftWidth, storageKey]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = e.clientX - containerRect.left;

      // 限制在最小和最大宽度之间
      const clampedWidth = Math.max(
        minLeftWidth,
        Math.min(maxLeftWidth, newLeftWidth)
      );

      setLeftWidth(clampedWidth);
    },
    [isDragging, minLeftWidth, maxLeftWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* 左侧面板 */}
      <div
        className="flex-shrink-0 overflow-hidden transition-none"
        style={{ width: `${leftWidth}px` }}
      >
        {left}
      </div>

      {/* 分隔条 */}
      <div
        ref={splitterRef}
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-all duration-150 ${
          isDragging ? "bg-blue-500 w-1.5" : ""
        }`}
        style={{ minWidth: "4px" }}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整面板大小"
      >
        {/* 分隔条内部指示器 */}
        <div
          className={`h-full w-full transition-opacity duration-150 ${
            isDragging ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="h-full w-0.5 bg-blue-500 mx-auto" />
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="flex-1 overflow-hidden min-w-0">
        {right}
      </div>
    </div>
  );
}
