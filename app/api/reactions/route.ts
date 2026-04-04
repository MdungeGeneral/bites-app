import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();

const HASH_KEY = "bites:reactions";

type Counts = { likes: number; dislikes: number };

async function getCounts(videoId: string): Promise<Counts> {
  const raw = await redis.hget<Counts>(HASH_KEY, videoId);
  return raw ?? { likes: 0, dislikes: 0 };
}

/** GET /api/reactions           — returns all counts
 *  GET /api/reactions?id=<md5>  — returns counts for one video */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    if (!/^[0-9a-f]{32}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    return NextResponse.json(await getCounts(id));
  }

  const all = await redis.hgetall<Record<string, Counts>>(HASH_KEY);
  return NextResponse.json(all ?? {});
}

/** POST /api/reactions
 *  Body: { videoId: string, action: "like" | "dislike" | "remove-like" | "remove-dislike" } */
export async function POST(req: NextRequest) {
  let body: { videoId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoId, action } = body;

  if (!videoId || !/^[0-9a-f]{32}$/i.test(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  const validActions = new Set(["like", "dislike", "remove-like", "remove-dislike"]);
  if (!action || !validActions.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const counts = await getCounts(videoId);

  switch (action) {
    case "like":           counts.likes    = counts.likes    + 1;              break;
    case "dislike":        counts.dislikes = counts.dislikes + 1;              break;
    case "remove-like":    counts.likes    = Math.max(0, counts.likes    - 1); break;
    case "remove-dislike": counts.dislikes = Math.max(0, counts.dislikes - 1); break;
  }

  await redis.hset(HASH_KEY, { [videoId]: counts });
  return NextResponse.json(counts);
}
