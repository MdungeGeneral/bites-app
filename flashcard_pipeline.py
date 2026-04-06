import os
import json

def parse_qna_file(filepath):
    """Parse a QnA text file into a list of question-answer pairs."""
    flashcards = []
    with open(filepath, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    question, answer = None, None
    for line in lines:
        line = line.strip()
        if line.startswith("Question"):
            if question and answer:
                flashcards.append({"question": question, "answer": answer})
                question, answer = None, None
            question = line.split("Question")[-1].strip(" :")
        elif line.startswith("Answer"):
            answer = line.split("Answer")[-1].strip(" :")

    # Append the last QnA pair if exists
    if question and answer:
        flashcards.append({"question": question, "answer": answer})

    return flashcards


def process_flashcard_files(input_dir, output_dir):
    """Process all QnA files in the input directory and save as JSON in the output directory."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for filename in os.listdir(input_dir):
        if filename.endswith('.txt'):
            topic_name = os.path.splitext(filename)[0]
            filepath = os.path.join(input_dir, filename)
            
            flashcards = parse_qna_file(filepath)
            output_filepath = os.path.join(output_dir, f"{topic_name}.json")

            with open(output_filepath, 'w', encoding='utf-8') as json_file:
                json.dump(flashcards, json_file, indent=4)

            print(f"Processed {filename} -> {output_filepath}")


if __name__ == "__main__":
    # Define input and output directories
    input_directory = os.path.expanduser("~/assistant_workspace/source_flashcards/flashcards")
    output_directory = os.path.expanduser("~/assistant_workspace/processed_flashcards")

    process_flashcard_files(input_directory, output_directory)
    print("Flashcard processing complete.")