import HomeGrid from "./components/HomeGrid";
import { getNotebooks } from "@/lib/getVideos";

// Always fetch fresh data from R2 — never serve a cached page
export const dynamic = "force-dynamic";

export default async function Home() {
  const notebooks = await getNotebooks();
  return <HomeGrid notebooks={notebooks} />;
}
