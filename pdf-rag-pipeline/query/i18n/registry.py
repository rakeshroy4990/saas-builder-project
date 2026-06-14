from __future__ import annotations

from dataclasses import dataclass, field
from typing import FrozenSet, Literal, Tuple

from config.settings import LANGUAGE_DETECTION_MIN_CONFIDENCE

LocaleCode = Literal["en", "hi", "kn"]
ScriptKind = Literal["latin", "devanagari", "kannada", "mixed"]

SUPPORTED_LOCALE_CODES: frozenset[str] = frozenset({"en", "hi", "kn"})


@dataclass(frozen=True)
class LocaleChatConfig:
    code: LocaleCode
    script_unicode_ranges: Tuple[Tuple[int, int], ...]
    romanization_signals: FrozenSet[str]
    emergency_keywords_script: FrozenSet[str]
    emergency_keywords_romanized: FrozenSet[str]
    emergency_response: str
    reply_system_block: str
    insufficient_message: str
    display_label: str = ""


LOCALE_REGISTRY: dict[str, LocaleChatConfig] = {
    "en": LocaleChatConfig(
        code="en",
        script_unicode_ranges=(),
        romanization_signals=frozenset(),
        emergency_keywords_script=frozenset(
            {
                "can't breathe",
                "cannot breathe",
                "not breathing",
                "seizure",
                "convulsion",
                "unconscious",
                "won't wake",
                "blue lips",
                "choking",
                "severe bleeding",
                "fainted",
            }
        ),
        emergency_keywords_romanized=frozenset(),
        emergency_response=(
            "This sounds like a medical emergency. Call 108 immediately. Do not wait.\n\n"
            "I am not a doctor and this is not medical advice."
        ),
        reply_system_block="",
        insufficient_message="I don't have enough information to answer this.",
        display_label="English",
    ),
    "hi": LocaleChatConfig(
        code="hi",
        script_unicode_ranges=((0x0900, 0x097F),),
        romanization_signals=frozenset(
            {
                "namaste",
                "baccha",
                "bacche",
                "bukhar",
                "bukhaar",
                "dawa",
                "dawakhana",
                "kya",
                "hoga",
                "theek",
                "achha",
                "bimari",
                "ilaj",
                "doctor",
                "saans",
                "behosh",
                "daura",
                "khoon",
                "hosh",
            }
        ),
        emergency_keywords_script=frozenset(
            {
                "सांस नहीं",
                "बेहोश",
                "दौरा",
                "खून",
                "होश नहीं",
                "तुरंत",
                "आपातकाल",
            }
        ),
        emergency_keywords_romanized=frozenset(
            {
                "saans nahi",
                "behosh",
                "daura",
                "khoon",
                "hosh nahi",
                "turant",
                "aapatak",
            }
        ),
        emergency_response=(
            "यह चिकित्सा आपातकाल है। तुरंत 108 पर कॉल करें। प्रतीक्षा न करें।\n\n"
            "मैं डॉक्टर नहीं हूँ और यह चिकित्सा सलाह नहीं है।"
        ),
        reply_system_block=(
            "The user has asked their question in Hindi. Respond ENTIRELY in Hindi using Devanagari "
            "script (हिंदी). Use simple, conversational Hindi. Medical terms may be kept in English "
            "but written in Devanagari script phonetically if helpful."
        ),
        insufficient_message="मेरे पास इसका उत्तर देने के लिए पर्याप्त जानकारी नहीं है।",
        display_label="हिंदी",
    ),
    "kn": LocaleChatConfig(
        code="kn",
        script_unicode_ranges=((0x0C80, 0x0CFF),),
        romanization_signals=frozenset(
            {
                "namaskara",
                "hegidira",
                "magu",
                "maduve",
                "aaroogya",
                "doktru",
                "jwara",
                "kashi",
                "hogbeka",
                "aagide",
                "ushiratu",
                "moorche",
                "ecchara",
                "turtu",
            }
        ),
        emergency_keywords_script=frozenset(
            {
                "ಉಸಿರಾಟ",
                "ಮೂರ್ಛೆ",
                "ರಕ್ತಸ್ರಾವ",
                "ಎಚ್ಚರ ಇಲ್ಲ",
                "ತುರ್ತು",
            }
        ),
        emergency_keywords_romanized=frozenset(
            {
                "ushiratu",
                "moorche",
                "ecchara illa",
                "turtu",
            }
        ),
        emergency_response=(
            "ಇದು ತುರ್ತು ವೈದ್ಯಕೀಯ ಪರಿಸ್ಥಿತಿ. ತಕ್ಷಣ 108 ಗೆ ಕರೆ ಮಾಡಿ. ಕಾಯಬೇಡಿ.\n\n"
            "ನಾನು ವೈದ್ಯರಲ್ಲ ಮತ್ತು ಇದು ವೈದ್ಯಕೀಯ ಸಲಹೆಯಲ್ಲ."
        ),
        reply_system_block=(
            "The user has asked their question in Kannada. Respond ENTIRELY in Kannada script "
            "(ಕನ್ನಡ). Do not mix English words unless they are medical terms with no Kannada "
            "equivalent, in which case write the English term in Kannada script phonetically. "
            "Use simple, conversational Kannada that a parent with basic literacy can understand."
        ),
        insufficient_message="ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಲು ನನ್ನ ಬಳಿ ಸಾಕಷ್ಟು ಮಾಹಿತಿ ಇಲ್ಲ.",
        display_label="ಕನ್ನಡ",
    ),
}


def normalize_locale_code(value: str | None) -> LocaleCode:
    raw = str(value or "").strip().lower()
    if raw in SUPPORTED_LOCALE_CODES:
        return raw  # type: ignore[return-value]
    return "en"


def get_locale_config(code: str | None) -> LocaleChatConfig:
    return LOCALE_REGISTRY[normalize_locale_code(code)]


def resolve_reply_locale(
    *,
    detected_locale: str,
    detected_confidence: float,
    reply_locale_hint: str | None = None,
    preferred_locale: str | None = None,
    audience: str = "layman",
) -> LocaleCode:
    hint = str(reply_locale_hint or preferred_locale or "").strip().lower()
    if hint in SUPPORTED_LOCALE_CODES:
        return normalize_locale_code(hint)
    if str(audience or "").strip().lower() == "expert":
        return "en"
    if detected_confidence >= LANGUAGE_DETECTION_MIN_CONFIDENCE and detected_locale in SUPPORTED_LOCALE_CODES:
        return normalize_locale_code(detected_locale)
    return "en"
