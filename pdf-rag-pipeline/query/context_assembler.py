from config.settings import MAX_CHUNKS, MAX_CONTEXT_TOKENS


def assemble_context(chunks: list[dict]) -> list[dict]:
    selected: list[dict] = []
    total_tokens = 0
    for chunk in chunks[:MAX_CHUNKS]:
        approx_tokens = len(chunk.get("text", "")) // 4
        if total_tokens + approx_tokens > MAX_CONTEXT_TOKENS:
            break
        selected.append(chunk)
        total_tokens += approx_tokens
    return selected
