import Flashcard from "../components/Flashcard";
import fs from "fs";
import path from "path";

async function getFlashcards(): Promise<{ question: string; answer: string }[]> {
  const filePath = path.join(process.cwd(), "public", "flashcards", "Chapter 1-Life insurance products.json");
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

export default async function FlashcardExample() {
  const flashcards = await getFlashcards();
  const firstFlashcard = flashcards[0];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <Flashcard front={firstFlashcard.question} back={firstFlashcard.answer} />
    </div>
  );
}