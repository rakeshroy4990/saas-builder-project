from __future__ import annotations

from unittest.mock import patch

import pytest

from query.i18n.detector import LanguageDetector
from query.i18n.emergency import check_emergency
from query.i18n.translator import clear_translation_cache, translate_to_english


def test_detect_pure_kannada_script():
    result = LanguageDetector.detect("ನನ್ನ ಮಗುವಿಗೆ ಜ್ವರ ಇದೆ")
    assert result.locale == "kn"
    assert result.script == "kannada"
    assert result.confidence >= 0.9


def test_detect_pure_hindi_script():
    result = LanguageDetector.detect("मेरे बच्चे को बुखार है")
    assert result.locale == "hi"
    assert result.script == "devanagari"
    assert result.confidence >= 0.9


def test_detect_english():
    result = LanguageDetector.detect("My child has a fever")
    assert result.locale == "en"
    assert result.confidence >= 0.7


def test_detect_romanized_kannada():
    result = LanguageDetector.detect("magu ge jwara ide, doktru heli")
    assert result.locale == "kn"
    assert result.romanized is True


def test_detect_romanized_hindi():
    result = LanguageDetector.detect("mere bacche ko bukhar hai")
    assert result.locale == "hi"
    assert result.romanized is True


def test_detect_mixed_script_prefers_dominant():
    result = LanguageDetector.detect("hello ನನ್ನ ಮಗು हिंदी")
    assert result.locale in {"kn", "hi"}
    assert result.script == "mixed"


def test_detect_short_text_low_confidence():
    result = LanguageDetector.detect("?")
    assert result.locale == "en"
    assert result.confidence < 0.5


def test_emergency_kannada_keyword():
    result = check_emergency("ಮೂರ್ಛೆ ಆಗಿದೆ")
    assert result.is_emergency is True
    assert result.emergency_call_108 is True
    assert "108" in (result.immediate_response or "")


def test_emergency_hindi_romanized():
    result = check_emergency("saans nahi aa raha")
    assert result.is_emergency is True
    assert result.locale == "hi"


def test_emergency_normal_question():
    result = check_emergency("mere bacche ko halka jukam hai")
    assert result.is_emergency is False


def test_translate_english_passthrough():
    clear_translation_cache()
    text = "My child has fever"
    with patch("query.i18n.translator._call_openai_translate") as mocked:
        out = translate_to_english(text, "en")
    assert out == text
    mocked.assert_not_called()


def test_translate_kannada_uses_openai(monkeypatch):
    clear_translation_cache()
    monkeypatch.setattr(
        "query.i18n.translator._call_openai_translate",
        lambda text, locale: "My child has fever",
    )
    out = translate_to_english("ನನ್ನ ಮಗುವಿಗೆ ಜ್ವರ", "kn")
    assert out == "My child has fever"
