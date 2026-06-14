"""Multilingual chat support for Smart AI (detect → translate → RAG → reply in locale)."""

from query.i18n.detector import DetectionResult, LanguageDetector
from query.i18n.emergency import EmergencyCheckResult, check_emergency
from query.i18n.registry import LOCALE_REGISTRY, LocaleChatConfig, normalize_locale_code, resolve_reply_locale
from query.i18n.translator import translate_to_english

__all__ = [
    "DetectionResult",
    "EmergencyCheckResult",
    "LanguageDetector",
    "LocaleChatConfig",
    "LOCALE_REGISTRY",
    "check_emergency",
    "normalize_locale_code",
    "resolve_reply_locale",
    "translate_to_english",
]
