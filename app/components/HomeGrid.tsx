"use client";

import Link from "next/link";
import { useRef, useEffect } from "react";
import type { Notebook } from "@/lib/getVideos";

/** Renders the first frame of a video as a thumbnail by seeking to t=1s. */
function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seek = () => { el.currentTime = 1; };
    el.addEventListener("loadedmetadata", seek, { once: true });
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      className="absolute inset-0 h-full w-full object-cover"
      preload="metadata"
      muted
      playsInline
    />
  );
}

/** Single notebook card */
function NotebookCard({ notebook }: { notebook: Notebook }) {
  return (
    <Link href={`/watch/${encodeURIComponent(notebook.slug)}`} className="group block">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-zinc-800 shadow-lg ring-1 ring-white/10 group-active:scale-95 transition-transform duration-150">
        {notebook.firstVideoUrl ? (
          <VideoThumbnail src={notebook.firstVideoUrl} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl opacity-30">🎓</span>
          </div>
        )}

        {/* Dark gradient at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)",
          }}
        />

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Notebook info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {notebook.label}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {notebook.videoCount} {notebook.videoCount === 1 ? "bite" : "bites"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function HomeGrid({ notebooks }: { notebooks: Notebook[] }) {

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          Bites<span className="text-violet-400">.</span>
        </h1>
        {notebooks.length > 0 && (
          <Link
            href="/watch/all"
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 px-4 py-2 rounded-full transition-colors"
          >
            Play All ▶
          </Link>
        )}
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {notebooks.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5 px-4">
            <span className="text-7xl">🎓</span>
            <h2 className="text-2xl font-bold">No notebooks yet</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Drop{" "}
              <code className="bg-white/10 px-1.5 py-0.5 rounded">.mp4</code>{" "}
              files into{" "}
              <code className="bg-white/10 px-1.5 py-0.5 rounded">
                public/videos/&lt;notebook-name&gt;/
              </code>
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/40 text-xs mb-5 uppercase tracking-widest font-semibold">
              {notebooks.length} {notebooks.length === 1 ? "topic" : "topics"}
            </p>

            {/* Responsive 2-column grid on mobile, 3 on wider screens */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {notebooks.map((nb) => (
                <NotebookCard key={nb.slug} notebook={nb} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
