import re
from config.domain_points import short_line_signals, term_aliases

# Normalize common dotted clinical abbreviations so retrieval can match short queries
# like "tb" against source text that appears as "t.b." in PDFs.
_DOTTED_ABBREVIATION_ALIASES = {
    r"\bt\.\s*b\.\b": "tb tuberculosis",
    r"\bc\.\s*o\.\s*p\.\s*d\.\b": "copd chronic obstructive pulmonary disease",
}

# Broader medical normalization to support common patient-style questions at retrieval time.
# This enriches chunk text with clinically equivalent lay/short terms.
_TERM_ALIASES = term_aliases()
_SHORT_LINE_SIGNAL_WORDS = [w for w in short_line_signals() if str(w).strip()]
_SHORT_LINE_MEDICAL_SIGNALS = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in _SHORT_LINE_SIGNAL_WORDS) + r")\b",
    re.IGNORECASE,
) if _SHORT_LINE_SIGNAL_WORDS else re.compile(r"$a")


def _normalize_chunk_text(text: str) -> str:
    normalized = str(text or "")
    for pattern, replacement in _DOTTED_ABBREVIATION_ALIASES.items():
        normalized = re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
    # Generic dotted abbreviations: "a.b.c." -> "abc"
    normalized = re.sub(
        r"\b(?:[a-zA-Z]\.\s*){2,}[a-zA-Z]\.?\b",
        lambda m: re.sub(r"[^a-zA-Z]", "", m.group(0)).lower(),
        normalized,
    )
    normalized_lower = normalized.lower()
    alias_tokens: list[str] = []
    for canonical, aliases in _TERM_ALIASES.items():
        # Enrich only when canonical term appears in body text (not any loose alias),
        # to avoid polluting unrelated chunks with broad alias footer tokens.
        if re.search(r"\b" + re.escape(canonical) + r"\b", normalized_lower):
            alias_tokens.extend(aliases)
    if alias_tokens:
        normalized = normalized + "\n\n[medical_aliases] " + " ".join(sorted(set(alias_tokens)))
    return normalized


def _normalize_pdf_line_wraps(text: str) -> str:
    """
    Merge PDF line-wrapped prose back into paragraph-like blocks.

    Many PDF extractors emit one sentence as multiple short lines. If those line
    breaks are treated as hard boundaries, chunk counts explode and context quality
    drops sharply.
    """
    raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not raw.strip():
        return ""

    # Rejoin hyphenated words split across lines (e.g., "classi-\nfication").
    raw = re.sub(r"([A-Za-z])-\n([A-Za-z])", r"\1\2", raw)

    lines = raw.split("\n")
    paragraphs: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if not current:
            return
        joined = re.sub(r"\s+", " ", " ".join(current)).strip()
        if joined:
            paragraphs.append(joined)
        current.clear()

    def is_hard_boundary(line: str) -> bool:
        s = line.strip()
        if not s:
            return True
        if s.startswith("[IMAGE:") or s.startswith("[IMAGE_DATA:"):
            return True
        if s.startswith("#"):
            return True
        if re.match(r"^(\*|-|\+)\s+", s):
            return True
        if re.match(r"^\d+[\).]\s+", s):
            return True
        return False

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            flush()
            continue
        if is_hard_boundary(line):
            flush()
            paragraphs.append(line)
            continue
        if not current:
            current.append(line)
            continue

        prev = current[-1]
        # Keep probable section titles as standalone paragraphs.
        if len(prev.split()) <= 3 and line[:1].isupper() and prev[:1].isupper():
            flush()
            current.append(line)
            continue
        # If previous line ended as a sentence, start a new paragraph.
        if re.search(r"[.!?:]\s*$", prev):
            flush()
            current.append(line)
            continue

        current.append(line)

    flush()
    return "\n\n".join(paragraphs)


def _word_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    step = max(chunk_size - overlap, 1)
    for i in range(0, len(words), step):
        segment = " ".join(words[i : i + chunk_size]).strip()
        if segment:
            chunks.append(segment)
    return chunks


def _looks_like_table_block(block: str) -> bool:
    b = block.lower()
    if "table " in b:
        return True
    # Table-like extracted text often has many short lines and sparse punctuation.
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    if len(lines) >= 6:
        avg_words = sum(len(ln.split()) for ln in lines) / max(len(lines), 1)
        return avg_words <= 12
    return False


def _merge_short_blocks(blocks: list[str], min_words: int = 60) -> list[str]:
    """Merge short paragraph blocks into neighboring text to reduce over-fragmentation."""
    merged: list[str] = []
    buffer = ""
    for block in blocks:
        candidate = block
        if buffer:
            candidate = f"{buffer}\n\n{candidate}".strip()
            buffer = ""
        if len(candidate.split()) < min_words:
            buffer = candidate
            continue
        merged.append(candidate)
    if buffer:
        if merged:
            merged[-1] = f"{merged[-1]}\n\n{buffer}".strip()
        else:
            merged.append(buffer)
    return merged


def _table_line_chunks(block: str, max_words: int = 200) -> list[str]:
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    if not lines:
        return []
    chunks: list[str] = []
    cur: list[str] = []
    cur_words = 0
    for line in lines:
        w = len(line.split())
        if cur and cur_words + w > max_words:
            chunks.append(" ".join(cur).strip())
            cur = [line]
            cur_words = w
        else:
            cur.append(line)
            cur_words += w
    if cur:
        chunks.append(" ".join(cur).strip())
    return chunks


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> list[str]:
    normalized = _normalize_pdf_line_wraps(_normalize_chunk_text(text))
    if not normalized.strip():
        return []

    # Chunk by blocks first to avoid giant mixed-topic windows.
    if "table " in normalized.lower():
        # Keep table pages as one block so row context can be merged instead of
        # splitting each cell into tiny disconnected fragments.
        blocks = [normalized.strip()]
    else:
        blocks = [b.strip() for b in re.split(r"\n{2,}", normalized) if b.strip()]
        blocks = _merge_short_blocks(blocks, min_words=60)
    if not blocks:
        blocks = [normalized]

    chunks: list[str] = []
    for block in blocks:
        if _looks_like_table_block(block):
            chunks.extend(_table_line_chunks(block))
        else:
            chunks.extend(_word_chunks(block, chunk_size=chunk_size, overlap=overlap))

    # Remove exact duplicates while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for chunk in chunks:
        key = chunk.strip()
        if not key or key in seen:
            continue
        # Drop alias-only artifacts generated by block splitting.
        if key.lower().startswith("[medical_aliases]"):
            continue
        body = re.sub(r"\[medical_aliases\].*$", "", key, flags=re.IGNORECASE | re.DOTALL).strip()
        # Keep only chunks with meaningful body text to avoid retrieval pollution.
        if len(body.split()) < 8 and not _SHORT_LINE_MEDICAL_SIGNALS.search(body):
            continue
        seen.add(key)
        unique.append(key)
    return unique
