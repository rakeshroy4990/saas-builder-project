import hashlib


def _simhash(text: str) -> int:
    words = (text or "").lower().split()
    v = [0] * 64
    for word in words:
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        for i in range(64):
            v[i] += 1 if (h >> i) & 1 else -1
    return sum((1 << i) for i in range(64) if v[i] > 0)


def _hamming(h1: int, h2: int) -> int:
    xor = h1 ^ h2
    return xor.bit_count() if hasattr(xor, "bit_count") else bin(xor).count("1")


def deduplicate_pages(pages: list[str], threshold: int = 10) -> list[str]:
    seen_hashes: list[int] = []
    unique_pages: list[str] = []
    for page in pages:
        page_hash = _simhash(page)
        if all(_hamming(page_hash, seen) > threshold for seen in seen_hashes):
            unique_pages.append(page)
            seen_hashes.append(page_hash)
    return unique_pages
