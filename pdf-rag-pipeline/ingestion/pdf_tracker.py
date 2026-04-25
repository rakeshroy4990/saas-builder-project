import hashlib
from datetime import datetime, timezone
from glob import glob

from db.mongo_client import get_db


def compute_file_hash(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def list_pdfs(pdf_dir: str) -> list[str]:
    return glob(f"{pdf_dir}/**/*.pdf", recursive=True)


def get_unprocessed_pdfs(pdf_dir: str) -> list[str]:
    db = get_db()
    all_pdfs = list_pdfs(pdf_dir)
    processed_hashes = {
        row["_id"] for row in db.pdf_registry.find({"status": "processed"}, {"_id": 1})
    }
    pending: list[str] = []
    for path in all_pdfs:
        if compute_file_hash(path) not in processed_hashes:
            pending.append(path)
    return pending


def mark_status(file_hash: str, status: str, **kwargs) -> None:
    db = get_db()
    payload = {"status": status, **kwargs}
    if status == "processed":
        payload["ingested_at"] = datetime.now(timezone.utc)
    db.pdf_registry.update_one({"_id": file_hash}, {"$set": payload}, upsert=True)


def ensure_registry_indexes() -> None:
    db = get_db()
    # Ensure collection exists and status lookups are efficient.
    db.pdf_registry.create_index("status", name="pdf_registry_status_idx")
    db.pdf_registry.create_index("ingested_at", name="pdf_registry_ingested_at_idx")
