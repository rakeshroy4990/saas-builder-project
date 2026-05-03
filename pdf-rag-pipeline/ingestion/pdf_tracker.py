import hashlib
from datetime import datetime, timezone
from glob import glob

from config.settings import is_postgres_persistence


def compute_file_hash(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def list_pdfs(pdf_dir: str) -> list[str]:
    return glob(f"{pdf_dir}/**/*.pdf", recursive=True)


def get_unprocessed_pdfs(pdf_dir: str) -> list[str]:
    all_pdfs = list_pdfs(pdf_dir)
    if is_postgres_persistence():
        from db import postgres_backend as pg

        processed_hashes = pg.pdf_registry_processed_hashes()
    else:
        from db.mongo_client import get_db

        db = get_db()
        processed_hashes = {row["_id"] for row in db.pdf_registry.find({"status": "processed"}, {"_id": 1})}
    pending: list[str] = []
    for path in all_pdfs:
        if compute_file_hash(path) not in processed_hashes:
            pending.append(path)
    return pending


def mark_status(file_hash: str, status: str, **kwargs) -> None:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        merged = {**kwargs}
        if status == "processed":
            merged["ingested_at"] = datetime.now(timezone.utc)
        pg.pdf_registry_mark(file_hash, status, **merged)
        return

    from db.mongo_client import get_db

    db = get_db()
    payload = {"status": status, **kwargs}
    if status == "processed":
        payload["ingested_at"] = datetime.now(timezone.utc)
    db.pdf_registry.update_one({"_id": file_hash}, {"$set": payload}, upsert=True)


def ensure_registry_indexes() -> None:
    if is_postgres_persistence():
        return
    from db.mongo_client import get_db

    db = get_db()
    db.pdf_registry.create_index("status", name="pdf_registry_status_idx")
    db.pdf_registry.create_index("ingested_at", name="pdf_registry_ingested_at_idx")


def registry_count_total() -> int:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        return pg.pdf_registry_count_total()
    from db.mongo_client import get_db

    return get_db().pdf_registry.count_documents({})


def registry_count_status(status: str) -> int:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        return pg.pdf_registry_count_status(status)
    from db.mongo_client import get_db

    return get_db().pdf_registry.count_documents({"status": status})


def registry_find_failed(limit: int) -> list[dict]:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        return pg.pdf_registry_find_failed(limit)
    from db.mongo_client import get_db

    return list(
        get_db().pdf_registry.find({"status": "failed"}, {"_id": 1, "filename": 1, "filepath": 1, "error": 1})
        .sort("ingested_at", -1)
        .limit(limit)
    )


def registry_find_recent(limit: int) -> list[dict]:
    if is_postgres_persistence():
        from db import postgres_backend as pg

        return pg.pdf_registry_find_recent(limit)
    from db.mongo_client import get_db

    return list(
        get_db()
        .pdf_registry.find(
            {},
            {
                "_id": 1,
                "filename": 1,
                "filepath": 1,
                "status": 1,
                "chunks_count": 1,
                "error": 1,
                "prefilter_stats": 1,
                "ingested_at": 1,
            },
        )
        .sort("ingested_at", -1)
        .limit(limit)
    )
