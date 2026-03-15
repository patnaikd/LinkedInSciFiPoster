from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.post import Post
from app.schemas.ai import GeneratePostRequest, GeneratePostResponse
from app.services.claude_service import generate_post

router = APIRouter()


@router.post("/generate", response_model=GeneratePostResponse)
def generate_post_endpoint(
    payload: GeneratePostRequest,
    db: Session = Depends(get_db),
) -> GeneratePostResponse:
    """Generate or regenerate post content using Claude AI.

    Fetches the post (with its linked sci-fi item and research items), sends
    the context to Claude, and persists the generated content as a new draft.
    """
    post = (
        db.query(Post)
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))
        .filter(Post.id == payload.post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    sci_fi_item = post.sci_fi_item
    if sci_fi_item is None:
        raise HTTPException(
            status_code=400,
            detail="Post has no linked sci-fi item. Link a book or movie first.",
        )

    # Build a dict representation of the sci-fi item for the service
    themes: list[str] = []
    if sci_fi_item.themes:
        try:
            themes = json.loads(sci_fi_item.themes)
        except (json.JSONDecodeError, TypeError):
            themes = []

    item_data = {
        "title": sci_fi_item.title,
        "author_or_director": sci_fi_item.author_or_director,
        "year": sci_fi_item.year,
        "description": sci_fi_item.description,
        "item_type": sci_fi_item.item_type,
        "themes": themes,
    }

    # Build research context
    research_items = [
        {
            "title": ri.title,
            "url": ri.url,
            "snippet": ri.snippet,
            "source_name": ri.source_name,
        }
        for ri in post.research_items
    ]

    # Determine if this is a regeneration (pass previous draft content)
    previous_draft = post.content if post.draft_number >= 1 and post.content else None

    try:
        generated_content, prompt_used = generate_post(
            sci_fi_item=item_data,
            research_items=research_items,
            tone=payload.tone,
            additional_instructions=payload.additional_instructions,
            previous_draft=previous_draft,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    # Update the post with new content
    new_draft_number = post.draft_number + 1 if post.content else 1
    post.content = generated_content
    post.ai_prompt_used = prompt_used
    post.tone = payload.tone
    post.draft_number = new_draft_number
    post.status = "draft"

    db.commit()
    db.refresh(post)

    return GeneratePostResponse(
        generated_content=generated_content,
        prompt_used=prompt_used,
        draft_number=new_draft_number,
    )
