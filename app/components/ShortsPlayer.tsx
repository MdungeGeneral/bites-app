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
  counts,
  userReaction,
  onReact,
}: {
  video: Video;
  isActive: boolean;
  muted: boolean;
  registerRef: (el: HTMLVideoElement | null) => void;
  onBlock: () => void;
  counts: { likes: number; dislikes: number };
  userReaction: "like" | "dislike" | null;
  onReact: (action: "like" | "dislike") => void;
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

  // Sync background video with main video playback (pause/play/currentTime)
  useEffect(() => {
    const main = ref.current;
    const bg = bgRef.current;
    if (!main || !bg) return;

    const syncBgWithMain = () => {
      // Keep background currentTime in sync with main video
      if (Math.abs(bg.currentTime - main.currentTime) > 0.1) {
        bg.currentTime = main.currentTime;
      }
      // Mirror pause state: if main is paused, pause bg too
      if (main.paused && !bg.paused) {
        bg.pause();
      } else if (!main.paused && bg.paused) {
        bg.play().catch(() => {});
      }
    };

    // Sync on every timeupdate of the main video
    main.addEventListener("timeupdate", syncBgWithMain);
    main.addEventListener("play", () => bg.play().catch(() => {}));
    main.addEventListener("pause", () => bg.pause());

    return () => {
      main.removeEventListener("timeupdate", syncBgWithMain);
      main.removeEventListener("play", () => bg.play().catch(() => {}));
      main.removeEventListener("pause", () => bg.pause());
    };
  }, []);

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
        preload={isActive ? "auto" : "none"}
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
        preload={isActive ? "auto" : "none"}
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

      {/* Reaction buttons */}
      <div
        className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onReact("like")}
          aria-label="Like"
          className={`flex flex-col items-center gap-1 active:scale-90 transition-transform ${
            userReaction === "like" ? "text-violet-400" : "text-white/80"
          }`}
        >
          <span className="text-3xl drop-shadow-md">&#128077;</span>
          <span className="text-xs font-bold drop-shadow">{counts.likes}</span>
        </button>
        <button
          onClick={() => onReact("dislike")}
          aria-label="Dislike"
          className={`flex flex-col items-center gap-1 active:scale-90 transition-transform ${
            userReaction === "dislike" ? "text-red-400" : "text-white/80"
          }`}
        >
          <span className="text-3xl drop-shadow-md">&#128078;</span>
          <span className="text-xs font-bold drop-shadow">{counts.dislikes}</span>
        </button>
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
  const [muted, setMuted] = useState(false);
  const [blockedByBrowser, setBlockedByBrowser] = useState(false);
  const [paused, setPaused] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // ── Reactions ────────────────────────────────────────────────────────────
  type Counts = { likes: number; dislikes: number };
  const [reactionCounts, setReactionCounts] = useState<Record<string, Counts>>({});
  const [userReactions, setUserReactions] = useState<Record<string, "like" | "dislike" | null>>({});

  useEffect(() => {
    // Load the user's own votes from localStorage
    try {
      const saved = localStorage.getItem("bites-reactions");
      if (saved) setUserReactions(JSON.parse(saved));
    } catch {}
    // Fetch global counts
    fetch("/api/reactions")
      .then((r) => r.json())
      .then(setReactionCounts)
      .catch(() => {});
  }, []);

  const handleReact = useCallback(
    (videoId: string, action: "like" | "dislike") => {
      const current = userReactions[videoId] ?? null;
      const toggling = current === action; // same button = undo
      const next: "like" | "dislike" | null = toggling ? null : action;

      // Persist user choice
      setUserReactions((prev) => {
        const updated = { ...prev, [videoId]: next };
        localStorage.setItem("bites-reactions", JSON.stringify(updated));
        return updated;
      });

      // Optimistic count update
      setReactionCounts((prev) => {
        const base = { ...(prev[videoId] ?? { likes: 0, dislikes: 0 }) };
        const likeKey   = "likes"   as const;
        const dislikeKey = "dislikes" as const;
        const key    = action  === "like" ? likeKey : dislikeKey;
        const oldKey = current === "like" ? likeKey : dislikeKey;
        if (toggling) {
          base[key] = Math.max(0, base[key] - 1);
        } else {
          base[key]++;
          if (current !== null) base[oldKey] = Math.max(0, base[oldKey] - 1);
        }
        return { ...prev, [videoId]: base };
      });

      // Server sync
      const apiCalls: string[] = [];
      if (!toggling && current !== null) apiCalls.push(`remove-${current}`);
      apiCalls.push(toggling ? `remove-${action}` : action);
      apiCalls.forEach((a) =>
        fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, action: a }),
        }).catch(() => {})
      );
    },
    [userReactions]
  );

  // Keep stable callbacks per video so VideoSlide doesn't re-mount
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const registerRef = useCallback(
    (id: string) => (el: HTMLVideoElement | null) => {
      videoRefs.current.set(id, el);
    },
    []
  );

  // Reset paused state when the slide changes
  useEffect(() => {
    setPaused(false);
    const active = videos[activeIndex];
    if (active) activeVideoRef.current = videoRefs.current.get(active.id) ?? null;
  }, [activeIndex, videos]);

  // Tap anywhere: if browser blocked sound → unmute; otherwise toggle play/pause
  const handleTap = useCallback(() => {
    if (blockedByBrowser) {
      setMuted(false);
      setBlockedByBrowser(false);
      return;
    }
    const el = activeVideoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
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
    // Outer div: tap to pause/resume or unlock sound
    <div
      className="h-screen w-full overflow-hidden bg-black relative"
      style={{ overscrollBehavior: "none", touchAction: "none" }}
      onClick={handleTap}
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
              counts={reactionCounts[video.id] ?? { likes: 0, dislikes: 0 }}
              userReaction={userReactions[video.id] ?? null}
              onReact={(action) => handleReact(video.id, action)}
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

      {/* ── Pause overlay ── */}
      {paused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-10 h-10 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

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
