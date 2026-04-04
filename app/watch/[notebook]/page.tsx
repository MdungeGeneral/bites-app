import ShortsPlayer from "@/app/components/ShortsPlayer";
import { getVideos } from "@/lib/getVideos";
import { notFound } from "next/navigation";

// Always fetch fresh data from R2 — never serve a cached page
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ notebook: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { notebook } = await params;
  const slug = decodeURIComponent(notebook);

  const allVideos = await getVideos();

  let videos = slug === "all" || slug === "random"
    ? [...allVideos]
    : allVideos.filter((v) => v.notebook === slug);

  if (videos.length === 0) notFound();

  // Shuffle for random mode using Fisher-Yates
  if (slug === "random") {
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }
  }

  const label = slug === "random" ? "Random 🔀" : slug === "all" ? "All Chapters" : slug;
  return <ShortsPlayer videos={videos} notebookLabel={label} />;
}
