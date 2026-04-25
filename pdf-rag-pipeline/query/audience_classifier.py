import re
from typing import Iterable, Optional

from config.domain_points import default_audience, role_audience_map, source_audience_rules


def infer_user_audience(user_roles: Optional[Iterable[str]]) -> str:
    mapping = {k.upper(): v for k, v in role_audience_map().items()}
    for role in user_roles or []:
        resolved = mapping.get(str(role).upper().strip())
        if resolved in {"layman", "expert"}:
            return resolved
    return default_audience()


def infer_source_audience(source_file: str) -> str:
    source = str(source_file or "")
    for rule in source_audience_rules():
        pattern = str(rule.get("pattern", "")).strip()
        audience = str(rule.get("audience", "")).strip().lower()
        if not pattern or audience not in {"layman", "expert"}:
            continue
        if re.search(pattern, source, flags=re.IGNORECASE):
            return audience
    return default_audience()
