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

  // Fisher-Yates shuffle helper
  function shuffle<T>(arr: T[]): T[] {
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
    videos = shuffle(allVideos).slice(0, 10);
    label = "Random 🔀";
  } else {
    // Topic view — shuffle so videos play in random order
    const topicVideos = allVideos.filter((v) => v.notebook === slug);
    videos = shuffle(topicVideos);
    label = slug;
  }

  if (videos.length === 0) notFound();

  return <ShortsPlayer videos={videos} notebookLabel={label} />;
}
