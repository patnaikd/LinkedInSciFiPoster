from __future__ import annotations

import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.post import Post
from app.models.settings import AppSetting
from app.services.linkedin_service import (
    exchange_code_for_token,
    get_authorization_url,
    get_user_profile,
    publish_post,
)

router = APIRouter()

# ---- Setting key constants ------------------------------------------------

_ACCESS_TOKEN_KEY = "linkedin_access_token"
_PERSON_URN_KEY = "linkedin_person_urn"
_OAUTH_STATE_KEY = "linkedin_oauth_state"


# ---- Helper functions for settings CRUD -----------------------------------

def _get_setting(db: Session, key: str) -> str | None:
    """Retrieve a setting value from the database by key."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    return setting.value if setting else None


def _set_setting(db: Session, key: str, value: str) -> None:
    """Create or update a setting in the database."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if setting:
        setting.value = value
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSetting(key=key, value=value)
        db.add(setting)
    db.commit()


def _delete_setting(db: Session, key: str) -> None:
    """Delete a setting from the database if it exists."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if setting:
        db.delete(setting)
        db.commit()


# ---- Response schemas local to this router --------------------------------

class LinkedInStatusResponse(BaseModel):
    connected: bool
    person_urn: str | None = None


class PublishRequest(BaseModel):
    post_id: int


class PublishResponse(BaseModel):
    linkedin_post_id: str
    linkedin_post_url: str


# ---- Endpoints ------------------------------------------------------------

@router.get("/status", response_model=LinkedInStatusResponse)
def linkedin_status(
    db: Session = Depends(get_db),
) -> LinkedInStatusResponse:
    """Check whether a LinkedIn account is currently connected."""
    access_token = _get_setting(db, _ACCESS_TOKEN_KEY)
    person_urn = _get_setting(db, _PERSON_URN_KEY)
    return LinkedInStatusResponse(
        connected=access_token is not None,
        person_urn=person_urn,
    )


@router.get("/authorize")
def authorize(
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Begin the LinkedIn OAuth2 authorization flow.

    Generates a random state parameter, stores it in settings, and redirects
    the user to LinkedIn's authorization page.
    """
    state = secrets.token_urlsafe(32)
    _set_setting(db, _OAUTH_STATE_KEY, state)
    authorization_url = get_authorization_url(state=state)
    return RedirectResponse(url=authorization_url)


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    """Handle the OAuth2 callback from LinkedIn.

    Validates the state parameter, exchanges the authorization code for an
    access token, fetches the user profile, and stores credentials.
    """
    saved_state = _get_setting(db, _OAUTH_STATE_KEY)
    if saved_state is None or state != saved_state:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    # Clean up the one-time state value
    _delete_setting(db, _OAUTH_STATE_KEY)

    try:
        token_data = await exchange_code_for_token(code=code)
        access_token = token_data["access_token"]
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to exchange code for token: {e}"
        )

    try:
        profile = await get_user_profile(access_token=access_token)
        person_urn = profile.get("sub") or profile.get("id")
        if not person_urn:
            raise ValueError("Could not determine person URN from profile response")
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch LinkedIn profile: {e}"
        )

    _set_setting(db, _ACCESS_TOKEN_KEY, access_token)
    _set_setting(db, _PERSON_URN_KEY, person_urn)

    return {"message": "LinkedIn account connected successfully", "person_urn": person_urn}


@router.post("/publish", response_model=PublishResponse)
async def publish_to_linkedin(
    payload: PublishRequest,
    db: Session = Depends(get_db),
) -> PublishResponse:
    """Publish a post to LinkedIn.

    Reads the stored access token and person URN, then publishes the post
    content via the LinkedIn API. Updates the post record with the result.
    """
    access_token = _get_setting(db, _ACCESS_TOKEN_KEY)
    if not access_token:
        raise HTTPException(status_code=401, detail="LinkedIn account not connected")

    person_urn = _get_setting(db, _PERSON_URN_KEY)
    if not person_urn:
        raise HTTPException(status_code=401, detail="LinkedIn person URN not found")

    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not post.content:
        raise HTTPException(status_code=400, detail="Post has no content to publish")

    try:
        result = await publish_post(
            access_token=access_token,
            person_urn=person_urn,
            content=post.content,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"LinkedIn publishing failed: {e}"
        )

    linkedin_post_id = result.get("post_id", "")
    linkedin_post_url = result.get("post_url", f"https://www.linkedin.com/feed/update/{linkedin_post_id}")

    post.linkedin_post_id = linkedin_post_id
    post.linkedin_post_url = linkedin_post_url
    post.status = "published"
    post.published_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    return PublishResponse(
        linkedin_post_id=linkedin_post_id,
        linkedin_post_url=linkedin_post_url,
    )


@router.delete("/disconnect")
def disconnect_linkedin(
    db: Session = Depends(get_db),
) -> dict:
    """Remove stored LinkedIn credentials."""
    _delete_setting(db, _ACCESS_TOKEN_KEY)
    _delete_setting(db, _PERSON_URN_KEY)
    return {"message": "LinkedIn account disconnected"}
