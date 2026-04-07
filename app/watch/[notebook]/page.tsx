import ShortsPlayer from "@/app/components/ShortsPlayer";
import { getVideos } from "@/lib/getVideos";
import { notFound } from "next/navigation";

// Always fetch fresh data from R2 — never serve a cached page
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ notebook: string }>;
  searchParams: Promise<{ shuffle?: string }>;
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { notebook } = await params;
  const { shuffle } = await searchParams;
  const slug = decodeURIComponent(notebook);
  const shouldShuffle = slug === "random" || shuffle === "1";

  const allVideos = await getVideos();

  // Fisher-Yates shuffle helper
  function shuffleArr<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let videos;
  let label: string;

  if (slug === "random") {
    // Pick 10 random videos from across all topics
    videos = shuffleArr(allVideos).slice(0, 10);
    label = "Random 🔀";
  } else {
    const topicVideos = allVideos.filter((v) => v.notebook === slug);
    videos = shouldShuffle ? shuffleArr(topicVideos) : topicVideos;
    label = shouldShuffle ? `${slug} 🔀` : slug;
  }

  if (videos.length === 0) notFound();

  // Build mixed playlist: for each video, optionally insert a flashcard after it (random interleave)
  const playlist: any[] = [];

  // Try to load R2 index of flashcards; fallback to local public/flashcards
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
  let flashcardFiles: { name: string; url: string }[] = [];

  if (R2_PUBLIC_URL) {
    try {
      const idxUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/flashcards/index.json`;
      const res = await fetch(idxUrl);
      if (res.ok) {
        const data = await res.json();
        for (const topic of Object.keys(data || {})) {
          const arr = data[topic];
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && item.name && item.url) flashcardFiles.push({ name: item.name, url: item.url });
            }
          }
        }
      }
    } catch (e) {
      // ignore and fallback
    }
  }

  if (!flashcardFiles.length) {
    // fallback to local public folder
    const publicDir = "https://" + (process.env.VERCEL_URL || "") + "/flashcards"; // prefer public when deployed
    // read from processed_flashcards on server
    try {
      const fs = await import('fs');
      const path = await import('path');
      const procDir = path.join(process.cwd(), 'public', 'flashcards');
      const files = fs.readdirSync(procDir).filter((f: string) => f.endsWith('.json'));
      flashcardFiles = files.map((f: string) => ({ name: f, url: `/flashcards/${f}` }));
    } catch (e) {
      // ignore
    }
  }

  // Helper: pick a random flashcard (fetch file and choose a random card)
  async function pickRandomFlashcard(prefer?: string) {
    if (!flashcardFiles.length) return null;
    // If a preferred substring is given, try to find a file that matches it first
    let choices = flashcardFiles;
    if (prefer) {
      const pref = prefer.toLowerCase();
      const filtered = flashcardFiles.filter((f) => f.name.toLowerCase().includes(pref) || f.url.toLowerCase().includes(pref));
      if (filtered.length) choices = filtered;
    }

    const choice = choices[Math.floor(Math.random() * choices.length)];
    try {
      const base = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/$/, '') : '';
      const pathPart = choice.url.startsWith('http') ? choice.url : `${choice.url.replace(/^\/+/, '')}`;
      const url = choice.url.startsWith('http') ? choice.url : `${base}/${pathPart}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const card = arr[Math.floor(Math.random() * arr.length)];
      const question = card.question || card.Q || card.front || '';
      const answer = card.answer || card.A || card.back || '';
      return { type: 'flashcard', question, answer, source: choice.name };
    } catch (e) {
      // fallback: return minimal placeholder
      return { type: 'flashcard', question: '', answer: '', source: choice.name };
    }
  }

  for (const v of videos) {
    playlist.push({ type: 'video', video: v });
    // 50% chance to insert a flashcard after this video
    if (Math.random() < 0.5 && flashcardFiles.length) {
      const card = await pickRandomFlashcard(v.notebook || undefined);
      if (card) playlist.push(card);
    }
  }

  // Ensure at least one flashcard present if flashcard files exist
  if (flashcardFiles.length > 0 && !playlist.some((it) => it.type === 'flashcard')) {
    const guaranteed = await pickRandomFlashcard();
    if (guaranteed) {
      // insert after a random video position
      const videoPositions = playlist.map((it, idx) => ({ it, idx })).filter((x) => x.it.type === 'video').map((x) => x.idx);
      const insertAfter = videoPositions.length ? videoPositions[Math.floor(Math.random() * videoPositions.length)] : playlist.length - 1;
      playlist.splice(insertAfter + 1, 0, guaranteed);
    }
  }

  return <ShortsPlayer playlist={playlist} notebookLabel={label} />;
}
