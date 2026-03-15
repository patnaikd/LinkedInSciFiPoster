from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ResearchItemCreate(BaseModel):
    post_id: int
    source_type: Literal["news_api", "manual_url", "manual_text"]
    title: str | None = None
    url: str | None = None
    snippet: str | None = None
    source_name: str | None = None
    published_at: datetime | None = None


class ResearchItemResponse(BaseModel):
    id: int
    post_id: int
    source_type: str
    title: str | None = None
    url: str | None = None
    snippet: str | None = None
    source_name: str | None = None
    published_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
