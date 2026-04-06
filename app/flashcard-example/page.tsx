import Flashcard from "../components/Flashcard";
import path from "path";
import { promises as fs } from "fs";

export async function getServerSideProps() {
  // Load the flashcards file dynamically
  const filePath = path.join(process.cwd(), "public", "flashcards", "Chapter 1-Life insurance products.json");
  const data = await fs.readFile(filePath, "utf-8");
  const flashcards = JSON.parse(data);

  return { props: { flashcards } };
}

export default function FlashcardExample({ flashcards }: { flashcards: { question: string; answer: string }[] }) {
  const firstFlashcard = flashcards[0];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <Flashcard front={firstFlashcard.question} back={firstFlashcard.answer} />
    </div>
  );
}