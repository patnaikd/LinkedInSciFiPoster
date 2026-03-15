from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.post import Post
from app.models.research_item import ResearchItem
from app.schemas.research import ResearchItemCreate, ResearchItemResponse

router = APIRouter()


@router.get("", response_model=list[ResearchItemResponse])
def list_research_items(
    post_id: int | None = Query(None, description="Filter by post ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ResearchItemResponse]:
    """List research items, optionally filtered by post."""
    query = db.query(ResearchItem)
    if post_id is not None:
        query = query.filter(ResearchItem.post_id == post_id)
    query = query.order_by(ResearchItem.created_at.desc())
    items = query.offset(skip).limit(limit).all()
    return [ResearchItemResponse.model_validate(ri) for ri in items]


@router.get("/{item_id}", response_model=ResearchItemResponse)
def get_research_item(
    item_id: int,
    db: Session = Depends(get_db),
) -> ResearchItemResponse:
    """Get a single research item by ID."""
    item = db.query(ResearchItem).filter(ResearchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Research item not found")
    return ResearchItemResponse.model_validate(item)


@router.post("", response_model=ResearchItemResponse, status_code=201)
def create_research_item(
    payload: ResearchItemCreate,
    db: Session = Depends(get_db),
) -> ResearchItemResponse:
    """Create a new research item linked to a post."""
    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    item = ResearchItem(
        post_id=payload.post_id,
        source_type=payload.source_type,
        title=payload.title,
        url=payload.url,
        snippet=payload.snippet,
        source_name=payload.source_name,
        published_at=payload.published_at,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ResearchItemResponse.model_validate(item)


@router.put("/{item_id}", response_model=ResearchItemResponse)
def update_research_item(
    item_id: int,
    payload: ResearchItemCreate,
    db: Session = Depends(get_db),
) -> ResearchItemResponse:
    """Update an existing research item."""
    item = db.query(ResearchItem).filter(ResearchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Research item not found")

    # Verify the target post exists
    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    item.post_id = payload.post_id
    item.source_type = payload.source_type
    item.title = payload.title
    item.url = payload.url
    item.snippet = payload.snippet
    item.source_name = payload.source_name
    item.published_at = payload.published_at

    db.commit()
    db.refresh(item)
    return ResearchItemResponse.model_validate(item)


@router.delete("/{item_id}")
def delete_research_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Delete a research item."""
    item = db.query(ResearchItem).filter(ResearchItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Research item not found")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
