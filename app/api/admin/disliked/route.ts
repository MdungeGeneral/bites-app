import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getVideos } from "@/lib/getVideos";

export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();
const HASH_KEY = "bites:reactions";

type Counts = { likes: number; dislikes: number };

export async function GET() {
  const [videos, allReactions] = await Promise.all([
    getVideos(),
    redis.hgetall<Record<string, Counts>>(HASH_KEY),
  ]);

  const reactions = allReactions ?? {};

  const disliked = videos
    .map((v) => {
      const counts = reactions[v.id] ?? { likes: 0, dislikes: 0 };
      return { ...v, likes: counts.likes, dislikes: counts.dislikes };
    })
    .filter((v) => v.dislikes > 0)
    .sort(
      (a, b) =>
        b.dislikes - a.dislikes || a.notebook.localeCompare(b.notebook)
    );

  return NextResponse.json(disliked);
}
