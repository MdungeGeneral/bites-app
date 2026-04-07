"use client";

import { useState } from "react";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  const paragraphs = back
    ? back
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const renderParagraph = (p: string, idx: number) => {
    // Normalize the paragraph so that '+' or '-' markers are on their own lines
    // Handle cases where '+' appears mid-line (e.g. "... +item ...") or with a backslash ("\+item")
    let normalized = p.replace(/\\\+/g, '+'); // convert literal "\+" to "+"
    normalized = normalized.replace(/\s\+/g, '\n+'); // convert " space+" to newline+ so it becomes a list item
    normalized = normalized.replace(/\s\-/g, '\n-'); // same for dash bullets

    const lines = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const elements: any[] = [];
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length) {
        elements.push(
          <ul key={`list-${idx}-${elements.length}`} className="list-disc ml-6 mb-6 space-y-2">
            {listItems.map((li, i) => (
              <li key={i} className="leading-relaxed text-2xl sm:text-3xl">
                {li}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    for (const line of lines) {
      if (line.startsWith('+')) {
        listItems.push(line.replace(/^\+/, '').trim());
      } else if (line.startsWith('-')) {
        listItems.push(line.replace(/^-/, '').trim());
      } else {
        flushList();
        elements.push(
          <p key={`p-${idx}-${elements.length}`} className="mb-6 leading-relaxed text-2xl sm:text-3xl">
            {line}
          </p>
        );
      }
    }

    flushList();
    return <div key={`para-${idx}`}>{elements}</div>;
  };

  // Styles for the two faces — rotate each face individually so backface-visibility works reliably
  const frontStyle: any = {
    transform: `rotateY(${flipped ? 180 : 0}deg)`,
    transition: 'transform 0.6s',
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    zIndex: flipped ? 1 : 2,
    position: 'absolute',
    inset: 0,
  };

  const backStyle: any = {
    transform: `rotateY(${flipped ? 0 : -180}deg)`,
    transition: 'transform 0.6s',
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    zIndex: flipped ? 2 : 1,
    position: 'absolute',
    inset: 0,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={() => setFlipped((s) => !s)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped((s) => !s);
        }
      }}
      className="w-full flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-3xl sm:max-w-4xl md:max-w-5xl" style={{ perspective: 1200 }}>
        <div style={{ position: 'relative', height: 'min(80vh, 85vh)' }}>
          {/* Front face */}
          <div style={frontStyle} className="bg-white rounded-xl shadow-md p-6 flex">
            <div className="w-full h-full flex items-center justify-center text-center px-4">
              <h2 className="text-4xl sm:text-5xl font-bold leading-snug whitespace-pre-wrap break-words">{front}</h2>
            </div>

            <div className="absolute bottom-4 left-6 text-sm text-gray-500">Tap or press Enter/Space to flip</div>
          </div>

          {/* Back face */}
          <div style={backStyle} className="bg-white rounded-xl shadow-md p-6 flex">
            <div className="w-full h-full flex items-center justify-center px-4 overflow-auto">
              <div className="text-2xl sm:text-3xl leading-relaxed text-left whitespace-pre-wrap break-words w-full">
                {paragraphs.length > 0 ? paragraphs.map((p, i) => renderParagraph(p, i)) : <p className="leading-relaxed text-2xl sm:text-3xl">{back}</p>}
              </div>
            </div>

            <div className="absolute bottom-4 left-6 text-sm text-gray-500">Tap or press Enter/Space to flip back</div>
          </div>
        </div>
      </div>
    </div>
  );
}
