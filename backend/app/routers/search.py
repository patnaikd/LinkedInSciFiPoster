from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.library import ExternalSearchResult
from app.services.open_library_service import search_books
from app.services.tmdb_service import get_trending_scifi, search_movies

router = APIRouter()


@router.get("/books", response_model=list[ExternalSearchResult])
async def search_books_endpoint(
    query: str = Query(..., min_length=1, description="Search query for books"),
    page: int = Query(1, ge=1),
) -> list[ExternalSearchResult]:
    """Search for sci-fi books via Open Library."""
    try:
        results = await search_books(query=query, page=page)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Open Library search failed: {e}")


@router.get("/movies", response_model=list[ExternalSearchResult])
async def search_movies_endpoint(
    query: str = Query(..., min_length=1, description="Search query for movies"),
    page: int = Query(1, ge=1),
) -> list[ExternalSearchResult]:
    """Search for sci-fi movies via TMDB."""
    try:
        results = await search_movies(query=query, page=page)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB search failed: {e}")


@router.get("/movies/trending", response_model=list[ExternalSearchResult])
async def trending_scifi_movies(
    page: int = Query(1, ge=1),
) -> list[ExternalSearchResult]:
    """Get trending sci-fi movies from TMDB."""
    try:
        results = await get_trending_scifi(page=page)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TMDB trending fetch failed: {e}")
