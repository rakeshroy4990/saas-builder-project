import asyncio
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from api.schemas import QueryRequest, QueryResponse
from auth.dependencies import get_current_user
from auth.models import TokenPayload
from query.query_pipeline import handle_query

router = APIRouter()
LOG = logging.getLogger(__name__)


@router.post("/query", response_model=QueryResponse, response_model_by_alias=True)
async def query(body: QueryRequest, user: TokenPayload = Depends(get_current_user)):
    actor_user_id = str(body.user_id or "").strip() or user.sub
    result = await handle_query(
        body.question,
        user_id=actor_user_id,
        user_roles=user.roles,
        conversation_id=body.conversation_id,
        history=body.history,
        book_name=body.book_name,
        include_outdated_books=body.include_outdated_books,
        retrieval_question=body.retrieval_question,
    )
    return QueryResponse.model_validate(result)


def _ndjson_line(obj: dict) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


@router.post("/query/stream")
async def query_stream(body: QueryRequest, user: TokenPayload = Depends(get_current_user)):
    """NDJSON stream: ``ready`` (metadata), ``delta`` (answer fragments), ``complete`` (full QueryResponse)."""
    actor_user_id = str(body.user_id or "").strip() or user.sub
    queue: asyncio.Queue = asyncio.Queue()

    async def runner() -> None:
        try:
            await handle_query(
                body.question,
                user_id=actor_user_id,
                user_roles=user.roles,
                conversation_id=body.conversation_id,
                history=body.history,
                book_name=body.book_name,
                include_outdated_books=body.include_outdated_books,
                retrieval_question=body.retrieval_question,
                stream_queue=queue,
            )
        except Exception as exc:
            LOG.exception("[RAG][STREAM] query failed")
            await queue.put(("error", {"message": str(exc)}))
        finally:
            await queue.put(None)

    task = asyncio.create_task(runner())

    async def gen() -> AsyncIterator[bytes]:
        # First body chunk before retrieval/LLM so clients and reverse proxies see low TTFB
        # (otherwise the browser attributes the full RAG+model latency to "waiting for server response").
        yield _ndjson_line(
            {
                "type": "ready",
                "data": {
                    "source": "rag",
                    "phase": "accepted",
                    "images": [],
                    "chunks_used": None,
                },
            }
        )
        try:
            # While ``handle_query`` runs sync OpenAI/DB work on the default loop, ``queue.get()`` can
            # block for a long time with no bytes on the wire — some L7 proxies and clients treat that
            # as a dead connection. Emit lightweight ``ping`` lines until real events arrive.
            ping_interval_s = 18.0
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=ping_interval_s)
                except asyncio.TimeoutError:
                    yield _ndjson_line({"type": "ping", "data": {"phase": "processing"}})
                    continue
                if item is None:
                    break
                kind, payload = item
                if kind == "ready":
                    obj = {"type": "ready", "data": payload}
                elif kind == "delta":
                    obj = {"type": "delta", "text": payload}
                elif kind == "status":
                    obj = {"type": "status", "data": payload}
                elif kind == "complete":
                    try:
                        resp = QueryResponse.model_validate(payload)
                        obj = {"type": "complete", "data": resp.model_dump(by_alias=True)}
                    except Exception as exc:
                        LOG.warning("[RAG][STREAM] complete validate failed: %s", exc)
                        obj = {"type": "error", "data": {"message": "invalid_query_response"}}
                elif kind == "error":
                    obj = {"type": "error", "data": payload}
                else:
                    continue
                yield _ndjson_line(obj)
        finally:
            await task

    return StreamingResponse(
        gen(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
