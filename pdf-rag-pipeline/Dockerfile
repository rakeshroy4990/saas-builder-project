FROM python:3.11-slim

# ── System deps ─────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Layer A: ML stack (CPU wheels only — Cloud Run has no GPU) ───
# Default PyPI torch pulls ~2GB of CUDA libs; CPU index is ~200MB and caches faster.
COPY pdf-rag-pipeline/requirements-base.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && grep -vE '^(torch|torchvision)\s*($|#)' requirements-base.txt > /tmp/requirements-base-rest.txt \
    && pip install --no-cache-dir -r /tmp/requirements-base-rest.txt

# ── Layer B: Light/changing deps ────────────────────────────────
COPY pdf-rag-pipeline/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# ── Source (invalidates only the final thin layer when app code changes) ──
COPY pdf-rag-pipeline/ .

EXPOSE 8080
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
