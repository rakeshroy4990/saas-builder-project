from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from query.i18n.registry import LOCALE_REGISTRY, LocaleCode, ScriptKind, SUPPORTED_LOCALE_CODES

_LATIN_RE = re.compile(r"[A-Za-z]")
_WORD_RE = re.compile(r"[A-Za-z\u0900-\u097F\u0C80-\u0CFF]+")


@dataclass(frozen=True)
class DetectionResult:
    locale: LocaleCode
    script: ScriptKind
    confidence: float
    romanized: bool


def _count_script_chars(text: str, low: int, high: int) -> int:
    return sum(1 for ch in text if low <= ord(ch) <= high)


def _count_latin_chars(text: str) -> int:
    return sum(1 for ch in text if "A" <= ch <= "Z" or "a" <= ch <= "z")


def _romanization_hits(text: str, signals: frozenset[str]) -> int:
    lowered = text.lower()
    tokens = {t.lower() for t in _WORD_RE.findall(lowered)}
    return sum(1 for sig in signals if sig in tokens or sig in lowered)


class LanguageDetector:
    @staticmethod
    def detect(text: str) -> DetectionResult:
        raw = str(text or "").strip()
        if len(raw) < 2:
            return DetectionResult(locale="en", script="latin", confidence=0.3, romanized=False)

        kn_count = _count_script_chars(raw, 0x0C80, 0x0CFF)
        hi_count = _count_script_chars(raw, 0x0900, 0x097F)
        latin_count = _count_latin_chars(raw)

        if kn_count > 0 and hi_count > 0:
            dominant: LocaleCode = "kn" if kn_count >= hi_count else "hi"
            return DetectionResult(
                locale=dominant,
                script="mixed",
                confidence=0.85,
                romanized=False,
            )

        if kn_count > 0:
            return DetectionResult(
                locale="kn",
                script="kannada",
                confidence=0.95,
                romanized=False,
            )

        if hi_count > 0:
            return DetectionResult(
                locale="hi",
                script="devanagari",
                confidence=0.95,
                romanized=False,
            )

        kn_roman = _romanization_hits(raw, LOCALE_REGISTRY["kn"].romanization_signals)
        hi_roman = _romanization_hits(raw, LOCALE_REGISTRY["hi"].romanization_signals)

        if kn_roman >= 2 and kn_roman >= hi_roman:
            return DetectionResult(locale="kn", script="latin", confidence=0.7, romanized=True)
        if hi_roman >= 2:
            return DetectionResult(locale="hi", script="latin", confidence=0.7, romanized=True)

        if latin_count > 0 or _LATIN_RE.search(raw):
            return DetectionResult(locale="en", script="latin", confidence=0.8, romanized=False)

        return DetectionResult(locale="en", script="latin", confidence=0.4, romanized=False)
