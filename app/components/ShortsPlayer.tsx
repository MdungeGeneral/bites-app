"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";

import type { Video } from "@/lib/getVideos";

// ─── Single video slide ────────────────────────────────────────────────────────

function VideoSlide({
  video,
  isActive,
  muted,
  registerRef,
  onBlock,
}: {
  video: Video;
  isActive: boolean;
  muted: boolean;
  registerRef: (el: HTMLVideoElement | null) => void;
  onBlock: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);

  // Hand the DOM element up to the parent so it can drive play/pause directly
  useEffect(() => {
    registerRef(ref.current);
    return () => registerRef(null);
  }, [registerRef]);

  // Play or pause whenever the active slide changes
  useEffect(() => {
    const main = ref.current;
    const bg = bgRef.current;
    if (!main) return;
    if (isActive) {
      main.currentTime = 0;
      if (bg) bg.currentTime = 0;
      main.play().catch(() => {
        // Browser blocked unmuted autoplay — mute and retry
        main.muted = true;
        onBlock();
        main.play().catch(() => {});
      });
      bg?.play().catch(() => {});
    } else {
      main.pause();
      bg?.pause();
    }
  }, [isActive]);

  // Mirror the global mute state
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
    // bg is always muted — no need to change
  }, [muted]);

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">

      {/* ── Blurred background — always shown, fills any gaps around the main video ── */}
      <video
        ref={bgRef}
        src={video.url}
        className="absolute inset-0 h-full w-full object-cover scale-110"
        style={{ filter: "blur(28px)", opacity: 0.45 }}
        aria-hidden
        muted
        playsInline
        preload="auto"
        loop
      />

      {/* ── Main video — never cropped, always fully visible ── */}
      <video
        ref={ref}
        src={video.url}
        className="relative z-10 max-h-full max-w-full object-contain"
        style={{ width: "auto", height: "100%" }}
        loop
        playsInline
        muted={muted}
        preload="auto"
      />

      {/* Bottom gradient so text is always readable */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%, transparent 100%)",
        }}
      />

      {/* Chapter & title overlay */}
      <div className="absolute bottom-20 left-4 right-16 pointer-events-none select-none z-20">
        <p className="text-white/60 text-sm font-semibold tracking-wide mb-1">
          @{video.notebook}
        </p>
        <h2 className="text-white text-xl font-bold leading-snug drop-shadow">
          {video.title}
        </h2>
      </div>
    </div>
  );
}

// ─── Shorts player ─────────────────────────────────────────────────────────────

export default function ShortsPlayer({
  videos,
  notebookLabel,
}: {
  videos: Video[];
  notebookLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false); // start unmuted; falls back if browser blocks
  const [blockedByBrowser, setBlockedByBrowser] = useState(false);

  // Keep stable callbacks per video so VideoSlide doesn't re-mount
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const registerRef = useCallback(
    (id: string) => (el: HTMLVideoElement | null) => {
      videoRefs.current.set(id, el);
    },
    []
  );

  // Tap anywhere to unmute after browser blocked autoplay
  const unlockSound = useCallback(() => {
    if (blockedByBrowser) {
      setMuted(false);
      setBlockedByBrowser(false);
    }
  }, [blockedByBrowser]);

  if (videos.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white gap-5 px-8 text-center">
        <span className="text-7xl">🎓</span>
        <h1 className="text-2xl font-bold">No videos yet</h1>
        <p className="text-white/50 text-sm leading-relaxed">
          Drop{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded">.mp4</code>{" "}
          files into{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded">
            public/videos/&lt;chapter-name&gt;/
          </code>
          {" "}or upload them to your R2 bucket.
        </p>
      </div>
    );
  }

  const canLoop = videos.length > 1;

  return (
    // Outer div catches the "first tap" to unlock audio on mobile
    <div
      className="h-screen w-full overflow-hidden bg-black relative"
      style={{ overscrollBehavior: "none", touchAction: "none" }}
      onClick={unlockSound}
    >
      <Swiper
        direction="vertical"
        modules={[Mousewheel]}
        mousewheel={{ sensitivity: 1 }}
        loop={canLoop}
        speed={280}               /* snappy but not jarring */
        touchRatio={1}
        resistance={false}        /* no resistance at the edges when looping */
        className="h-full w-full"
        onRealIndexChange={(swiper: SwiperType) => {
          setActiveIndex(swiper.realIndex);
        }}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={video.id}>
            <VideoSlide
              video={video}
              isActive={index === activeIndex}
              muted={muted}
              registerRef={registerRef(video.id)}
              onBlock={() => { setMuted(true); setBlockedByBrowser(true); }}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* ── Mute / unmute button ── */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setBlockedByBrowser(false);
          setMuted((m) => !m);
        }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute top-4 right-4 z-50 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-xl shadow-lg active:scale-90 transition-transform"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* ── Top bar: back button + notebook label + counter ── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center gap-3 px-3 pt-3 pb-2"
           style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }}>
        <Link
          href="/"
          onClick={(e) => e.stopPropagation()}
          aria-label="Back to home"
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {notebookLabel && (
          <span className="text-white font-bold text-sm truncate flex-1">{notebookLabel}</span>
        )}
        <span className="bg-black/40 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shrink-0">
          {activeIndex + 1} / {videos.length}
        </span>
      </div>

      {/* ── First-time "tap to hear" nudge — only shown if browser blocked autoplay ── */}
      {blockedByBrowser && (
        <div className="absolute bottom-28 inset-x-0 flex justify-center z-50 pointer-events-none">
          <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full animate-pulse">
            Tap anywhere to enable sound
          </span>
        </div>
      )}

      {/* ── Swipe hint ── */}
      {videos.length > 1 && (
        <div className="absolute bottom-10 inset-x-0 flex justify-center z-50 pointer-events-none">
          <span className="text-white/40 text-xs">Swipe up for next</span>
        </div>
      )}
    </div>
  );
}
