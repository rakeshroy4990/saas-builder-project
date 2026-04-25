from fastapi import APIRouter, Depends

from api.schemas import QueryRequest
from auth.dependencies import get_current_user
from auth.models import TokenPayload
from query.query_pipeline import handle_query

router = APIRouter()


@router.post("/query")
async def query(body: QueryRequest, user: TokenPayload = Depends(get_current_user)):
    return await handle_query(body.question, user_id=user.sub)
