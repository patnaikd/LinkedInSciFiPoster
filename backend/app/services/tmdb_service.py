from __future__ import annotations

import httpx

from app.config import settings

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w300"

GENRE_MAP: dict[int, str] = {
    878: "Science Fiction",
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    53: "Thriller",
    10752: "War",
    37: "Western",
}


def _map_movie(movie: dict) -> dict:
    """Map a raw TMDB movie dict to our standard format."""
    poster_path = movie.get("poster_path")
    cover_image_url = f"{IMAGE_BASE_URL}{poster_path}" if poster_path else None

    release_date = movie.get("release_date", "") or ""
    year = release_date[:4] if len(release_date) >= 4 else None

    genre_ids = movie.get("genre_ids", [])
    themes = [GENRE_MAP[gid] for gid in genre_ids if gid in GENRE_MAP]

    return {
        "source": "tmdb",
        "external_id": str(movie.get("id", "")),
        "title": movie.get("title", "Unknown Title"),
        "author_or_director": None,
        "year": int(year) if year and year.isdigit() else None,
        "description": movie.get("overview"),
        "cover_image_url": cover_image_url,
        "themes": themes,
    }


async def search_movies(query: str, page: int = 1) -> list[dict]:
    """Search TMDB for movies matching the given query.

    Args:
        query: The search string.
        page: Page number for pagination (1-indexed).

    Returns:
        A list of dicts, each representing a movie result.
    """
    params = {
        "api_key": settings.TMDB_API_KEY,
        "query": query,
        "page": page,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{BASE_URL}/search/movie", params=params)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"TMDB request timed out while searching for '{query}'"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"TMDB returned HTTP {exc.response.status_code} "
            f"while searching for '{query}'"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"TMDB request failed while searching for '{query}': {exc}"
        ) from exc

    data = response.json()
    return [_map_movie(movie) for movie in data.get("results", [])]


async def get_trending_scifi(page: int = 1) -> list[dict]:
    """Fetch trending / popular science fiction movies from TMDB.

    Args:
        page: Page number for pagination (1-indexed).

    Returns:
        A list of dicts, each representing a sci-fi movie result.
    """
    params = {
        "api_key": settings.TMDB_API_KEY,
        "with_genres": 878,
        "sort_by": "popularity.desc",
        "page": page,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{BASE_URL}/discover/movie", params=params)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "TMDB request timed out while fetching trending sci-fi"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"TMDB returned HTTP {exc.response.status_code} "
            "while fetching trending sci-fi"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"TMDB request failed while fetching trending sci-fi: {exc}"
        ) from exc

    data = response.json()
    return [_map_movie(movie) for movie in data.get("results", [])]
