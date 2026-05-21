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

# INSTALL_MARKER=1 adds torch + marker-pdf (large; only for ingest routes).
ARG INSTALL_MARKER=1

# ── Layer A: app deps (cached when only requirements.txt changes) ─
COPY pdf-rag-pipeline/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# ── Layer B: optional Marker stack (CPU torch — Cloud Run has no GPU) ─
COPY pdf-rag-pipeline/requirements-marker.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$INSTALL_MARKER" = "1" ]; then \
      pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
      && pip install --no-cache-dir -r requirements-marker.txt; \
    fi

# ── Source (invalidates only the final thin layer when app code changes) ──
COPY pdf-rag-pipeline/ .

EXPOSE 8080
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
