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
      role="button"
      aria-pressed={flipped}
      onClick={() => setFlipped(!flipped)}
      className="cursor-pointer"
      style={{ perspective: 1000 }}
    >
      <div
        className="relative w-80 sm:w-96 h-64"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.6s",
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
        }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 bg-white text-black rounded-xl shadow-md p-4 flex flex-col overflow-auto text-sm leading-relaxed"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <div className="w-full">{front}</div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 bg-gray-50 text-black rounded-xl shadow-md p-4 flex flex-col overflow-auto text-sm leading-relaxed"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <div className="w-full">{back}</div>
        </div>
      </div>
    </div>
  );
}
