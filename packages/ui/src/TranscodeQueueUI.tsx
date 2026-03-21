import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export interface TranscodeJob {
    id: string;
    video_path: string;
    markdown_path: string;
    output_path: string;
    status: "Pending" | "Processing" | "Completed" | { Failed: string };
    progress: number;
    title: string;
}

export default function TranscodeQueueUI() {
    const [jobs, setJobs] = useState<TranscodeJob[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Initial load
        invoke<TranscodeJob[]>("get_transcode_jobs").then(setJobs);

        // Listen for updates
        const unlisten = listen<TranscodeJob>("transcode:status", (event) => {
            setJobs((prev) => {
                const index = prev.findIndex((j) => j.id === event.payload.id);
                if (index !== -1) {
                    const newJobs = [...prev];
                    newJobs[index] = event.payload;
                    return newJobs;
                }
                return [event.payload, ...prev];
            });
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const activeCount = jobs.filter(j => j.status === "Pending" || j.status === "Processing").length;

    if (jobs.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
                    activeCount > 0 
                    ? "bg-[var(--accent)] text-white animate-pulse" 
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]"
                }`}
            >
                <span className="text-xl">⚙️</span>
                <span className="font-medium">
                    {activeCount > 0 ? `转换中 (${activeCount})` : "转换完成"}
                </span>
            </button>

            {isOpen && (
                <div className="absolute bottom-14 right-0 w-80 max-h-[400px] overflow-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-2xl p-4 solarized-dark">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--border)]">
                        <h3 className="font-bold text-[var(--text-primary)]">转码队列</h3>
                        <button 
                            onClick={() => setJobs([])}
                            className="text-xs text-[var(--accent)] hover:underline"
                        >
                            清除记录
                        </button>
                    </div>
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <div key={job.id} className="text-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="truncate flex-1 text-[var(--text-primary)] font-medium" title={job.title}>
                                        {job.title}
                                    </span>
                                    <span className={`ml-2 text-xs px-1.5 rounded ${
                                        typeof job.status === "object" ? "bg-red-900/30 text-red-400" :
                                        job.status === "Completed" ? "bg-green-900/30 text-green-400" :
                                        "bg-blue-900/30 text-blue-400"
                                    }`}>
                                        {typeof job.status === "object" ? "失败" : 
                                         job.status === "Processing" ? "转换中" :
                                         job.status === "Pending" ? "排队中" : "完成"}
                                    </span>
                                </div>
                                {job.status === "Processing" && (
                                    <div className="w-full bg-[var(--base03)] rounded-full h-1.5 mt-2">
                                        <div 
                                            className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${job.progress}%` }}
                                        />
                                    </div>
                                )}
                                {typeof job.status === "object" && (
                                    <p className="text-[10px] text-red-400 mt-1 truncate">
                                        {(job.status as { Failed: string }).Failed}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
