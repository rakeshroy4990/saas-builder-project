from __future__ import annotations

from dataclasses import dataclass

from config.settings import EMERGENCY_BYPASS_ENABLED
from query.i18n.detector import LanguageDetector
from query.i18n.registry import LOCALE_REGISTRY, LocaleCode, normalize_locale_code


@dataclass(frozen=True)
class EmergencyCheckResult:
    is_emergency: bool
    emergency_type: str | None = None
    locale: LocaleCode = "en"
    immediate_response: str | None = None
    emergency_call_108: bool = False


def _matches_keyword(text: str, keyword: str) -> bool:
    kw = str(keyword or "").strip().lower()
    if not kw:
        return False
    return kw in text.lower()


def check_emergency(text: str, locale_hint: str | None = None) -> EmergencyCheckResult:
    if not EMERGENCY_BYPASS_ENABLED:
        return EmergencyCheckResult(is_emergency=False)

    raw = str(text or "").strip()
    if not raw:
        return EmergencyCheckResult(is_emergency=False)

    detected = LanguageDetector.detect(raw)
    locale = normalize_locale_code(locale_hint or detected.locale)
    lowered = raw.lower()

    for code, cfg in LOCALE_REGISTRY.items():
        for kw in cfg.emergency_keywords_script:
            if kw in raw or _matches_keyword(lowered, kw):
                return EmergencyCheckResult(
                    is_emergency=True,
                    emergency_type=f"emergency_{code}",
                    locale=normalize_locale_code(code),
                    immediate_response=cfg.emergency_response,
                    emergency_call_108=True,
                )
        for kw in cfg.emergency_keywords_romanized:
            if _matches_keyword(lowered, kw):
                return EmergencyCheckResult(
                    is_emergency=True,
                    emergency_type=f"emergency_{code}",
                    locale=normalize_locale_code(code),
                    immediate_response=cfg.emergency_response,
                    emergency_call_108=True,
                )

    # Fallback: use hint locale response if we matched nothing but caller passed locale
    _ = locale
    return EmergencyCheckResult(is_emergency=False)
