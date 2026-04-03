import { NextResponse } from "next/server";
import { getVideos } from "@/lib/getVideos";

// Always re-fetch on each request so newly synced videos appear immediately
export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await getVideos();
  return NextResponse.json(videos);
}
