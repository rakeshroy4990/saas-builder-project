from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.jwt_validator import decode_token
from auth.models import TokenPayload


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenPayload:
    return decode_token(credentials.credentials)


def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    if "ROLE_ADMIN" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


def _has_any_role(user: TokenPayload, wanted: set[str]) -> bool:
    norm = {str(r).strip().upper() for r in (user.roles or [])}
    for w in wanted:
        if w in norm:
            return True
        if not w.startswith("ROLE_") and f"ROLE_{w}" in norm:
            return True
    return False


def require_clinical_reader(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """Doctor Studio / education catalog: clinicians and admins may read book metadata."""
    allowed = {"ROLE_DOCTOR", "ROLE_CLINICIAN", "ROLE_ADMIN", "DOCTOR", "CLINICIAN", "ADMIN"}
    if not _has_any_role(user, allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor, clinician, or admin role required",
        )
    return user
