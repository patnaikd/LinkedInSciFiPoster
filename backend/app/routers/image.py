"""Image generation, serving, selection and deletion router.

Route registration order matters for FastAPI path resolution:
  POST  /suggest-prompt       - fixed path, POST
  POST  /generate             - fixed path, POST
  GET   /download/{post_id}   - MUST be before /{image_id}
  GET   /{image_id}           - parameterised; would shadow "download" if first
  PUT   /{image_id}/select
  DELETE /{image_id}
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.post import Post
from app.models.post_image import PostImage
from app.schemas.post_image import PostImageResponse
from app.services.claude_service import suggest_image_prompt
from app.services.fal_service import generate_image

router = APIRouter()


class GenerateRequest(BaseModel):
    post_id: int
    prompt: str


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


@router.post("/generate", response_model=PostImageResponse, status_code=201)
async def generate_post_image(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
) -> PostImageResponse:
    """Generate an image via fal.ai and store the bytes in the database."""
    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    try:
        image_bytes = await generate_image(payload.prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {e}")

    image = PostImage(
        post_id=payload.post_id,
        image_data=image_bytes,
        prompt=payload.prompt,
        is_selected=False,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return PostImageResponse.model_validate(image)


@router.get("/download/{post_id}")
async def download_post_image(
    post_id: int,
    db: Session = Depends(get_db),
) -> Response:
    """Return the selected image for a post as a browser file download."""
    image = (
        db.query(PostImage)
        .filter(PostImage.post_id == post_id, PostImage.is_selected.is_(True))
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="No selected image for this post")

    return Response(
        content=image.image_data,
        media_type="image/png",
        headers={"Content-Disposition": 'attachment; filename="post-image.png"'},
    )


@router.get("/{image_id}")
async def get_image(
    image_id: int,
    db: Session = Depends(get_db),
) -> Response:
    """Serve image bytes for use in <img src> tags."""
    image = db.query(PostImage).filter(PostImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=image.image_data, media_type="image/png")


@router.put("/{image_id}/select", response_model=PostImageResponse)
async def select_image(
    image_id: int,
    db: Session = Depends(get_db),
) -> PostImageResponse:
    """Mark this image as selected for publishing; deselect all others for the same post."""
    image = db.query(PostImage).filter(PostImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Deselect all siblings in a single bulk update within the same transaction
    db.query(PostImage).filter(
        PostImage.post_id == image.post_id,
        PostImage.id != image_id,
    ).update({"is_selected": False}, synchronize_session="fetch")

    image.is_selected = True
    db.commit()
    db.refresh(image)
    return PostImageResponse.model_validate(image)


@router.delete("/{image_id}")
async def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
) -> Response:
    """Delete a single generated image."""
    image = db.query(PostImage).filter(PostImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(image)
    db.commit()
    return Response(status_code=204)
