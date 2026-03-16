"""Image generation and download router.

POST /api/image/generate  — calls fal.ai, saves image locally, updates post.image_url
GET  /api/image/download/{post_id} — streams saved image as a browser download
"""
from __future__ import annotations

import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.post import Post
from app.services.claude_service import suggest_image_prompt
from app.services.fal_service import generate_image

router = APIRouter()

IMAGES_DIR = Path("static/images")


class GenerateRequest(BaseModel):
    post_id: int
    prompt: str


class GenerateResponse(BaseModel):
    image_url: str


class SuggestPromptResponse(BaseModel):
    prompt: str


@router.post("/suggest-prompt", response_model=SuggestPromptResponse)
async def suggest_post_image_prompt(
    post_id: int,
    db: Session = Depends(get_db),
) -> SuggestPromptResponse:
    """Use Claude to suggest an image prompt based on the post's sci-fi item and research."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    sci_fi_item = post.sci_fi_item
    if not sci_fi_item:
        raise HTTPException(status_code=400, detail="Post has no linked sci-fi item")

    import json

    themes = sci_fi_item.themes
    if isinstance(themes, str):
        try:
            themes = json.loads(themes)
        except Exception:
            themes = []

    sci_fi_dict = {
        "title": sci_fi_item.title,
        "author_or_director": sci_fi_item.author_or_director,
        "year": sci_fi_item.year,
        "description": sci_fi_item.description,
        "themes": themes,
    }

    research_list = [
        {"title": r.title, "url": r.url, "snippet": r.snippet}
        for r in post.research_items
    ]

    try:
        prompt = suggest_image_prompt(sci_fi_dict, research_list)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return SuggestPromptResponse(prompt=prompt)


@router.post("/generate", response_model=GenerateResponse)
async def generate_post_image(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
) -> GenerateResponse:
    """Generate an image for a post via fal.ai and save it locally."""
    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    try:
        image_bytes = await generate_image(payload.prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {e}")

    filename = f"{payload.post_id}_{int(time.time())}.png"
    image_path = IMAGES_DIR / filename
    image_path.write_bytes(image_bytes)

    image_url = f"/static/images/{filename}"
    post.image_url = image_url
    db.commit()

    return GenerateResponse(image_url=image_url)


@router.get("/download/{post_id}")
async def download_post_image(
    post_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    """Return the generated image as a browser file download."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post or not post.image_url:
        raise HTTPException(status_code=404, detail="Image not found for this post")

    # image_url is stored as e.g. "/static/images/1_1234567890.png"
    image_path = Path(post.image_url.lstrip("/"))
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(
        path=str(image_path),
        media_type="image/png",
        filename="post-image.png",
        headers={"Content-Disposition": 'attachment; filename="post-image.png"'},
    )
