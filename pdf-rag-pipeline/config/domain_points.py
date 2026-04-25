import json
from pathlib import Path
from typing import Any

from config.settings import DOMAIN_POINTS_FILE


def _default_payload() -> dict[str, Any]:
    return {
        "term_aliases": {},
        "query_aliases": {},
        "short_line_signals": [],
        "page_topic_keywords": {},
        "intent_keywords": {},
        "role_audience_map": {},
        "source_audience_rules": [],
        "default_audience": "layman",
    }


def _resolve_path(path_str: str) -> Path:
    candidate = Path(path_str)
    if candidate.is_absolute():
        return candidate
    # Resolve relative to pdf-rag-pipeline package root.
    return (Path(__file__).resolve().parent.parent / candidate).resolve()


def _load_payload() -> dict[str, Any]:
    payload = _default_payload()
    path = _resolve_path(DOMAIN_POINTS_FILE)
    if not path.exists():
        return payload
    with path.open("r", encoding="utf-8") as f:
        loaded = json.load(f)
    if not isinstance(loaded, dict):
        return payload
    payload.update({k: loaded.get(k, v) for k, v in payload.items()})
    return payload


_PAYLOAD = _load_payload()


def term_aliases() -> dict[str, list[str]]:
    return dict(_PAYLOAD.get("term_aliases", {}))


def query_aliases() -> dict[str, list[str]]:
    return dict(_PAYLOAD.get("query_aliases", {}))


def short_line_signals() -> list[str]:
    return list(_PAYLOAD.get("short_line_signals", []))


def page_topic_keywords() -> dict[str, list[str]]:
    return dict(_PAYLOAD.get("page_topic_keywords", {}))


def intent_keywords() -> dict[str, list[str]]:
    return dict(_PAYLOAD.get("intent_keywords", {}))


def role_audience_map() -> dict[str, str]:
    return dict(_PAYLOAD.get("role_audience_map", {}))


def source_audience_rules() -> list[dict[str, str]]:
    return list(_PAYLOAD.get("source_audience_rules", []))


def default_audience() -> str:
    value = str(_PAYLOAD.get("default_audience", "layman")).strip().lower()
    return value if value in {"layman", "expert"} else "layman"
