import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { unstable_cache } from "next/cache";

export interface Video {
  id: string;
  key: string;   // raw object key, e.g. "Life Insurance Concepts/some-file.mp4"
  url: string;
  notebook: string;
  title: string;
}

export interface Notebook {
  slug: string;
  label: string;
  videoCount: number;
  firstVideoUrl: string | null;
  cardCount?: number; // number of flashcards available for this notebook
}

const SUPPORTED_EXT = new Set([".mp4", ".webm", ".mov"]);

// ── Local disk source (development) ──────────────────────────────────────────

function getVideosFromDisk(): Video[] {
  const videosDir = path.join(process.cwd(), "public", "videos");

  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
    return [];
  }

  const videos: Video[] = [];

  const chapters = fs
    .readdirSync(videosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const chapter of chapters) {
    const chapterDir = path.join(videosDir, chapter);
    const files = fs
      .readdirSync(chapterDir)
      .filter((f) => SUPPORTED_EXT.has(path.extname(f).toLowerCase()))
      .sort();

    for (const file of files) {
      const title = path
        .basename(file, path.extname(file))
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const key = `${chapter}/${file}`;
      videos.push({
        id: crypto.createHash("md5").update(key).digest("hex"),
        key,
        url: `/videos/${chapter}/${encodeURIComponent(file)}`,
        notebook: chapter,
        title,
      });
    }
  }

  return videos;
}

// ── Cloudflare R2 source (production) ────────────────────────────────────────

async function getVideosFromR2(): Promise<Video[]> {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  const videos: Video[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME!,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents ?? []) {
      const key = obj.Key ?? "";
      const ext = path.extname(key).toLowerCase();
      if (!SUPPORTED_EXT.has(ext)) continue;

      const parts = key.split("/");
      if (parts.length < 2) continue;

      const chapter = parts[0];
      const file = parts.slice(1).join("/");
      const title = path
        .basename(file, ext)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      videos.push({
        id: crypto.createHash("md5").update(key).digest("hex"),
        key,
        url: `${publicUrl}/${encodeURIComponent(chapter)}/${encodeURIComponent(file)}`,
        notebook: chapter,
        title,
      });
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return videos.sort(
    (a, b) => a.notebook.localeCompare(b.notebook) || a.title.localeCompare(b.title)
  );
}

// ── Public API — auto-selects source based on env ────────────────────────────

// Cache the R2 listing for 1 hour so every page navigation doesn't trigger a
// full S3 ListObjectsV2 scan. The page itself stays force-dynamic so shuffling
// is still fresh on each render.
const getCachedVideosFromR2 = unstable_cache(
  getVideosFromR2,
  ["r2-video-list"],
  { revalidate: 3600 }
);

export async function getVideos(): Promise<Video[]> {
  if (process.env.R2_BUCKET_NAME) {
    return getCachedVideosFromR2();
  }
  return getVideosFromDisk();
}

export async function getNotebooks(): Promise<Notebook[]> {
  const videos = await getVideos();
  const map = new Map<string, Video[]>();

  for (const v of videos) {
    if (!map.has(v.notebook)) map.set(v.notebook, []);
    map.get(v.notebook)!.push(v);
  }

  const notebooks = [...map.entries()].map(([slug, vids]) => ({
    slug,
    label: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    videoCount: vids.length,
    // Pick a random video as the thumbnail so each page load shows a different one
    firstVideoUrl: vids[Math.floor(Math.random() * vids.length)]?.url ?? null,
    cardCount: 0,
  }));

  // Attempt to count flashcards for each notebook. Prefer R2 index when available, fall back to local public/flashcards
  try {
    const publicDir = path.join(process.cwd(), 'public', 'flashcards');
    if (process.env.R2_PUBLIC_URL) {
      // R2: fetch index.json which can be either { filename: url } or { topic: [{name,url}, ...] }
      const indexUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/flashcards/index.json`;
      const res = await fetch(indexUrl);
      if (res.ok) {
        const idx = await res.json();
        const entries: { name: string; url: string }[] = [];
        if (idx && typeof idx === 'object') {
          for (const k of Object.keys(idx)) {
            const v = idx[k];
            if (Array.isArray(v)) {
              for (const it of v) {
                if (it && it.name && it.url) entries.push({ name: it.name, url: it.url });
              }
            } else if (typeof v === 'string') {
              // idx might be { filename: url }
              entries.push({ name: k, url: v });
            }
          }
        }

        // For each notebook, find matching files and fetch counts
        for (const nb of notebooks) {
          const slugLower = nb.slug.toLowerCase();
          let count = 0;
          const candidates = entries.filter((e) => {
            const nameLower = e.name.toLowerCase();
            return (
              nameLower.startsWith(slugLower) ||
              slugLower.startsWith(nameLower) ||
              nameLower.includes(slugLower) ||
              slugLower.includes(nameLower)
            );
          });

          for (const c of candidates) {
            try {
              const r = await fetch(c.url);
              if (!r.ok) continue;
              const arr = await r.json();
              if (Array.isArray(arr)) count += arr.length;
            } catch (e) {
              // ignore
            }
          }

          nb.cardCount = count;
        }

        return notebooks;
      }
    }

    // Fallback: read local public/flashcards folder
    if (fs.existsSync(publicDir)) {
      const files = fs.readdirSync(publicDir).filter((f) => f.toLowerCase().endsWith('.json'));
      const fileMap: { name: string; path: string }[] = files.map((f) => ({ name: f, path: path.join(publicDir, f) }));
      for (const nb of notebooks) {
        const slugLower = nb.slug.toLowerCase();
        let count = 0;
        const candidates = fileMap.filter((e) => {
          const nameLower = e.name.toLowerCase();
          return (
            nameLower.startsWith(slugLower) ||
            slugLower.startsWith(nameLower) ||
            nameLower.includes(slugLower) ||
            slugLower.includes(nameLower)
          );
        });
        for (const c of candidates) {
          try {
            const content = fs.readFileSync(c.path, 'utf8');
            const arr = JSON.parse(content);
            if (Array.isArray(arr)) count += arr.length;
          } catch (e) {
            // ignore
          }
        }
        nb.cardCount = count;
      }
    }
  } catch (e) {
    // don't fail listing videos if flashcards counting fails
    console.warn('Failed to count flashcards per notebook', e);
  }

  return notebooks;
}


