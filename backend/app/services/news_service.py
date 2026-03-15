from __future__ import annotations

import httpx

from app.config import settings

BASE_URL = "https://newsapi.org/v2"


async def search_news(keywords: str, page: int = 1) -> list[dict]:
    """Search for news articles matching the given keywords via NewsAPI.

    Args:
        keywords: The search keywords / query string.
        page: Page number for pagination (1-indexed).

    Returns:
        A list of dicts, each representing a news article.
    """
    params = {
        "q": keywords,
        "sortBy": "relevancy",
        "pageSize": 10,
        "page": page,
        "apiKey": settings.NEWS_API_KEY,
        "language": "en",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{BASE_URL}/everything", params=params)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"NewsAPI request timed out while searching for '{keywords}'"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"NewsAPI returned HTTP {exc.response.status_code} "
            f"while searching for '{keywords}'"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"NewsAPI request failed while searching for '{keywords}': {exc}"
        ) from exc

    data = response.json()
    articles = data.get("articles", [])

    results: list[dict] = []
    for article in articles:
        source_info = article.get("source") or {}
        results.append(
            {
                "title": article.get("title"),
                "description": article.get("description"),
                "url": article.get("url"),
                "image_url": article.get("urlToImage"),
                "source_name": source_info.get("name"),
                "published_at": article.get("publishedAt"),
            }
        )

    return results
