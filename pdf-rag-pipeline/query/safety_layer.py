import re
from dataclasses import dataclass

BLOCKED_PATTERNS = [
    r"\bdosage.*overdose\b",
    r"\bhow to (harm|hurt|kill)\b",
    r"\bsuicid\b",
    r"\bself.harm\b",
    r"\billegal drug\b",
    r"\bbypass.*safety\b",
    r"\bignore.*instructions\b",
    r"\bforget.*rules\b",
]

ESCALATION_PHRASES = [
    "chest pain",
    "can't breathe",
    "difficulty breathing",
    "stroke",
    "unconscious",
    "severe bleeding",
    "infant fever",
]


@dataclass
class SafetyResult:
    safe: bool
    reason: str = ""
    escalate: bool = False


def check_safety(query: str) -> SafetyResult:
    lower = query.lower()
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, lower):
            return SafetyResult(False, "Query contains restricted content.")
    for phrase in ESCALATION_PHRASES:
        if phrase in lower:
            return SafetyResult(True, "Emergency symptoms detected.", True)
    return SafetyResult(True)
