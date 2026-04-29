FROM python:3.11-slim

# System deps — cached unless this block changes
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

# Install deps — cached unless requirements.txt changes
COPY pdf-rag-pipeline/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source last — cache invalidated only when code changes
COPY pdf-rag-pipeline/ .

EXPOSE 8080
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]