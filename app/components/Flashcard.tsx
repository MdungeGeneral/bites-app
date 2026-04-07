"use client";

import { useState } from "react";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  const parseParagraphs = (text: string) => {
    if (!text) return [];
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  };

  const renderParagraph = (p: string, idx: number) => {
    const lines = p.split(/\n/).map((l) => l.trim());
    const elements: any[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length) {
        elements.push(
          <ul key={`list-${idx}-${elements.length}`} className="list-disc ml-6 mb-4 space-y-1">
            {listItems.map((li, i) => (
              <li key={i} className="leading-relaxed text-3xl sm:text-4xl">
                {li}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    for (const line of lines) {
      if (line.startsWith("+")) {
        listItems.push(line.replace(/^\+/, "").trim());
      } else if (line.startsWith("-")) {
        // treat dash as bullet too
        listItems.push(line.replace(/^-/, "").trim());
      } else {
        flushList();
        elements.push(
          <p key={`p-${idx}-${elements.length}`} className="mb-4 leading-relaxed text-3xl sm:text-4xl">
            {line}
          </p>
        );
      }
    }

    flushList();
    return <div key={`para-${idx}`}>{elements}</div>;
  };

  const paragraphs = parseParagraphs(back);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={() => setFlipped((s) => !s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((s) => !s);
        }
      }}
      className="w-full flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-3xl sm:max-w-4xl md:max-w-5xl" style={{ perspective: 1200 }}>
        <div
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.6s",
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 bg-white rounded-xl shadow-md p-6 flex flex-col"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold leading-snug whitespace-pre-wrap break-words">{front}</h2>
            </div>

            <div className="mt-4 text-sm text-gray-500">Tap or press Enter/Space to flip</div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 bg-white rounded-xl shadow-md p-6 flex flex-col"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="flex-1">
              <div className="text-3xl sm:text-4xl leading-relaxed text-left whitespace-pre-wrap break-words">
                {paragraphs.length > 0
                  ? paragraphs.map((p, i) => renderParagraph(p, i))
                  : (
                    <p className="leading-relaxed text-3xl sm:text-4xl">{back}</p>
                  )}
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-500">Tap or press Enter/Space to flip back</div>
          </div>
        </div>
      </div>
    </div>
  );
}
