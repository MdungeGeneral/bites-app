"use client";

type FlashcardProps = {
  front: string;
  back: string;
};

export default function Flashcard({ front, back }: FlashcardProps) {
  const paragraphs = back
    ? back
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <article
      className="bg-white text-black border rounded-xl shadow-md p-8 w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto min-h-[70vh] flex flex-col"
      aria-label="Flashcard"
    >
      <header className="mb-6">
        <h2 className="text-4xl sm:text-5xl font-bold leading-snug">{front}</h2>
      </header>

      <section className="text-3xl sm:text-4xl leading-relaxed text-justify">
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <p key={i} className="mb-4" style={{ whiteSpace: "pre-wrap" }}>
              {p}
            </p>
          ))
        ) : (
          <p style={{ whiteSpace: "pre-wrap" }}>{back}</p>
        )}
      </section>
    </article>
  );
}
