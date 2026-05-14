import json
import logging
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from perf.perf_context import PERF_ENABLED

LOG = logging.getLogger("PERF")


class PerfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not PERF_ENABLED:
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Perf-Duration-Ms"] = str(duration_ms)
        payload = {
            "layer": "fastapi",
            "path": request.url.path,
            "method": request.method,
            "status": response.status_code,
            "durationMs": duration_ms,
        }
        LOG.info("%s", json.dumps(payload))
        return response
