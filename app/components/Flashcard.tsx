"use client";

import { useState } from "react";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className="relative w-72 h-48 bg-white text-black border rounded-xl shadow-md cursor-pointer transition-transform duration-500 hover:scale-105"
    >
      {/* Card Content */}
      <div
        className={`absolute inset-0 flex items-center justify-center p-4 text-lg font-semibold transform transition-transform duration-500 ${
          flipped ? "rotate-y-180" : "rotate-y-0"
        }`}
        style={{ backfaceVisibility: "hidden" }}
      >
        {flipped ? back : front}
      </div>

      {/* Hidden backface */}
      <div
        className={`absolute inset-0 flex items-center justify-center p-4 text-lg font-semibold transform transition-transform duration-500 ${
          flipped ? "rotate-y-0" : "rotate-y-180"
        }`}
        style={{ backfaceVisibility: "hidden" }}
      />
    </div>
  );
}