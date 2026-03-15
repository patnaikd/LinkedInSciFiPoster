from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import AppSetting

router = APIRouter()

# Keys whose values should be masked when returned in responses.
_SENSITIVE_KEYS: set[str] = {
    "linkedin_access_token",
    "anthropic_api_key",
    "tmdb_api_key",
    "news_api_key",
    "linkedin_client_secret",
}


# ---- Request / Response schemas local to this router ----------------------

class SettingPayload(BaseModel):
    key: str
    value: str


class SettingResponse(BaseModel):
    id: int
    key: str
    value: str
    updated_at: datetime | None = None


# ---- Helpers ---------------------------------------------------------------

def _mask_value(key: str, value: str | None) -> str:
    """Return a masked representation of sensitive setting values.

    Sensitive values are hidden except for the last 4 characters.  Short
    values (4 chars or fewer) are replaced entirely with asterisks.
    Non-sensitive values are returned unchanged.
    """
    if value is None:
        return ""
    if key.lower() not in _SENSITIVE_KEYS:
        return value
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * (len(value) - 4) + value[-4:]


def _setting_to_response(setting: AppSetting) -> SettingResponse:
    return SettingResponse(
        id=setting.id,
        key=setting.key,
        value=_mask_value(setting.key, setting.value),
        updated_at=setting.updated_at,
    )


# ---- Endpoints ------------------------------------------------------------

@router.get("", response_model=list[SettingResponse])
def list_settings(
    db: Session = Depends(get_db),
) -> list[SettingResponse]:
    """Return all application settings with sensitive values masked."""
    settings = db.query(AppSetting).order_by(AppSetting.key).all()
    return [_setting_to_response(s) for s in settings]


@router.get("/{key}", response_model=SettingResponse)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
) -> SettingResponse:
    """Return a single setting by key with its value masked if sensitive."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return _setting_to_response(setting)


@router.put("", response_model=SettingResponse)
def upsert_setting(
    payload: SettingPayload,
    db: Session = Depends(get_db),
) -> SettingResponse:
    """Create or update an application setting."""
    setting = db.query(AppSetting).filter(AppSetting.key == payload.key).first()
    if setting:
        setting.value = payload.value
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSetting(key=payload.key, value=payload.value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return _setting_to_response(setting)


@router.delete("/{key}")
def delete_setting(
    key: str,
    db: Session = Depends(get_db),
):
    """Delete an application setting by key."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    db.delete(setting)
    db.commit()
    return Response(status_code=204)
