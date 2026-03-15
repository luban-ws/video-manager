import { useEffect, useRef, useState, useCallback } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { convertFileSrc } from "@tauri-apps/api/core";

// Custom modern styling for the video.js player
const PLAYER_CSS = `
.vjs-custom-skin {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

/* Hide default big play button and use custom */
.vjs-custom-skin .vjs-big-play-button {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.9);
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(8px);
  left: 50%;
  top: 50%;
  margin-left: -36px;
  margin-top: -36px;
  line-height: 72px;
  font-size: 28px;
  transition: all 0.2s ease;
}
.vjs-custom-skin .vjs-big-play-button:hover {
  background: rgba(38,139,210,0.75);
  border-color: #268bd2;
  transform: scale(1.08);
}
.vjs-custom-skin .vjs-big-play-button .vjs-icon-placeholder:before {
  line-height: 72px;
}

/* Control bar */
.vjs-custom-skin .vjs-control-bar {
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
  height: 52px;
  padding: 0 12px;
  align-items: center;
  display: flex;
  transition: opacity 0.3s ease;
}

/* Progress bar */
.vjs-custom-skin .vjs-progress-control {
  position: absolute;
  bottom: 52px;
  left: 0;
  right: 0;
  width: 100%;
  height: 4px;
  transition: height 0.15s ease;
}
.vjs-custom-skin .vjs-progress-control:hover {
  height: 8px;
  bottom: 50px;
}
.vjs-custom-skin .vjs-progress-holder {
  height: 100%;
  margin: 0;
}
.vjs-custom-skin .vjs-play-progress {
  background: #268bd2;
}
.vjs-custom-skin .vjs-play-progress:before {
  font-size: 12px;
  top: -4px;
  color: #268bd2;
}
.vjs-custom-skin .vjs-load-progress {
  background: rgba(255,255,255,0.2);
}
.vjs-custom-skin .vjs-slider-bar {
  height: 100%;
}

/* Buttons */
.vjs-custom-skin .vjs-button > .vjs-icon-placeholder:before,
.vjs-custom-skin .vjs-play-control .vjs-icon-placeholder:before,
.vjs-custom-skin .vjs-mute-control .vjs-icon-placeholder:before,
.vjs-custom-skin .vjs-fullscreen-control .vjs-icon-placeholder:before {
  font-size: 18px;
  line-height: 52px;
  color: rgba(255,255,255,0.85);
  transition: color 0.15s;
}
.vjs-custom-skin .vjs-button:hover > .vjs-icon-placeholder:before {
  color: #268bd2;
}

/* Volume */
.vjs-custom-skin .vjs-volume-panel {
  display: flex;
  align-items: center;
}
.vjs-custom-skin .vjs-volume-bar {
  margin: 1.35em 0.45em;
  background: rgba(255,255,255,0.25);
}
.vjs-custom-skin .vjs-volume-level {
  background: #268bd2;
}
.vjs-custom-skin .vjs-volume-level:before {
  color: #268bd2;
}

/* Time display */
.vjs-custom-skin .vjs-current-time,
.vjs-custom-skin .vjs-time-divider,
.vjs-custom-skin .vjs-duration {
  font-size: 12px;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.75);
  display: flex;
  align-items: center;
  padding: 0 4px;
}
.vjs-custom-skin .vjs-remaining-time { display: none; }

/* Playback rate */
.vjs-custom-skin .vjs-playback-rate {
  font-size: 12px;
  color: rgba(255,255,255,0.75);
}
.vjs-custom-skin .vjs-playback-rate .vjs-playback-rate-value {
  font-size: 12px;
  line-height: 52px;
  color: rgba(255,255,255,0.75);
}

/* Menu popup */
.vjs-custom-skin .vjs-menu-button-popup .vjs-menu {
  background: rgba(15,15,20,0.95);
  backdrop-filter: blur(12px);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.vjs-custom-skin .vjs-menu-item {
  font-size: 13px;
  padding: 8px 16px;
  color: rgba(255,255,255,0.75);
  transition: background 0.15s;
}
.vjs-custom-skin .vjs-menu-item:hover,
.vjs-custom-skin .vjs-menu-item.vjs-selected {
  background: rgba(38,139,210,0.25);
  color: #268bd2;
}
`;

interface PlayerInfo {
  title: string;
  videoPath: string;
}

export default function PlayerView() {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
    const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
    const [showTitle, setShowTitle] = useState(true);
    const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Inject custom CSS once
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = PLAYER_CSS;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    // Read URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const path = params.get("videoPath");
        const title = params.get("title");
        if (path) {
            setPlayerInfo({ videoPath: path, title: title ?? "" });
        }
    }, []);

    // Auto-hide title overlay
    const resetTitleTimer = useCallback(() => {
        setShowTitle(true);
        if (titleTimer.current) clearTimeout(titleTimer.current);
        titleTimer.current = setTimeout(() => setShowTitle(false), 3000);
    }, []);

    useEffect(() => {
        resetTitleTimer();
        const onMove = () => resetTitleTimer();
        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, [resetTitleTimer]);

    // Initialize video.js
    useEffect(() => {
        if (!videoRef.current || !playerInfo) return;

        const src = convertFileSrc(playerInfo.videoPath);
        // Detect MIME type from extension
        const ext = playerInfo.videoPath.split('.').pop()?.toLowerCase() ?? "mp4";
        const mimeMap: Record<string, string> = {
            mp4: "video/mp4", m4v: "video/mp4", mov: "video/mp4",
            webm: "video/webm", ogv: "video/ogg",
            mkv: "video/x-matroska", avi: "video/x-msvideo",
        };
        const type = mimeMap[ext] ?? "video/mp4";

        const videoElement = document.createElement("video-js");
        videoElement.classList.add("vjs-big-play-centered");
        videoRef.current.appendChild(videoElement);

        playerRef.current = videojs(videoElement, {
            autoplay: true,
            controls: true,
            // Don't use fluid: it breaks fixed-window sizing. Use fill instead.
            fill: true,
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            sources: [{ src, type }],
            userActions: {
                hotkeys: true, // enable keyboard shortcuts
            },
        });

        playerRef.current.addClass("vjs-custom-skin");

        return () => {
            if (playerRef.current && !playerRef.current.isDisposed()) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, [playerInfo]);

    if (!playerInfo) {
        return (
            <div className="h-screen flex items-center justify-center bg-black text-gray-400 text-sm">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#268bd2] border-t-transparent rounded-full animate-spin" />
                    loading video...
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-screen w-screen bg-black overflow-hidden relative"
            onMouseMove={resetTitleTimer}
        >
            {/* Player fills entire window, respects native aspect ratio via fill mode */}
            <div ref={videoRef} className="absolute inset-0" />

            {/* Title overlay — fades after 3s idle */}
            <div
                className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
                style={{
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
                    padding: "20px 24px 40px",
                    opacity: showTitle ? 1 : 0,
                    transition: "opacity 0.4s ease",
                }}
            >
                <p className="text-white text-sm font-medium truncate opacity-90 tracking-wide">
                    {playerInfo.title || playerInfo.videoPath.split("/").pop()}
                </p>
            </div>
        </div>
    );
}
