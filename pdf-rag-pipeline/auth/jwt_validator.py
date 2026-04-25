import jwt
from fastapi import HTTPException, status
import hashlib

from auth.models import TokenPayload
from config.settings import JWT_ALGORITHM, JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET


CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def _normalize_roles(payload: dict) -> list[str]:
    raw_roles = payload.get("roles", [])
    roles: list[str] = []
    if isinstance(raw_roles, list):
        roles = [str(item).strip() for item in raw_roles if str(item).strip()]
    elif isinstance(raw_roles, str) and raw_roles.strip():
        roles = [raw_roles.strip()]

    # Support backend tokens that use singular "role": "ADMIN".
    raw_role = str(payload.get("role", "")).strip()
    if raw_role:
        roles.append(raw_role)
        if not raw_role.startswith("ROLE_"):
            roles.append(f"ROLE_{raw_role}")

    # De-duplicate while preserving order.
    seen: set[str] = set()
    deduped: list[str] = []
    for role in roles:
        if role not in seen:
            deduped.append(role)
            seen.add(role)
    return deduped


def _derived_signing_key(secret: str) -> bytes:
    # backend-hospital JwtService signs with SHA-256(secret) bytes.
    normalized = (secret or "").strip() or "change-this-jwt-secret-min-32-bytes"
    return hashlib.sha256(normalized.encode("utf-8")).digest()


def decode_token(token: str) -> TokenPayload:
    try:
        kwargs = {
            "key": _derived_signing_key(JWT_SECRET),
            "algorithms": [JWT_ALGORITHM],
            "options": {"verify_exp": True},
        }
        if JWT_ISSUER:
            kwargs["issuer"] = JWT_ISSUER
        if JWT_AUDIENCE:
            kwargs["audience"] = JWT_AUDIENCE
        else:
            # Our backend includes `aud`, but we keep audience optional for local/dev parity.
            kwargs["options"]["verify_aud"] = False
        payload = jwt.decode(token, **kwargs)
        return TokenPayload(
            sub=payload["sub"],
            email=payload.get("email", ""),
            roles=_normalize_roles(payload),
            exp=payload["exp"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise CREDENTIALS_EXCEPTION
