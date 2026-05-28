import asyncio

from query import hyde as hyde_mod
from query import multi_query as mq_mod
from query.fusion import reciprocal_rank_fusion
from query.query_pipeline import handle_query
from query.safety_layer import SafetyResult


def test_rrf_prioritizes_cooccurring_chunk():
    ranked_lists = [
        [{"chunk_key": "a", "text": "A"}, {"chunk_key": "b", "text": "B"}],
        [{"chunk_key": "a", "text": "A2"}, {"chunk_key": "c", "text": "C"}],
    ]
    fused = reciprocal_rank_fusion(ranked_lists, top_n=3, k=60)
    assert fused[0]["chunk_key"] == "a"
    assert fused[0]["rrf_score"] > fused[1]["rrf_score"]


def test_hyde_cache_hash_key(monkeypatch):
    hyde_mod._cached_hypothesis.cache_clear()
    calls = {"count": 0}

    def _fake_uncached(user_query: str) -> str:
        calls["count"] += 1
        return f"H::{user_query}"

    monkeypatch.setattr(hyde_mod, "_generate_hypothetical_answer_uncached", _fake_uncached)
    out1 = hyde_mod.get_hypothesis("What is malaria?")
    out2 = hyde_mod.get_hypothesis("what is malaria?")
    assert out1.startswith("H::")
    assert out2.startswith("H::")
    assert calls["count"] == 1


def test_multi_query_fallback_without_openai_key(monkeypatch):
    monkeypatch.setattr(mq_mod, "OPENAI_API_KEY", "")
    variants = mq_mod.generate_query_variants("What is dengue?", "Dengue clinical summary", n=2)
    assert variants == ["What is dengue?"]


def test_query_pipeline_hyde_flag_switch(monkeypatch):
    import query.query_pipeline as qp
    import query.vector_retriever as vr

    state = {"hyde_calls": 0}

    def _fake_hyde(*args, **kwargs):
        state["hyde_calls"] += 1
        return []

    monkeypatch.setattr(qp, "RAG_ENABLE_HYDE", True)
    monkeypatch.setattr(qp, "RAG_USE_VECTOR_RETRIEVAL", True)
    monkeypatch.setattr(qp, "is_postgres_persistence", lambda: True)
    monkeypatch.setattr(qp, "retrieve_hyde_chunks", _fake_hyde)
    monkeypatch.setattr(qp, "retrieve_top_chunks", lambda *args, **kwargs: [])
    monkeypatch.setattr(qp, "get_cached", lambda *args, **kwargs: None)
    monkeypatch.setattr(qp, "set_cache", lambda *args, **kwargs: None)
    monkeypatch.setattr(qp, "check_safety", lambda _: SafetyResult(safe=True))
    monkeypatch.setattr(qp, "infer_user_audience", lambda _: "expert")
    monkeypatch.setattr(qp, "infer_allowed_topics", lambda _: ["general"])
    monkeypatch.setattr(vr, "retrieve_vector_dual", lambda *args, **kwargs: ([], []))
    monkeypatch.setattr(vr, "build_llm_chunks_and_response_images", lambda *args, **kwargs: ([], []))

    result = asyncio.run(handle_query("query about fever"))
    assert result["source"] == "insufficient_chunks"
    assert state["hyde_calls"] == 1

    monkeypatch.setattr(qp, "RAG_ENABLE_HYDE", False)
    state["hyde_calls"] = 0
    result = asyncio.run(handle_query("query about fever"))
    assert result["source"] == "insufficient_chunks"
    assert state["hyde_calls"] == 0

