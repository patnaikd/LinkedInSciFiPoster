from __future__ import annotations

import httpx

BASE_URL = "https://openlibrary.org"
COVER_BASE_URL = "https://covers.openlibrary.org/b/id"


async def search_books(query: str, page: int = 1) -> list[dict]:
    """Search Open Library for books matching the given query.

    Args:
        query: The search string.
        page: Page number for pagination (1-indexed).

    Returns:
        A list of dicts, each representing a book result.
    """
    params = {
        "q": query,
        "page": page,
        "limit": 20,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{BASE_URL}/search.json", params=params)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"Open Library request timed out while searching for '{query}'"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Open Library returned HTTP {exc.response.status_code} "
            f"while searching for '{query}'"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Open Library request failed while searching for '{query}': {exc}"
        ) from exc

    data = response.json()
    docs = data.get("docs", [])

    results: list[dict] = []
    for doc in docs:
        cover_i = doc.get("cover_i")
        cover_image_url = (
            f"{COVER_BASE_URL}/{cover_i}-M.jpg" if cover_i else None
        )

        first_sentence = None
        first_sentence_raw = doc.get("first_sentence")
        if first_sentence_raw:
            if isinstance(first_sentence_raw, list) and first_sentence_raw:
                first_sentence = first_sentence_raw[0]
            elif isinstance(first_sentence_raw, str):
                first_sentence = first_sentence_raw

        author_names = doc.get("author_name", [None])
        author = author_names[0] if author_names else None

        results.append(
            {
                "source": "open_library",
                "external_id": doc.get("key", ""),
                "title": doc.get("title", "Unknown Title"),
                "author_or_director": author,
                "year": doc.get("first_publish_year"),
                "description": first_sentence,
                "cover_image_url": cover_image_url,
                "themes": doc.get("subject", [])[:5],
            }
        )

    return results
