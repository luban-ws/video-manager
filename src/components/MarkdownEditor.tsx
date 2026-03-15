import { useState, useEffect, useRef, ReactNode } from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/sea/index.css";

interface VideoMetadata {
    title: string;
    url: string;
    platform: string;
    thumbnail: string | null;
    duration: number | null;
    tags: string[];
    description: string | null;
    created_at: string;
    updated_at: string;
}

interface MarkdownEditorProps {
    filePath: string | null;
    baseDir: string;
    onSave: () => void;
    fileType?: "markdown" | "video" | "directory" | "other";
    onBack?: () => void;
}

// 根据文件扩展名获取 MIME 类型
function getVideoMimeType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
        // MP4 系列（浏览器支持良好）
        mp4: "video/mp4",
        m4v: "video/mp4",
        mov: "video/quicktime",
        qt: "video/quicktime",
        // AVI 系列（部分编码可能不支持）
        avi: "video/x-msvideo",
        divx: "video/x-msvideo",
        xvid: "video/x-msvideo",
        // 开源格式（浏览器支持良好）
        webm: "video/webm",
        ogv: "video/ogg",
        ogg: "video/ogg",
        mkv: "video/x-matroska",
        // Flash 视频（已过时，但部分浏览器仍支持）
        flv: "video/x-flv",
        f4v: "video/x-flv",
        // Windows Media（部分浏览器支持）
        wmv: "video/x-ms-wmv",
        asf: "video/x-ms-asf",
        // RealMedia（浏览器支持有限，可能需要外部播放器）
        rm: "application/vnd.rn-realmedia",
        rmvb: "application/vnd.rn-realmedia-vbr",
        ra: "audio/x-pn-realaudio",
        // MPEG 系列（浏览器支持良好）
        mpg: "video/mpeg",
        mpeg: "video/mpeg",
        mpe: "video/mpeg",
        m2v: "video/mpeg",
        mpv: "video/mpeg",
        // 移动设备格式
        "3gp": "video/3gpp",
        "3g2": "video/3gpp2",
        // 传输流
        ts: "video/mp2t",
        mts: "video/mp2t",
        m2ts: "video/mp2t",
        // DVD/VCD
        vob: "video/dvd",
        dat: "video/mpeg",
    };
    return mimeTypes[ext] || "video/mp4"; // 默认使用 mp4
}

// 检查格式是否可能在浏览器中播放
function isFormatLikelySupported(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    // 浏览器支持良好的格式
    const wellSupported = ["mp4", "m4v", "webm", "ogv", "ogg", "mpeg", "mpg", "mpe", "mov", "qt"];
    // 可能支持的格式（取决于编码）
    const maybeSupported = ["avi", "mkv", "wmv", "flv", "3gp", "3g2"];
    // 不太可能支持的格式
    const unlikelySupported = ["rm", "rmvb", "ra", "vob", "dat", "m2v", "mpv", "ts", "mts", "m2ts"];
    
    if (wellSupported.includes(ext)) return true;
    if (maybeSupported.includes(ext)) return true; // 尝试播放
    if (unlikelySupported.includes(ext)) return false;
    return true; // 未知格式，尝试播放
}

export default function MarkdownEditor({
    filePath,
    baseDir,
    onSave,
    fileType = "markdown",
    onBack,
}: MarkdownEditorProps) {
    const [content, setContent] = useState("");
    const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
    const editorContainerRef = useRef<HTMLDivElement | null>(null);

    const formatTimestamp = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `[${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`;
        }
        return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`;
    };

    const insertTimestampCommand = {
        name: "insert-timestamp",
        keyCommand: "timestamp",
        buttonProps: { "aria-label": "插入时间戳", title: "插入当前视频时间点 (Cmd+Shift+T)" },
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        ),
        execute: (_state: unknown, api: { replaceSelection: (text: string) => void }) => {
            if (!playerRef.current) return;
            const currentTime = playerRef.current.currentTime() || 0;
            const timestamp = formatTimestamp(currentTime);
            api.replaceSelection(timestamp);
        },
    };

    // 处理点击预览区域的时间戳跳转
    useEffect(() => {
        const container = editorContainerRef.current;
        if (!container) return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 检查是否点击了文本节点，或者是我们渲染出来的"链接"
            // 由于 MDEditor 预览是动态的，我们通配搜索点击点附近的文本内容
            // 或者更简单的：如果内容匹配 [mm:ss] 格式
            const text = target.innerText || target.textContent || "";
            // 使用 new RegExp 动态构造以规避 ESLint 误报，匹配 [mm:ss] 或 [hh:mm:ss]
            const timestampRegex = new RegExp("\\[(\\d{1,2}:)?\\d{1,2}:\\d{2}\\]");
            const match = text.match(timestampRegex);
            
            if (match && playerRef.current) {
                const timeStr = match[0].replace(/[[\]]/g, "");
                const parts = timeStr.split(":").map(Number);
                let seconds = 0;
                if (parts.length === 3) {
                    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2) {
                    seconds = parts[0] * 60 + parts[1];
                }
                playerRef.current.currentTime(seconds);
                playerRef.current.play();
            }
        };

        container.addEventListener("click", handleClick);
        return () => container.removeEventListener("click", handleClick);
    }, [playerRef]);

    // 处理快捷键 Cmd+Shift+T
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") {
                e.preventDefault();
                if (playerRef.current) {
                    const currentTime = playerRef.current.currentTime() || 0;
                    const timestamp = formatTimestamp(currentTime);
                    
                    // 尝试找到编辑器 textarea 并插入
                    const textarea = document.querySelector(".w-md-editor-text-input") as HTMLTextAreaElement;
                    if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const newContent = content.substring(0, start) + timestamp + content.substring(end);
                        setContent(newContent);
                        // 触发保存逻辑（如果有的话）
                    }
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [content, playerRef]);


    useEffect(() => {
        if (filePath) {
            loadFile(filePath);
        } else {
            setContent("");
            setMetadata(null);
        }
    }, [filePath]);

    // 初始化 video.js 播放器（仅用于视频文件）
    useEffect(() => {
        if (fileType === "video" && filePath && videoRef.current) {
            // 如果已有播放器实例，先清理
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }

            // 创建新的播放器实例
            const player = videojs(videoRef.current, {
                controls: true,
                responsive: true,
                fluid: true,
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
                preload: "metadata",
                techOrder: ["html5"],
            });

            playerRef.current = player;

            return () => {
                if (playerRef.current) {
                    playerRef.current.dispose();
                    playerRef.current = null;
                }
            };
        } else {
            // 如果不是视频文件，清理播放器
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        }
    }, [fileType, filePath]);

    // 处理图片粘贴
    useEffect(() => {
        if (!filePath || !baseDir) return;

        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // 检查是否是图片
                if (item.type.startsWith("image/")) {
                    e.preventDefault();

                    const file = item.getAsFile();
                    if (!file) continue;

                    try {
                        // 读取图片数据
                        const arrayBuffer = await file.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);

                        // 获取图片扩展名
                        const mimeType = item.type;
                        const extension = mimeType.split("/")[1] || "png";
                        const imageName = `pasted-image.${extension}`;

                        // 保存图片到后端
                        const relativePath = await invoke<string>(
                            "save_pasted_image",
                            {
                                baseDir,
                                filePath,
                                imageData: Array.from(uint8Array),
                                imageName,
                            }
                        );

                        // 在光标位置插入图片 Markdown
                        const imageMarkdown = `\n![图片](${relativePath})\n`;

                        // 获取当前光标位置
                        setContent((prev) => {
                            const textarea = document.querySelector(
                                ".w-md-editor-text-input"
                            ) as HTMLTextAreaElement;
                            if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                return (
                                    prev.substring(0, start) +
                                    imageMarkdown +
                                    prev.substring(end)
                                );
                            } else {
                                // 如果没有找到 textarea，直接追加到末尾
                                return prev + imageMarkdown;
                            }
                        });
                    } catch (error: unknown) {
                        console.error("保存图片失败:", error);
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        alert("保存图片失败: " + errorMessage);
                    }
                }
            }
        };

        // 添加粘贴事件监听
        document.addEventListener("paste", handlePaste);

        return () => {
            document.removeEventListener("paste", handlePaste);
        };
    }, [filePath, baseDir, content]);

    const loadFile = async (path: string) => {
        setLoading(true);
        try {
            const doc = await invoke<{
                path: string;
                metadata: VideoMetadata;
                content: string;
            }>("read_markdown_file", { filePath: path });

            setContent(doc.content);
            setMetadata(doc.metadata);
        } catch (error) {
            console.error("加载文件失败:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!filePath || !metadata) return;

        setSaving(true);
        try {
            await invoke("save_markdown_file", {
                filePath,
                metadata,
                content,
            });
            onSave();
        } catch (error) {
            console.error("保存文件失败:", error);
            alert("保存失败: " + error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">加载中...</p>
            </div>
        );
    }

    if (!filePath) {
        return (
            <div className="flex items-center justify-center h-full bg-white">
                <div className="text-center">
                    <p className="text-gray-400 text-base mb-1">
                        选择一个文件开始
                    </p>
                    <p className="text-gray-300 text-sm">
                        或粘贴视频链接创建新文档
                    </p>
                </div>
            </div>
        );
    }

    // 如果是视频文件，显示视频播放器
    if (fileType === "video") {
        const formatSupported = filePath ? isFormatLikelySupported(filePath) : true;
        const fileName = filePath?.split("/").pop() || "视频";
        const fileExt = filePath?.split(".").pop()?.toLowerCase() || "";

        return (
            <div className="h-full flex flex-col bg-white">
                {/* 工具栏 */}
                <div className="border-b bg-white px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-1 mr-2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                                ← 返回
                            </button>
                        )}
                        <h2 className="font-semibold text-base text-gray-900">
                            {fileName}
                        </h2>
                        {!formatSupported && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                ⚠️ 此格式可能无法在浏览器中播放
                            </span>
                        )}
                    </div>
                </div>

                {/* 视频播放器 - 使用 video.js */}
                <div className="flex-1 flex items-center justify-center bg-black p-4">
                    {formatSupported ? (
                        <div className="w-full h-full flex items-center justify-center" style={{ maxHeight: "calc(100vh - 100px)" }}>
                            <div data-vjs-player style={{ width: "100%", height: "100%" }}>
                                <video
                                    ref={videoRef}
                                    className="video-js vjs-theme-sea vjs-big-play-centered"
                                    style={{ width: "100%", height: "100%" }}
                                >
                                    <source src={convertFileSrc(filePath!)} type={getVideoMimeType(filePath!)} />
                                    <p className="vjs-no-js">
                                        要查看此视频，请启用 JavaScript，并考虑升级到支持 HTML5 视频的 Web 浏览器。
                                    </p>
                                </video>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-white p-8">
                            <p className="text-lg mb-2">无法在浏览器中播放此格式</p>
                            <p className="text-sm text-gray-400 mb-4">
                                格式: {fileExt.toUpperCase()} 需要外部播放器支持
                            </p>
                            <p className="text-sm text-gray-500">
                                建议使用 VLC 或其他支持该格式的播放器打开此文件
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* 工具栏 - Notion 风格 */}
            <div className="border-b bg-white px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1 mr-2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                            ← 返回
                        </button>
                    )}
                    {metadata && (
                        <>
                            <h2 className="font-semibold text-base text-gray-900">
                                {metadata.title}
                            </h2>
                            {metadata.platform && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    {metadata.platform}
                                </span>
                            )}
                            {metadata.tags.length > 0 && (
                                <div className="flex gap-1">
                                    {metadata.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        {saving ? "保存中..." : "保存"}
                    </button>
                </div>
            </div>

            {/* 编辑器 */}
            <div className="flex-1 overflow-auto" data-color-mode="light" ref={editorContainerRef}>
                <MDEditor
                    value={content}
                    onChange={(value) => setContent(value || "")}
                    height="100%"
                    commands={[
                        ...commands.getCommands(),
                        commands.divider,
                        insertTimestampCommand,
                    ]}
                    previewOptions={{
                        components: {
                            p: ({ children }: { children?: ReactNode }) => <p className="mb-4 last:mb-0">{children}</p>,
                            // 我们可以自定义 a 标签或其他元素来高亮时间戳
                        }
                    }}
                />
            </div>
        </div>
    );
}
