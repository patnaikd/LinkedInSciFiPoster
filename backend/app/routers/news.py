from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.news_service import search_news

router = APIRouter()


@router.get("/search")
async def search_news_endpoint(
    keywords: str = Query(..., min_length=1, description="Keywords to search for"),
    page: int = Query(1, ge=1),
) -> list[dict]:
    """Search for sci-fi related news articles via News API."""
    try:
        results = await search_news(keywords=keywords, page=page)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"News search failed: {e}")
