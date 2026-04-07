"use client";

import { useEffect, useState } from "react";
import Flashcard from "../components/Flashcard";

type Card = { question: string; answer: string; source?: string };

export default function FlashcardExample() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/flashcards?count=10');
        const data = await res.json();
        if (data && data.cards) {
          setDeck(data.cards);
          setIndex(0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!deck || deck.length === 0) {
    return <div className="min-h-screen flex items-center justify-center">No flashcards available</div>;
  }

  const card = deck[index];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-black p-6">
      <div className="w-full max-w-3xl">
        <Flashcard front={card.question} back={card.answer} />

        <div className="mt-6 flex items-center justify-between">
          <div>
            <button
              className="px-4 py-2 bg-gray-200 rounded mr-2"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Previous
            </button>

            <button
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={() => setIndex((i) => Math.min(deck.length - 1, i + 1))}
              disabled={index === deck.length - 1}
            >
              Next
            </button>
          </div>

          <div className="text-sm text-gray-600">{index + 1} / {deck.length}</div>
        </div>

        <div className="mt-4 text-xs text-gray-500">Source: {card.source}</div>
      </div>
    </div>
  );
}
