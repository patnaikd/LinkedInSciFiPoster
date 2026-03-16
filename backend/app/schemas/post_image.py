from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PostImageResponse(BaseModel):
    id: int
    post_id: int
    prompt: str | None = None
    is_selected: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
