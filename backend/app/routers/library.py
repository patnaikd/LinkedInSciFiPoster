from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sci_fi_item import SciFiItem
from app.schemas.library import SciFiItemCreate, SciFiItemResponse

router = APIRouter()


def _serialize_themes(themes: list[str] | None) -> str | None:
    """Convert a themes list to a JSON string for database storage."""
    if themes is None:
        return None
    return json.dumps(themes)


def _parse_themes(themes_str: str | None) -> list[str] | None:
    """Parse a JSON-encoded themes string back to a list."""
    if themes_str is None:
        return None
    try:
        return json.loads(themes_str)
    except (json.JSONDecodeError, TypeError):
        return None


def _serialize_metadata(metadata: dict | None) -> str | None:
    """Convert a metadata dict to a JSON string for database storage."""
    if metadata is None:
        return None
    return json.dumps(metadata)


def _item_to_response(item: SciFiItem) -> SciFiItemResponse:
    """Convert a SciFiItem ORM instance to a response schema with parsed themes."""
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


@router.get("", response_model=list[SciFiItemResponse])
def list_library(
    item_type: str | None = Query(None, description="Filter by 'book' or 'movie'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[SciFiItemResponse]:
    """List all sci-fi items in the library with optional type filtering."""
    query = db.query(SciFiItem)
    if item_type:
        query = query.filter(SciFiItem.item_type == item_type)
    query = query.order_by(SciFiItem.created_at.desc())
    items = query.offset(skip).limit(limit).all()
    return [_item_to_response(item) for item in items]


@router.get("/{item_id}", response_model=SciFiItemResponse)
def get_library_item(
    item_id: int,
    db: Session = Depends(get_db),
) -> SciFiItemResponse:
    """Get a single sci-fi item by ID."""
    item = db.query(SciFiItem).filter(SciFiItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sci-fi item not found")
    return _item_to_response(item)


@router.post("", response_model=SciFiItemResponse, status_code=201)
def create_library_item(
    payload: SciFiItemCreate,
    db: Session = Depends(get_db),
) -> SciFiItemResponse:
    """Add a new sci-fi item to the library."""
    item = SciFiItem(
        item_type=payload.item_type,
        title=payload.title,
        author_or_director=payload.author_or_director,
        year=payload.year,
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        external_id=payload.external_id,
        themes=_serialize_themes(payload.themes),
        metadata_json=_serialize_metadata(payload.metadata_json),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_response(item)


@router.put("/{item_id}", response_model=SciFiItemResponse)
def update_library_item(
    item_id: int,
    payload: SciFiItemCreate,
    db: Session = Depends(get_db),
) -> SciFiItemResponse:
    """Update an existing sci-fi item."""
    item = db.query(SciFiItem).filter(SciFiItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sci-fi item not found")

    item.item_type = payload.item_type
    item.title = payload.title
    item.author_or_director = payload.author_or_director
    item.year = payload.year
    item.description = payload.description
    item.cover_image_url = payload.cover_image_url
    item.external_id = payload.external_id
    item.themes = _serialize_themes(payload.themes)
    item.metadata_json = _serialize_metadata(payload.metadata_json)

    db.commit()
    db.refresh(item)
    return _item_to_response(item)


@router.delete("/{item_id}")
def delete_library_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Delete a sci-fi item from the library."""
    item = db.query(SciFiItem).filter(SciFiItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sci-fi item not found")
    db.delete(item)
    db.commit()
    return Response(status_code=204)
