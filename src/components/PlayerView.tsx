import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/city/index.css";
import { convertFileSrc } from "@tauri-apps/api/core";

export default function PlayerView() {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [videoPath, setVideoPath] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const path = params.get("videoPath");
        if (path) {
            setVideoPath(path);
        }
    }, []);

    useEffect(() => {
        if (!videoRef.current || !videoPath) return;

        const videoElement = document.createElement("video-js");
        videoElement.classList.add("vjs-big-play-centered");
        videoRef.current.appendChild(videoElement);

        const player = playerRef.current = videojs(videoElement, {
            autoplay: true,
            controls: true,
            responsive: true,
            fluid: true,
            sources: [{
                src: (() => {
                    const converted = convertFileSrc(videoPath);
                    console.log("Original Path:", videoPath);
                    console.log("Converted SRC:", converted);
                    return converted;
                })(),
                type: "video/mp4"
            }]
        }, () => {
            console.log("Player is ready");
        });

        // Set theme
        player.addClass("vjs-theme-city");

        return () => {
            if (player) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, [videoPath]);

    if (!videoPath) {
        return (
            <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                正在加载视频...
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center">
            <div ref={videoRef} className="w-full h-full" />
        </div>
    );
}
