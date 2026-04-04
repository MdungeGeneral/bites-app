import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_FILE = path.join(process.cwd(), "data", "reactions.json");

type Counts    = { likes: number; dislikes: number };
type Reactions = Record<string, Counts>;

function read(): Reactions {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function write(data: Reactions): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** GET /api/reactions           — returns all counts
 *  GET /api/reactions?id=<md5>  — returns counts for one video */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const reactions = read();

  if (id) {
    if (!/^[0-9a-f]{32}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    return NextResponse.json(reactions[id] ?? { likes: 0, dislikes: 0 });
  }

  return NextResponse.json(reactions);
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

  const reactions = read();
  if (!reactions[videoId]) reactions[videoId] = { likes: 0, dislikes: 0 };
  const r = reactions[videoId];

  switch (action) {
    case "like":           r.likes    = r.likes    + 1;              break;
    case "dislike":        r.dislikes = r.dislikes + 1;              break;
    case "remove-like":    r.likes    = Math.max(0, r.likes    - 1); break;
    case "remove-dislike": r.dislikes = Math.max(0, r.dislikes - 1); break;
  }

  write(reactions);
  return NextResponse.json(r);
}
