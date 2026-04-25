def estimate_tokens(text: str) -> int:
    # Rough estimate: 1 token ~= 4 characters.
    if text is None:
        return 0
    return len(text) // 4
