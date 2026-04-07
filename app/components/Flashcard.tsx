"use client";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  return (
    <article
      className="bg-white text-black border rounded-xl shadow-md p-8 w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto min-h-[70vh] flex flex-col"
      aria-label="Flashcard"
    >
      <header className="mb-6">
        <h2 className="text-4xl sm:text-5xl font-bold leading-snug">{front}</h2>
      </header>

      <section className="text-4xl sm:text-5xl leading-snug whitespace-pre-wrap break-words overflow-auto flex-1">
        {back}
      </section>
    </article>
  );
}
