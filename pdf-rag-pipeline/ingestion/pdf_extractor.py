import fitz


def extract_pages(filepath: str) -> list[str]:
    pages: list[str] = []
    with fitz.open(filepath) as doc:
        for page in doc:
            pages.append(page.get_text("text") or "")
    return pages
