import logging
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator

PERF_ENABLED = os.getenv("PERF_ENABLED", "false").lower() == "true"

logger = logging.getLogger("PERF")


@dataclass
class PerfTrace:
    operation: str
    spans: Dict[str, float] = field(default_factory=dict)
    total_ms: float = 0.0

    def log(self) -> None:
        if PERF_ENABLED:
            payload: Dict[str, Any] = {
                "layer": "fastapi",
                "operation": self.operation,
                "spans": self.spans,
                "total_ms": self.total_ms,
            }
            logger.info("%s", payload)


@contextmanager
def timed_span(trace: PerfTrace | None, name: str) -> Iterator[None]:
    if trace is None or not PERF_ENABLED:
        yield
        return
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = round((time.perf_counter() - start) * 1000, 2)
        trace.spans[name] = round(trace.spans.get(name, 0.0) + elapsed, 2)


def finalize_perf(trace: PerfTrace | None, wall_start: float | None) -> dict[str, Any] | None:
    """Wall-clock total, structured log, and payload fragment for API responses."""
    if trace is None or wall_start is None:
        return None
    trace.total_ms = round((time.perf_counter() - wall_start) * 1000, 2)
    trace.log()
    return {"spans": dict(trace.spans), "total_ms": trace.total_ms}
