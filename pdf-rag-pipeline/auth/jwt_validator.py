import jwt
from fastapi import HTTPException, status

from auth.models import TokenPayload
from config.settings import JWT_ALGORITHM, JWT_ISSUER, JWT_SECRET


CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


def decode_token(token: str) -> TokenPayload:
    try:
        kwargs = {
            "key": JWT_SECRET,
            "algorithms": [JWT_ALGORITHM],
            "options": {"verify_exp": True},
        }
        if JWT_ISSUER:
            kwargs["issuer"] = JWT_ISSUER
        payload = jwt.decode(token, **kwargs)
        return TokenPayload(
            sub=payload["sub"],
            email=payload.get("email", ""),
            roles=payload.get("roles", []),
            exp=payload["exp"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise CREDENTIALS_EXCEPTION
