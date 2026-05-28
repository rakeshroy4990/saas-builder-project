from __future__ import annotations

from typing import Any


def reciprocal_rank_fusion(ranked_lists: list[list[dict[str, Any]]], top_n: int = 6, k: int = 60) -> list[dict[str, Any]]:
    scores: dict[str, float] = {}
    payloads: dict[str, dict[str, Any]] = {}
    for ranked in ranked_lists:
        for rank, item in enumerate(ranked):
            if not isinstance(item, dict):
                continue
            chunk_id = str(item.get("chunk_key") or "")
            if not chunk_id:
                chunk_id = f"{item.get('source_file','')}:{item.get('page_num',0)}:{rank}"
            payloads[chunk_id] = item
            scores[chunk_id] = scores.get(chunk_id, 0.0) + (1.0 / (k + rank + 1))

    merged: list[dict[str, Any]] = []
    for chunk_id, score in scores.items():
        base = dict(payloads.get(chunk_id, {}))
        base["rrf_score"] = score
        merged.append(base)
    merged.sort(key=lambda row: float(row.get("rrf_score") or 0.0), reverse=True)
    return merged[: max(1, int(top_n))]

