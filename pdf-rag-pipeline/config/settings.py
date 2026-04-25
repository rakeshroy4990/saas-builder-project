import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB", "rag_db")

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
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "2000"))
MIN_CHUNKS_REQUIRED = int(os.getenv("MIN_CHUNKS_REQUIRED", "1"))
CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "12"))
PDF_DIR = os.getenv("PDF_DIR", "./pdfs")
RAG_LOG_FULL_PROMPT = os.getenv("RAG_LOG_FULL_PROMPT", "false").strip().lower() in {"1", "true", "yes", "on"}
RAG_LOG_PROMPT_PREVIEW_CHARS = int(os.getenv("RAG_LOG_PROMPT_PREVIEW_CHARS", "400"))
APP_LOG_LEVEL = os.getenv("APP_LOG_LEVEL", "INFO").strip().upper()
DOMAIN_POINTS_FILE = os.getenv("DOMAIN_POINTS_FILE", "config/domain_points.json").strip()
