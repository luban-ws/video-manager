import { useState } from "react";

interface VideoInputProps {
  onExtract: (url: string) => Promise<unknown>;
  onOpenUrl: (url: string) => Promise<void>;
  loading: boolean;
}

export default function VideoInput({ onExtract, onOpenUrl, loading }: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("请输入视频链接");
      return;
    }

    try {
      await onExtract(url.trim());
      setUrl("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || "提取视频信息失败");
    }
  };

  const handleOpen = async () => {
    if (!url.trim()) {
      setError("请输入视频链接");
      return;
    }
    await onOpenUrl(url.trim());
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴视频链接并提取信息..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleOpen}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
          disabled={loading}
        >
          打开
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
          disabled={loading}
        >
          {loading ? "处理中..." : "提取"}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
