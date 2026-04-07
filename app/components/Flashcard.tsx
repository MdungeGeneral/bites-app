"use client";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  return (
    <article
      className="bg-white text-black border rounded-xl shadow-md p-6 w-full max-w-4xl mx-auto"
      aria-label="Flashcard"
    >
      <header className="mb-4">
        <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{front}</h2>
      </header>

      <section className="text-lg sm:text-2xl leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-[60vh]">
        {back}
      </section>
    </article>
  );
}
