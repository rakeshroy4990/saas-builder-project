from config.settings import MAX_CHUNKS, MAX_CONTEXT_TOKENS
from typing import Optional
from query.token_utils import estimate_tokens


def assemble_context(chunks: list[dict], max_chunks: Optional[int] = None) -> list[dict]:
    selected: list[dict] = []
    total_tokens = 0
    chunk_limit = MAX_CHUNKS if max_chunks is None else max(1, int(max_chunks))
    for chunk in chunks[:chunk_limit]:
        approx_tokens = estimate_tokens(chunk.get("text", ""))
        if total_tokens + approx_tokens > MAX_CONTEXT_TOKENS:
            break
        selected.append(chunk)
        total_tokens += approx_tokens
    return selected


def context_tokens(chunks: list[dict]) -> int:
    return sum(estimate_tokens(chunk.get("text", "")) for chunk in chunks)


def trim_chunks(chunks: list[dict], max_context_tokens: int = MAX_CONTEXT_TOKENS) -> list[dict]:
    if not chunks:
        return []
    trimmed: list[dict] = list(chunks)
    while trimmed and context_tokens(trimmed) > max_context_tokens:
        trimmed.pop()
    return trimmed
