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
from app.services.fal_service import generate_image

router = APIRouter()

IMAGES_DIR = Path("static/images")


class GenerateRequest(BaseModel):
    post_id: int
    prompt: str


class GenerateResponse(BaseModel):
    image_url: str


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
