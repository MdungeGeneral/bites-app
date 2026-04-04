import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { unstable_cache } from "next/cache";

export interface Video {
  id: string;
  url: string;
  notebook: string;
  title: string;
}

export interface Notebook {
  slug: string;
  label: string;
  videoCount: number;
  firstVideoUrl: string | null;
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

      videos.push({
        id: crypto.createHash("md5").update(`${chapter}/${file}`).digest("hex"),
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

  return [...map.entries()].map(([slug, vids]) => ({
    slug,
    label: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    videoCount: vids.length,
    // Pick a random video as the thumbnail so each page load shows a different one
    firstVideoUrl: vids[Math.floor(Math.random() * vids.length)]?.url ?? null,
  }));
}

