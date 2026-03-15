from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.library import SciFiItemResponse
from app.schemas.research import ResearchItemResponse


class PostCreate(BaseModel):
    sci_fi_item_id: int | None = None
    title: str | None = None
    content: str | None = None
    tone: str = "professional_witty"


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tone: str | None = None
    status: str | None = None


class PostResponse(BaseModel):
    id: int
    sci_fi_item_id: int | None = None
    title: str | None = None
    content: str | None = None
    tone: str
    status: str
    draft_number: int
    image_url: str | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    sci_fi_item: SciFiItemResponse | None = None
    research_items: list[ResearchItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
