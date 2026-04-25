from cache.query_cache import get_cached, set_cache
from config.settings import TEXT_SEARCH_MIN_SCORE
from query.context_assembler import assemble_context
from query.llm_service import answer_with_context
from query.retriever import retrieve_top_chunks
from query.safety_layer import check_safety


async def handle_query(user_query: str, user_id: str = "") -> dict:
    cached = get_cached(user_query)
    if cached:
        return {"answer": cached, "source": "cache"}

    safety = check_safety(user_query)
    if not safety.safe:
        return {"answer": safety.reason, "source": "safety_block"}

    if safety.escalate:
        return {
            "answer": "Your symptoms may indicate an emergency. Please call emergency services or visit the nearest hospital immediately.",
            "source": "escalation",
        }

    chunks = retrieve_top_chunks(user_query, top_k=5, min_score=TEXT_SEARCH_MIN_SCORE)
    if not chunks:
        return {
            "answer": "I could not find relevant information in the uploaded documents. Please try rephrasing the question.",
            "source": "no_results",
        }

    selected = assemble_context(chunks)
    answer = answer_with_context(user_query, selected)
    set_cache(user_query, answer)

    return {"answer": answer, "source": "rag", "chunks_used": len(selected), "user_id": user_id}
