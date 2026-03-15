from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.post import Post
from app.models.sci_fi_item import SciFiItem
from app.schemas.library import SciFiItemResponse
from app.schemas.post import PostCreate, PostResponse, PostUpdate
from app.schemas.research import ResearchItemResponse

router = APIRouter()


def _parse_themes(themes_str: str | None) -> list[str] | None:
    """Parse a JSON-encoded themes string back to a list."""
    if themes_str is None:
        return None
    try:
        return json.loads(themes_str)
    except (json.JSONDecodeError, TypeError):
        return None


def _sci_fi_item_to_response(item: SciFiItem | None) -> SciFiItemResponse | None:
    """Convert a SciFiItem ORM instance to a response with parsed themes."""
    if item is None:
        return None
    return SciFiItemResponse(
        id=item.id,
        item_type=item.item_type,
        title=item.title,
        author_or_director=item.author_or_director,
        year=item.year,
        description=item.description,
        cover_image_url=item.cover_image_url,
        external_id=item.external_id,
        themes=_parse_themes(item.themes),
        created_at=item.created_at,
    )


def _post_to_response(post: Post) -> PostResponse:
    """Convert a Post ORM instance to a response with properly parsed nested data."""
    research_items = [
        ResearchItemResponse.model_validate(ri) for ri in post.research_items
    ]
    return PostResponse(
        id=post.id,
        sci_fi_item_id=post.sci_fi_item_id,
        title=post.title,
        content=post.content,
        tone=post.tone,
        status=post.status,
        draft_number=post.draft_number,
        linkedin_post_url=post.linkedin_post_url,
        linkedin_post_id=post.linkedin_post_id,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        sci_fi_item=_sci_fi_item_to_response(post.sci_fi_item),
        research_items=research_items,
    )


@router.get("", response_model=list[PostResponse])
def list_posts(
    status: str | None = Query(None, description="Filter by status (draft, published)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[PostResponse]:
    """List all posts with optional status filtering."""
    query = (
        db.query(Post)
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))
    )
    if status:
        query = query.filter(Post.status == status)
    query = query.order_by(Post.updated_at.desc())
    posts = query.offset(skip).limit(limit).all()
    return [_post_to_response(p) for p in posts]


@router.get("/{post_id}", response_model=PostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
) -> PostResponse:
    """Get a single post by ID with related data."""
    post = (
        db.query(Post)
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))
        .filter(Post.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_to_response(post)


@router.post("", response_model=PostResponse, status_code=201)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
) -> PostResponse:
    """Create a new post draft."""
    if payload.sci_fi_item_id is not None:
        sci_fi_item = (
            db.query(SciFiItem)
            .filter(SciFiItem.id == payload.sci_fi_item_id)
            .first()
        )
        if not sci_fi_item:
            raise HTTPException(status_code=404, detail="Sci-fi item not found")

    post = Post(
        sci_fi_item_id=payload.sci_fi_item_id,
        title=payload.title,
        content=payload.content,
        tone=payload.tone,
        status="draft",
        draft_number=1,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Re-query with eager loading
    post = (
        db.query(Post)
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))
        .filter(Post.id == post.id)
        .first()
    )
    return _post_to_response(post)


@router.put("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
) -> PostResponse:
    """Update an existing post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(post, field, value)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    # Re-query with eager loading
    post = (
        db.query(Post)
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))
        .filter(Post.id == post.id)
        .first()
    )
    return _post_to_response(post)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
):
    """Delete a post and its associated research items (cascaded)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return Response(status_code=204)
