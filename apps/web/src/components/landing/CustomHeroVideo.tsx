"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const SPEED_OPTIONS = [1, 1.5, 2];

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CustomHeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ left: number; center: number; right: number }>({ left: 0, center: 0, right: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  const safeDuration = useMemo(() => (Number.isFinite(duration) && duration > 0 ? duration : 0), [duration]);

  function handleTogglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    revealControls();

    if (video.paused) {
      void video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      return;
    }

    video.pause();
    setIsPlaying(false);
  }

  function handleToggleMute() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    revealControls();

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function handleRateChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextRate = Number(event.target.value);
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
    revealControls();
  }

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video || !safeDuration) {
      return;
    }

    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    revealControls();
  }

  function handleToggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      revealControls();
      return;
    }

    if (frame.requestFullscreen) {
      void frame.requestFullscreen().catch(() => undefined);
      revealControls();
      return;
    }

    const webkitFrame = frame as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    webkitFrame.webkitRequestFullscreen?.();
    revealControls();
  }

  function revealControls() {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  }

  function handleSeekBy(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video || !safeDuration) {
      return;
    }

    const nextTime = Math.min(Math.max(video.currentTime + deltaSeconds, 0), safeDuration);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    revealControls();
  }

  function handleZoneTap(zone: "left" | "center" | "right", pointerType: string) {
    revealControls();

    if (pointerType !== "touch" && pointerType !== "pen") {
      return;
    }

    const now = Date.now();
    const lastTap = lastTapRef.current[zone];
    lastTapRef.current[zone] = now;

    if (now - lastTap > 350) {
      return;
    }

    if (zone === "left") {
      handleSeekBy(-5);
      return;
    }

    if (zone === "right") {
      handleSeekBy(5);
      return;
    }

    handleTogglePlay();
  }

  return (
    <section className="landing-video-section container" aria-label="Product demo video">
      <div className="landing-video-header">
        <p className="edge-kicker">DEMO</p>
        <h2>See Autarch District in action.</h2>
      </div>
      <div className="hero-video-card">
        <div
          ref={frameRef}
          className={`hero-video-frame${!isPlaying ? " paused-glass" : ""}`}
          onMouseEnter={() => {
            setIsHovering(true);
            revealControls();
          }}
          onMouseLeave={() => {
            setIsHovering(false);
            setControlsVisible(false);
          }}
        >
          <video
            ref={videoRef}
            className="hero-video-element"
            src="/autarch-district-1.mp4"
            loop
            playsInline
            preload="metadata"
            onMouseMove={revealControls}
            onMouseEnter={revealControls}
            onPointerDown={revealControls}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setDuration(video.duration || 0);
              setCurrentTime(video.currentTime || 0);
              video.muted = false;
              video.playbackRate = playbackRate;
            }}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
          />

          <div className="hero-video-hit-area" aria-hidden="true">
            <button
              type="button"
              className="hero-video-seek-zone"
              onDoubleClick={() => handleSeekBy(-5)}
              onPointerUp={(event) => handleZoneTap("left", event.pointerType)}
            />
            <button
              type="button"
              className="hero-video-seek-zone hero-video-center-zone"
              onDoubleClick={handleTogglePlay}
              onPointerUp={(event) => handleZoneTap("center", event.pointerType)}
            />
            <button
              type="button"
              className="hero-video-seek-zone"
              onDoubleClick={() => handleSeekBy(5)}
              onPointerUp={(event) => handleZoneTap("right", event.pointerType)}
            />
          </div>

          <div
            className={`hero-video-overlay${isHovering || controlsVisible ? " visible" : ""}`}
            role="group"
            aria-label="Video playback controls"
            onMouseMove={revealControls}
            onMouseEnter={revealControls}
          >
            <input
              type="range"
              min={0}
              max={safeDuration || 0}
              step={0.1}
              value={Math.min(currentTime, safeDuration || 0)}
              onChange={handleSeek}
              aria-label="Seek video timeline"
              className="hero-video-timeline"
            />

            <div className="hero-video-controls">
              <button type="button" className="hero-video-btn" onClick={handleTogglePlay}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button type="button" className="hero-video-btn" onClick={handleToggleMute}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <span className="hero-video-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="hero-video-right-controls">
                <label className="hero-video-speed">
                  <span>Speed</span>
                  <select value={playbackRate} onChange={handleRateChange}>
                    {SPEED_OPTIONS.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed.toFixed(1)}x
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="hero-video-btn" onClick={handleToggleFullscreen}>
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
