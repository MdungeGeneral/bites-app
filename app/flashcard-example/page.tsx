"use client";

import { useEffect, useState } from "react";
import Flashcard from "../components/Flashcard";

export default function FlashcardExample() {
  const [flashcard, setFlashcard] = useState<{ question: string; answer: string } | null>(null);

  useEffect(() => {
    async function fetchFlashcards() {
      const response = await fetch("/flashcards/Chapter 1-Life insurance products.json");
      const data = await response.json();
      setFlashcard(data[0]);
    }

    fetchFlashcards();
  }, []);

  if (!flashcard) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <Flashcard front={flashcard.question} back={flashcard.answer} />
    </div>
  );
}