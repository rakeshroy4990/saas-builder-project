"""Wall-clock markers for RAG query profiling (stdout)."""
from __future__ import annotations

import time

_wall_t0: float | None = None


def bind_query_wall_clock(t0: float) -> None:
    global _wall_t0
    _wall_t0 = t0


def log_timing(label: str, **kv: str) -> None:
    if _wall_t0 is None:
        return
    elapsed = time.perf_counter() - _wall_t0
    extra = " ".join(f"{k}={v}" for k, v in kv.items())
    line = f"{label}={elapsed:.3f}s"
    if extra:
        line = f"{line} {extra}"
    print(line)
