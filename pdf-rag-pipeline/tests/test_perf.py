"""Performance instrumentation (PERF_ENABLED) smoke tests."""

import time
from urllib.parse import quote
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

from auth.dependencies import get_current_user, require_admin
from auth.models import TokenPayload
from perf import perf_context as pc


@pytest.fixture
def admin_token(monkeypatch) -> str:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-min-32-characters-long")
    monkeypatch.setenv("JWT_ISSUER", "medicheck-backend")
    monkeypatch.setenv("JWT_AUDIENCE", "web")
    import importlib

    import auth.jwt_validator as jv

    importlib.reload(jv)
    import hashlib

    key = hashlib.sha256(b"unit-test-secret-min-32-characters-long").digest()
    return jwt.encode(
        {
            "sub": "admin-perf-test",
            "email": "admin@test.local",
            "roles": ["ROLE_ADMIN"],
            "exp": int(time.time()) + 3600,
            "iss": "medicheck-backend",
            "aud": "web",
        },
        key,
        algorithm="HS256",
    )


@pytest.fixture
def perf_client(monkeypatch, admin_token):
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-min-32-characters-long")
    monkeypatch.setenv("JWT_ISSUER", "medicheck-backend")
    monkeypatch.setenv("JWT_AUDIENCE", "web")
    monkeypatch.setattr(pc, "PERF_ENABLED", True)
    import api.main as main_mod

    monkeypatch.setattr(main_mod, "ensure_text_index", lambda: None)
    monkeypatch.setattr(main_mod, "ensure_cache_ttl_index", lambda: None)
    monkeypatch.setattr(main_mod, "ensure_registry_indexes", lambda: None)
    monkeypatch.setattr(main_mod, "is_postgres_persistence", lambda: False)
    app = main_mod.app

    app.dependency_overrides[get_current_user] = lambda: TokenPayload(
        sub="u1", email="d@test", roles=["ROLE_DOCTOR"], exp=int(time.time()) + 3600
    )
    app.dependency_overrides[require_admin] = lambda: TokenPayload(
        sub="a1", email="a@test", roles=["ROLE_ADMIN"], exp=int(time.time()) + 3600
    )
    with TestClient(app) as c:
        yield c, admin_token
    app.dependency_overrides.clear()


def test_timed_span_accumulates():
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(pc, "PERF_ENABLED", True)
    try:
        tr = pc.PerfTrace(operation="unit")
        with pc.timed_span(tr, "db"):
            time.sleep(0.01)
        with pc.timed_span(tr, "db"):
            time.sleep(0.01)
        assert "db" in tr.spans
        assert tr.spans["db"] >= 15.0
    finally:
        monkeypatch.undo()


def test_query_response_includes_perf_keys(perf_client):
    client, _token = perf_client
    fake = {
        "answer": "ok",
        "source": "rag",
        "chunks_used": 1,
        "follow_up_questions": [],
        "images": [],
        "reference": [],
        "perf": {
            "spans": {"keyword_extract": 0.1, "db": 1.0, "llm": 2.0, "response_format": 0.2},
            "total_ms": 5.0,
        },
    }

    with patch("api.routes.query.handle_query", new=AsyncMock(return_value=fake)):
        r = client.post(
            "/api/v1/query",
            json={"Question": "test?", "ConversationId": "c1"},
            headers={"Authorization": "Bearer x"},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    perf = body.get("Perf") or body.get("perf")
    assert perf is not None
    spans = perf.get("spans") or perf.get("Spans")
    assert spans is not None
    assert "db" in spans
    assert "llm" in spans


def test_ingest_perf_sync_returns_spans(perf_client, tmp_path, monkeypatch):
    client, admin_token = perf_client
    pdf = tmp_path / "dummy.pdf"
    pdf.write_bytes(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    fake_perf = {"spans": {"preprocess": 1.0, "db": 2.0, "embedding": 0.0}, "total_ms": 4.0}

    with patch("api.routes.ingest.process_pdf", return_value=fake_perf):
        r = client.post(
            f"/api/v1/ingest?filepath={quote(str(pdf))}&perf_sync=true",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    perf = body.get("Perf") or body.get("perf")
    assert perf is not None
    spans = perf["spans"]
    assert "preprocess" in spans
    assert "db" in spans
    assert "embedding" in spans
