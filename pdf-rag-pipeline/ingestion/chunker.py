def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
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
