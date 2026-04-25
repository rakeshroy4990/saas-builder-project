from fastapi import APIRouter, Depends

from api.schemas import QueryRequest, QueryResponse
from auth.dependencies import get_current_user
from auth.models import TokenPayload
from query.query_pipeline import handle_query

router = APIRouter()


@router.post("/query", response_model=QueryResponse, response_model_by_alias=True)
async def query(body: QueryRequest, user: TokenPayload = Depends(get_current_user)):
    result = await handle_query(
        body.question,
        user_id=user.sub,
        user_roles=user.roles,
        conversation_id=body.conversation_id,
        history=body.history,
    )
    return QueryResponse.model_validate(result)
