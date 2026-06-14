from __future__ import annotations

from typing import Any, Optional

ADJECTIVE_TRAITS = frozenset({"LEAN", "STOCKY", "SLENDER", "TALL", "SHORT", "LARGE_HEAD"})

_TRAIT_LABELS: dict[str, dict[str, str]] = {
    "en": {
        "LEAN": "Lean",
        "STOCKY": "Stocky",
        "SLENDER": "Slender",
        "TALL": "Tall",
        "SHORT": "Short",
        "NORMAL_WEIGHT": "Normal weight",
        "UNDERWEIGHT": "Underweight",
        "OVERWEIGHT": "Overweight",
        "LARGE_HEAD": "Large head",
        "BOY": "Boy",
        "GIRL": "Girl",
        "CHILD": "Child",
    },
    "hi": {
        "LEAN": "दुबला",
        "STOCKY": "मोटा",
        "SLENDER": "पतला",
        "TALL": "लंबा",
        "SHORT": "छोटा",
        "NORMAL_WEIGHT": "सामान्य वजन",
        "UNDERWEIGHT": "कम वजन",
        "OVERWEIGHT": "अधिक वजन",
        "LARGE_HEAD": "बड़ा सिर",
        "BOY": "लड़का",
        "GIRL": "लड़की",
        "CHILD": "बच्चा",
    },
    "kn": {
        "LEAN": "ತೆಳ್ಳಗಿನ",
        "STOCKY": "ದಪ್ಪ",
        "SLENDER": "ಸಣಕ",
        "TALL": "ಎತ್ತರ",
        "SHORT": "ಕುಳ್ಳ",
        "NORMAL_WEIGHT": "ಸಾಮಾನ್ಯ ತೂಕ",
        "UNDERWEIGHT": "ಕಡಿಮೆ ತೂಕ",
        "OVERWEIGHT": "ಹೆಚ್ಚು ತೂಕ",
        "LARGE_HEAD": "ದೊಡ್ಡ ತಲೆ",
        "BOY": "ಹುಡುಗ",
        "GIRL": "ಹುಡುಗಿ",
        "CHILD": "ಮಗು",
    },
}


def _label(locale: str, code: str) -> str:
    bucket = _TRAIT_LABELS.get(locale) or _TRAIT_LABELS["en"]
    return bucket.get(code) or _TRAIT_LABELS["en"].get(code, code)


def derive_trait_codes(
    *,
    weight_percentile: Optional[float],
    height_percentile: Optional[float],
    bmi_percentile: Optional[float],
    hc_percentile: Optional[float],
) -> list[str]:
    codes: list[str] = []
    wp = float(weight_percentile) if weight_percentile is not None else None
    hp = float(height_percentile) if height_percentile is not None else None
    bp = float(bmi_percentile) if bmi_percentile is not None else None
    hcp = float(hc_percentile) if hc_percentile is not None else None

    if bp is not None and bp < 15.0 and (hp is None or hp >= 50.0):
        codes.append("LEAN")
    elif bp is not None and bp > 85.0:
        codes.append("STOCKY")
    elif wp is not None and wp < 15.0:
        codes.append("SLENDER")

    if hp is not None and hp >= 85.0:
        codes.append("TALL")
    elif hp is not None and hp <= 15.0:
        codes.append("SHORT")

    if wp is not None:
        if 15.0 <= wp <= 85.0:
            codes.append("NORMAL_WEIGHT")
        elif wp < 15.0:
            codes.append("UNDERWEIGHT")
        else:
            codes.append("OVERWEIGHT")

    if hcp is not None and hcp >= 85.0:
        codes.append("LARGE_HEAD")

    if not any(code in ADJECTIVE_TRAITS for code in codes) and not codes:
        codes.append("NORMAL_WEIGHT")

    # Preserve order, drop duplicates
    seen: set[str] = set()
    ordered: list[str] = []
    for code in codes:
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def derive_growth_characteristics(
    *,
    sex: Optional[str],
    weight_percentile: Optional[float],
    height_percentile: Optional[float],
    bmi_percentile: Optional[float],
    hc_percentile: Optional[float],
    reply_locale: Optional[str] = None,
) -> dict[str, Any]:
    locale = str(reply_locale or "en").strip().lower()[:2] or "en"
    trait_codes = derive_trait_codes(
        weight_percentile=weight_percentile,
        height_percentile=height_percentile,
        bmi_percentile=bmi_percentile,
        hc_percentile=hc_percentile,
    )
    labels = [_label(locale, code) for code in trait_codes]

    sex_norm = str(sex or "").strip().lower()
    if sex_norm == "female":
        sex_label = _label(locale, "GIRL")
    elif sex_norm == "male":
        sex_label = _label(locale, "BOY")
    else:
        sex_label = _label(locale, "CHILD")

    if sex_label and sex_label not in labels:
        labels.append(sex_label)

    adjectives = [
        _label(locale, code).lower()
        for code in trait_codes
        if code in ADJECTIVE_TRAITS
    ]
    if adjectives:
        phrase = adjectives[0].capitalize()
        if len(adjectives) > 1:
            phrase += " " + " ".join(adjectives[1:])
        phrase += f" {sex_label.lower()}"
    else:
        phrase = sex_label

    return {
        "Phrase": phrase.strip(),
        "Labels": labels,
        "TraitCodes": trait_codes,
    }
