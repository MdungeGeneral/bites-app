import Flashcard from "../components/Flashcard";

export default function FlashcardExample() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black">
      <Flashcard
        front="What is the capital of France?"
        back="Paris"
      />
    </div>
  );
}