import os
import json


def parse_qna_file(filepath_or_lines):
    """Parse a QnA text file into a list of question-answer pairs.

    Handles different formats:
    - Lines with a single 'Q' or 'A' marker on their own followed by the content on the next non-empty lines.
    - Inline markers like 'Q Describe...' or 'A Answer...'.
    - Files that start with a question block without an explicit 'Q' marker (looks ahead for the next 'A').
    - Multi-line answers are preserved and concatenated.
    """
    # Load lines
    if isinstance(filepath_or_lines, list):
        raw_lines = filepath_or_lines
    else:
        with open(filepath_or_lines, 'r', encoding='utf-8') as f:
            raw_lines = f.readlines()

    # Normalize lines (keep blanks as "" entries)
    lines = [ln.rstrip('\n') for ln in raw_lines]
    n = len(lines)

    flashcards = []
    i = 0

    current_q = None
    current_a_lines = []

    def flush_pair():
        nonlocal current_q, current_a_lines
        if current_q is not None:
            answer = ' '.join([l.strip() for l in current_a_lines if l is not None and l.strip() != '']).strip()
            flashcards.append({
                'question': current_q.strip(),
                'answer': answer
            })
        current_q = None
        current_a_lines = []

    while i < n:
        raw = lines[i].strip()

        # Helper checks
        is_q_marker = (raw.lower() == 'q')
        is_a_marker = (raw.lower() == 'a')
        is_q_inline = raw.startswith('Q') and len(raw) > 1 and not raw.lower().startswith('q ')
        is_q_inline_space = raw.lower().startswith('q ')  # 'Q Describe...'
        is_a_inline_space = raw.lower().startswith('a ')  # 'A Answer...'

        # 1) Question inline: 'Q Describe...' or 'Q: Describe...'
        if is_q_inline_space or is_q_inline:
            # If there is an existing unflushed Q (rare), flush it (no answer)
            if current_q is not None and current_a_lines:
                flush_pair()
            # Extract question text after the marker
            # drop leading 'Q' and optional ':'
            q_text = raw[1:].lstrip(':').strip()
            if not q_text:
                # If nothing after marker, try next non-empty line
                j = i + 1
                while j < n and lines[j].strip() == '':
                    j += 1
                q_text = lines[j].strip() if j < n else ''
                i = j
            current_q = q_text
            current_a_lines = []
            i += 1
            continue

        # 2) Question marker on its own: 'Q' on a single line
        if is_q_marker:
            # If previous question exists with accumulated answer, flush it first
            if current_q is not None and current_a_lines:
                flush_pair()
            # Find the next non-empty line and take it as the question (may be multi-line in some files)
            j = i + 1
            # Skip repeated blank lines
            while j < n and lines[j].strip() == '':
                j += 1
            # Collect question lines until we hit an 'A' marker or blank separator
            q_parts = []
            while j < n:
                look = lines[j].strip()
                if look.lower() == 'a' or look.lower() == 'q':
                    break
                # If we encounter a line that looks like an answer marker inline, stop
                if look.startswith('A') and (look == 'A' or look.lower().startswith('a ')):
                    break
                # Stop if we reach an empty line followed by another empty line or marker
                q_parts.append(lines[j].strip())
                j += 1
                # If next line is blank and the following is a marker, stop
                if j < n and lines[j].strip() == '':
                    k = j + 1
                    if k < n and (lines[k].strip().lower() in ('q', 'a') or lines[k].strip().startswith('Q') or lines[k].strip().startswith('A')):
                        break
            current_q = ' '.join([p for p in q_parts if p != '']).strip()
            current_a_lines = []
            i = j
            continue

        # 3) Answer inline: 'A Answer...' or 'A: Answer...'
        if is_a_inline_space:
            # collect inline answer and following lines until next Q marker
            a_text = raw[1:].lstrip(':').strip()
            current_a_lines = [a_text] if a_text else []
            j = i + 1
            while j < n:
                look = lines[j].strip()
                if look.lower() == 'q' or look.startswith('Q'):
                    break
                current_a_lines.append(lines[j])
                j += 1
            # finalize pair
            if current_q is None:
                # if there's no question, store empty question
                current_q = ''
            flush_pair()
            i = j
            continue

        # 4) Answer marker on its own: 'A' line
        if is_a_marker:
            # collect all lines after this until next Q marker
            j = i + 1
            a_parts = []
            while j < n:
                look = lines[j].strip()
                if look.lower() == 'q' or look.startswith('Q'):
                    break
                a_parts.append(lines[j])
                j += 1
            current_a_lines = a_parts
            # finalize pair
            if current_q is None:
                current_q = ''
            flush_pair()
            i = j
            continue

        # 5) If we reach a non-marker line and we currently don't have a question,
        # we try a lookahead: if there is an upcoming 'A' marker, treat the block
        # until that 'A' as the question text (handles files that omit the 'Q' marker).
        if current_q is None and raw != '':
            look = i
            found_a = False
            while look < n:
                lk = lines[look].strip()
                if lk.lower() == 'a' or lk.startswith('A'):
                    found_a = True
                    a_index = look
                    break
                if lk.lower() == 'q' and look != i:
                    # found another question before an answer -> don't treat as question block
                    break
                look += 1
            if found_a:
                # lines from i up to a_index are the question
                q_parts = [ln.strip() for ln in lines[i:a_index] if ln.strip() != '']
                if q_parts:
                    current_q = ' '.join(q_parts).strip()
                    # advance to a_index so next loop handles the answer marker
                    i = a_index
                    continue

        # 6) Not a marker and not part of an unfinished question: advance
        i += 1

    # End while
    # If a question remains unflushed (no explicit answer marker at end), flush it
    if current_q is not None and (current_a_lines is not None):
        # If no answer lines, we'll leave answer empty
        flush_pair()

    return flashcards


def process_flashcard_files(input_dir, output_dir, public_dir=None):
    """Process all QnA files in the input directory and save as JSON in the output directory.

    If public_dir is provided, also copy the created JSON files into that directory (for preview).
    """
    input_dir = os.path.expanduser(input_dir)
    output_dir = os.path.expanduser(output_dir)
    if public_dir:
        public_dir = os.path.expanduser(public_dir)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    if public_dir and not os.path.exists(public_dir):
        os.makedirs(public_dir)

    for filename in sorted(os.listdir(input_dir)):
        if not filename.endswith('.txt'):
            continue
        topic_name = os.path.splitext(filename)[0]
        filepath = os.path.join(input_dir, filename)
        print(f'Processing file: {filepath}')
        flashcards = parse_qna_file(filepath)

        output_filepath = os.path.join(output_dir, f"{topic_name}.json")
        with open(output_filepath, 'w', encoding='utf-8') as json_file:
            json.dump(flashcards, json_file, indent=4, ensure_ascii=False)

        if public_dir:
            public_output = os.path.join(public_dir, f"{topic_name}.json")
            with open(public_output, 'w', encoding='utf-8') as pf:
                json.dump(flashcards, pf, indent=4, ensure_ascii=False)

        print(f"Processed {filename} -> {output_filepath} (cards: {len(flashcards)})")


if __name__ == '__main__':
    # Default input and output directories (cleaned files)
    input_directory = os.path.expanduser('~/assistant_workspace/cleaned_flashcards')
    output_directory = os.path.expanduser('~/assistant_workspace/processed_flashcards')
    public_directory = os.path.expanduser('~/assistant_workspace/bites-app/public/flashcards')

    process_flashcard_files(input_directory, output_directory, public_directory)
    print('Flashcard processing complete.')
