import { useEffect, useRef, useState, useCallback } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { convertFileSrc } from "@tauri-apps/api/core";

// Custom modern styling for the video.js player
const PLAYER_CSS = `
.vjs-custom-skin {
  font-family: 'Inter', sans-serif;
}

/* Big Play Button - Cinematic Frost */
.vjs-custom-skin .vjs-big-play-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(20px);
  left: 50%;
  top: 50%;
  margin-left: -40px;
  margin-top: -40px;
  line-height: 80px;
  font-size: 32px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 0 40px rgba(0,0,0,0.4);
}
.vjs-custom-skin .vjs-big-play-button:hover {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.1);
  box-shadow: 0 0 60px rgba(225, 29, 72, 0.3);
}
.vjs-custom-skin .vjs-big-play-button .vjs-icon-placeholder:before {
  line-height: 80px;
  color: white;
}

/* Control Bar - Gradient Fade */
.vjs-custom-skin .vjs-control-bar {
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%);
  height: 64px;
  padding: 0 24px;
  align-items: center;
  display: flex;
}

/* Progress Control - Minimalist Line */
.vjs-custom-skin .vjs-progress-control {
  position: absolute;
  bottom: 64px;
  left: 0;
  right: 0;
  width: 100%;
  height: 2px;
  transition: all 0.2s ease;
}
.vjs-custom-skin .vjs-progress-control:hover {
  height: 6px;
  bottom: 62px;
}
.vjs-custom-skin .vjs-progress-holder {
  height: 100%;
  margin: 0;
}
.vjs-custom-skin .vjs-play-progress {
  background: var(--accent);
}
.vjs-custom-skin .vjs-play-progress:before {
  display: none; /* Hide the knob for ultimate minimalism */
}
.vjs-custom-skin .vjs-load-progress {
  background: rgba(255,255,255,0.1);
}

/* Control Buttons */
.vjs-custom-skin .vjs-button > .vjs-icon-placeholder:before {
  font-size: 20px;
  line-height: 64px;
  color: rgba(255,255,255,0.6);
  transition: all 0.2s ease;
}
.vjs-custom-skin .vjs-button:hover > .vjs-icon-placeholder:before {
  color: white;
  transform: translateY(-1px);
}

/* Volume Panel */
.vjs-custom-skin .vjs-volume-level {
  background: var(--accent);
}

/* Time Display - Clean & Wide */
.vjs-custom-skin .vjs-current-time,
.vjs-custom-skin .vjs-time-divider,
.vjs-custom-skin .vjs-duration {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  display: flex;
  align-items: center;
}

/* Playback Rate */
.vjs-custom-skin .vjs-playback-rate-value {
  font-size: 11px;
  font-weight: 900;
  line-height: 64px;
  color: rgba(255,255,255,0.5);
}

/* Menus - Frost Glass */
.vjs-custom-skin .vjs-menu-button-popup .vjs-menu {
  background: rgba(10,10,12,0.8);
  backdrop-filter: blur(24px);
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.05);
  overflow: hidden;
  bottom: 70px;
}
.vjs-custom-skin .vjs-menu-item {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 20px;
  color: rgba(255,255,255,0.4);
}
.vjs-custom-skin .vjs-menu-item:hover,
.vjs-custom-skin .vjs-menu-item.vjs-selected {
  background: rgba(255,255,255,0.05);
  color: var(--accent);
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
