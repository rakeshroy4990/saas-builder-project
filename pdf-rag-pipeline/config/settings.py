import os
from dotenv import load_dotenv

load_dotenv()


# Primary document store for RAG chunks, cache, and pdf registry.
#   mongo    — default; MONGO_URI + MONGO_DB (same as today).
#   postgres — PostgreSQL (e.g. Supabase); requires DATABASE_URL; tables rag_* created on startup.
APP_PERSISTENCE_PROVIDER = os.getenv("APP_PERSISTENCE_PROVIDER", "mongo").strip().lower()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
PG_TEXT_SEARCH_MIN_SCORE = float(os.getenv("PG_TEXT_SEARCH_MIN_SCORE", "0.02"))


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB", "rag_db")


def is_postgres_persistence() -> bool:
    return APP_PERSISTENCE_PROVIDER == "postgres"

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").strip().lower()
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

TEXT_SEARCH_MIN_SCORE = float(os.getenv("TEXT_SEARCH_MIN_SCORE", "0.5"))
MAX_CHUNKS = int(os.getenv("MAX_CHUNKS", "5"))
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "4500"))
MIN_CHUNKS_REQUIRED = int(os.getenv("MIN_CHUNKS_REQUIRED", "1"))
CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "12"))
PDF_DIR = os.getenv("PDF_DIR", "./pdfs")
RAG_LOG_FULL_PROMPT = os.getenv("RAG_LOG_FULL_PROMPT", "false").strip().lower() in {"1", "true", "yes", "on"}
RAG_LOG_PROMPT_PREVIEW_CHARS = int(os.getenv("RAG_LOG_PROMPT_PREVIEW_CHARS", "400"))
APP_LOG_LEVEL = os.getenv("APP_LOG_LEVEL", "INFO").strip().upper()
DOMAIN_POINTS_FILE = os.getenv("DOMAIN_POINTS_FILE", "config/domain_points.json").strip()
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

SENTRY_ENABLED = _env_bool("SENTRY_ENABLED", False)
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "local").strip()
SENTRY_TRACES_SAMPLE_RATE = _env_float("SENTRY_TRACES_SAMPLE_RATE", 0.0)

# ── OpenAI embeddings (Marker ingest + pgvector query) ───────────────────────
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1536"))
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small").strip()

# Marker PDF pipeline (batched slices → markdown + figures → S3 + vectors)
MARKER_BATCH_PAGES = max(1, int(os.getenv("MARKER_BATCH_PAGES", "12")))
MARKER_FORCE_OCR = _env_bool("MARKER_FORCE_OCR", False)
MARKER_DISABLE_MULTIPROCESSING = _env_bool("MARKER_DISABLE_MULTIPROCESSING", True)
MARKER_USE_LLM = _env_bool("MARKER_USE_LLM", False)


def _parse_hex_u64_csv(raw: str) -> list[int]:
    """Comma-separated 16-digit hex values (64-bit average-hash blocklist)."""
    out: list[int] = []
    for part in (raw or "").split(","):
        p = part.strip()
        if not p:
            continue
        try:
            v = int(p, 16)
        except ValueError:
            continue
        if 0 <= v <= 0xFFFFFFFFFFFFFFFF:
            out.append(v)
    return out


MARKER_IMAGE_BLOCKLIST_AHASHES = _parse_hex_u64_csv(
    os.getenv("MARKER_IMAGE_BLOCKLIST_AHASHES", "").strip()
)


def _env_int_clamped(name: str, default: int, lo: int, hi: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        v = int(str(raw).strip())
    except ValueError:
        return default
    return max(lo, min(hi, v))


MARKER_IMAGE_BLOCKLIST_HAMMING_MAX = _env_int_clamped(
    "MARKER_IMAGE_BLOCKLIST_HAMMING_MAX", 14, 0, 64
)
# Log 64-bit average hash for Marker figures (kept + blocklist drops) to tune MARKER_IMAGE_BLOCKLIST_AHASHES.
MARKER_LOG_IMAGE_AHASH = _env_bool("MARKER_LOG_IMAGE_AHASH", False)

# Vector RAG (dual text + image retrieval from rag_retrieval_items)
VECTOR_TOP_K_TEXT = max(1, int(os.getenv("VECTOR_TOP_K_TEXT", "24")))
VECTOR_TOP_K_IMAGE = max(1, int(os.getenv("VECTOR_TOP_K_IMAGE", "8")))
VECTOR_CONTEXT_MAX_TEXT_CHUNKS = max(1, int(os.getenv("VECTOR_CONTEXT_MAX_TEXT_CHUNKS", "14")))
RAG_USE_VECTOR_RETRIEVAL = _env_bool("RAG_USE_VECTOR_RETRIEVAL", True)
# Figure captions embed as near-duplicates — fetch ANN pool, then keep only figures whose PDF page
# is near text chunks actually selected for the LLM (see filter_api_images_by_selected_chunks).
VECTOR_IMAGE_ANN_CANDIDATES = _env_int_clamped("VECTOR_IMAGE_ANN_CANDIDATES", 56, 16, 160)
IMAGE_CONTEXT_PAGE_WINDOW = _env_int_clamped(
    "IMAGE_CONTEXT_PAGE_WINDOW",
    3,
    0,
    30,
)
