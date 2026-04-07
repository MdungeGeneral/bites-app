"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";

type NotebookItem = {
  slug: string;
  label: string;
  videoCount: number;
  firstVideoUrl: string | null;
  cardCount?: number;
};;
import { useRouter } from "next/navigation";
import type { Notebook } from "@/lib/getVideos";

/** Renders the first frame of a video as a thumbnail by seeking to t=1s.
 *  Uses IntersectionObserver so the video only starts loading when the card
 *  scrolls into view — prevents dozens of parallel metadata requests on load.
 */
function VideoThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  // Only start loading once the card enters the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !visible) return;
    const seek = () => { el.currentTime = 1; };
    el.addEventListener("loadedmetadata", seek, { once: true });
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [visible]);

  return (
    <video
      ref={ref}
      src={visible ? src : undefined}
      className="absolute inset-0 h-full w-full object-cover"
      preload="metadata"
      muted
      playsInline
    />
  );
}

/** Single notebook card */
function NotebookCard({ notebook, cardCount }: { notebook: Notebook, cardCount?: number }) {
  const router = useRouter();
  const slug = encodeURIComponent(notebook.slug);

  const displayCount = typeof cardCount === 'number' ? cardCount : notebook.cardCount;

  return (
    <div
      className="group block cursor-pointer"
      onClick={() => router.push(`/watch/${slug}`)}
    >
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

        {/* Play button overlay (hover / active) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Shuffle button — always visible, top-right corner */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/watch/${slug}?shuffle=1`);
          }}
          aria-label="Shuffle play"
          className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-base active:scale-90 transition-transform"
        >
          🔀
        </button>

        {/* Notebook info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {notebook.label}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {notebook.videoCount} {notebook.videoCount === 1 ? "bite" : "bites"}
            {typeof displayCount === 'number' && displayCount > 0 && (
              <>
                {" \u00B7 "}
                {displayCount} {displayCount === 1 ? 'card' : 'cards'}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HomeGrid({ notebooks }: { notebooks: Notebook[] }) {
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    async function loadIndex() {
      try {
        let items: { name: string; url: string; count?: number }[] = [];

        const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');

        // 1) If R2 public URL configured, try reading its index.json first
        if (R2_PUBLIC_URL) {
          try {
            const r2res = await fetch(`${R2_PUBLIC_URL}/flashcards/index.json`);
            if (r2res.ok) {
              const r2data = await r2res.json();
              // r2data may be { items: [...] } or { topic: [...] } or { filename: url }
              if (Array.isArray(r2data.items)) {
                items = r2data.items.map((it: any) => ({ name: it.name, url: it.url, count: Number(it.count || 0) }));
              } else if (r2data && typeof r2data === 'object') {
                for (const k of Object.keys(r2data)) {
                  const v = r2data[k];
                  if (Array.isArray(v)) {
                    for (const it of v) {
                      if (it && typeof it === 'object') items.push({ name: it.name || k, url: it.url || '', count: Number(it.count || 0) });
                      else if (typeof it === 'string') items.push({ name: it, url: it, count: 0 });
                    }
                  } else if (typeof v === 'string') {
                    items.push({ name: k, url: v, count: 0 });
                  }
                }
              }
            }
          } catch (e) {
            // ignore and fallback
          }
        }

        // 2) Try server-side index if still empty
        if (!items.length) {
          try {
            const res = await fetch('/api/flashcards/index');
            if (res.ok) {
              const data = await res.json();
              items = data.items || [];
            }
          } catch (e) {
            // ignore
          }
        }

        // 3) Fallback to public index.json in repo
        if (!items.length) {
          try {
            const res2 = await fetch('/flashcards/index.json');
            if (res2.ok) {
              const data2 = await res2.json();
              items = data2.items || [];
            }
          } catch (e) {
            // ignore
          }
        }

        if (!items.length) return; // nothing to do

        // normalize helper
        const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

        // We'll fetch counts lazily for only the matched files to reduce requests
        const countCache = new Map<string, number>();

        // helper to fetch and cache count for a given url
        const fetchCount = async (url: string) => {
          if (!url) return 0;
          if (countCache.has(url)) return countCache.get(url)!;
          try {
            const abs = url.startsWith('http') ? url : new URL(url, window.location.origin).toString();
            const r = await fetch(abs);
            if (!r.ok) { countCache.set(url, 0); return 0; }
            const arr = await r.json();
            const c = Array.isArray(arr) ? arr.length : 0;
            countCache.set(url, c);
            return c;
          } catch (e) {
            countCache.set(url, 0);
            return 0;
          }
        };

        const counts: Record<string, number> = {};
        for (const nb of notebooks) {
          const slugNorm = normalize(nb.slug);
          let total = 0;
          // Collect promises for matched items that need counting
          const toFetch: string[] = [];
          for (const it of items) {
            const nameNorm = normalize(it.name);
            if (!nameNorm || !slugNorm) continue;
            let matched = false;
            if (nameNorm.includes(slugNorm) || slugNorm.includes(nameNorm)) matched = true;
            else {
              const nameWords = new Set((it.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
              const slugWords = new Set((nb.slug || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
              for (const w of nameWords) if (slugWords.has(w)) { matched = true; break; }
            }
            if (matched) {
              if (typeof it.count === 'number' && it.count > 0) {
                total += it.count;
              } else if (it.url) {
                toFetch.push(it.url);
              }
            }
          }

          // fetch counts for matched urls (concurrently)
          if (toFetch.length) {
            const unique = Array.from(new Set(toFetch));
            const promises = unique.map((u) => fetchCount(u));
            const results = await Promise.all(promises);
            for (const c of results) total += c;
          }

          counts[nb.slug] = total;
        }

        if (mounted) setCardCounts(counts);
      } catch (e) {
        // ignore
      }
    }
    loadIndex();
    return () => { mounted = false; };
  }, [notebooks]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          Bites<span className="text-violet-400">.</span>
        </h1>
        {notebooks.length > 0 && (
          <Link
            href="/watch/random"
            className="text-xs font-semibold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 px-4 py-2 rounded-full transition-colors"
          >
            Random 🔀
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
                <NotebookCard key={nb.slug} notebook={nb} cardCount={cardCounts[nb.slug]} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
