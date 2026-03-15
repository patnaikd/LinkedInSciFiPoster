from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SciFiItemCreate(BaseModel):
    item_type: Literal["book", "movie"]
    title: str
    author_or_director: str | None = None
    year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    external_id: str | None = None
    themes: list[str] | None = None
    metadata_json: dict | None = None


class SciFiItemResponse(BaseModel):
    id: int
    item_type: str
    title: str
    author_or_director: str | None = None
    year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    external_id: str | None = None
    themes: list[str] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExternalSearchResult(BaseModel):
    source: Literal["tmdb", "open_library"]
    external_id: str
    title: str
    author_or_director: str | None = None
    year: int | None = None
    description: str | None = None
    cover_image_url: str | None = None
    themes: list[str] = []
