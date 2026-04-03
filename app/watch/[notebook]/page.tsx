import ShortsPlayer from "@/app/components/ShortsPlayer";
import { getVideos } from "@/lib/getVideos";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ notebook: string }>;
}

export default async function WatchPage({ params }: Props) {
  const { notebook } = await params;
  const slug = decodeURIComponent(notebook);

  const allVideos = await getVideos();
  const videos =
    slug === "all" ? allVideos : allVideos.filter((v) => v.notebook === slug);

  if (videos.length === 0) notFound();

  return <ShortsPlayer videos={videos} notebookLabel={slug === "all" ? "All Chapters" : slug} />;
}
