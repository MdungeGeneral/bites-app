import HomeGrid from "./components/HomeGrid";
import { getNotebooks } from "@/lib/getVideos";

export default async function Home() {
  const notebooks = await getNotebooks();
  return <HomeGrid notebooks={notebooks} />;
}
