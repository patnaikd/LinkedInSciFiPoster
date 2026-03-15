from __future__ import annotations

from urllib.parse import urlencode

import httpx

from app.config import settings

AUTHORIZATION_BASE_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
POSTS_URL = "https://api.linkedin.com/rest/posts"

OAUTH_SCOPE = "openid email profile w_member_social"


def get_authorization_url(state: str) -> str:
    """Build the LinkedIn OAuth 2.0 authorization URL.

    Args:
        state: An opaque CSRF-protection string.

    Returns:
        The full authorization URL to redirect the user to.
    """
    params = {
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": OAUTH_SCOPE,
    }
    return f"{AUTHORIZATION_BASE_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> dict:
    """Exchange an authorization code for an access token.

    Args:
        code: The authorization code returned by LinkedIn.

    Returns:
        A dict with keys: access_token, expires_in.

    Raises:
        RuntimeError: If the token exchange request fails.
    """
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "client_secret": settings.LINKEDIN_CLIENT_SECRET,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "LinkedIn token exchange request timed out"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"LinkedIn token exchange failed with HTTP {exc.response.status_code}: "
            f"{exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"LinkedIn token exchange request failed: {exc}"
        ) from exc

    data = response.json()
    return {
        "access_token": data["access_token"],
        "expires_in": data["expires_in"],
    }


async def get_user_profile(access_token: str) -> dict:
    """Fetch the authenticated user's LinkedIn profile via OpenID userinfo.

    Args:
        access_token: A valid LinkedIn OAuth access token.

    Returns:
        A dict with keys: sub, name, email, picture.

    Raises:
        RuntimeError: If the profile request fails.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(USERINFO_URL, headers=headers)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "LinkedIn user profile request timed out"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"LinkedIn user profile request failed with HTTP {exc.response.status_code}: "
            f"{exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"LinkedIn user profile request failed: {exc}"
        ) from exc

    data = response.json()
    return {
        "sub": data.get("sub"),
        "name": data.get("name"),
        "email": data.get("email"),
        "picture": data.get("picture"),
    }


async def publish_post(access_token: str, person_urn: str, content: str) -> dict:
    """Publish a text post to LinkedIn on behalf of the authenticated user.

    Args:
        access_token: A valid LinkedIn OAuth access token with w_member_social scope.
        person_urn: The LinkedIn person URN identifier (without the full URN prefix).
        content: The text content of the post.

    Returns:
        A dict with keys: post_id, post_url.

    Raises:
        RuntimeError: If the publish request fails.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "LinkedIn-Version": "202501",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    body = {
        "author": f"urn:li:person:{person_urn}",
        "commentary": content,
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(POSTS_URL, headers=headers, json=body)
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "LinkedIn publish post request timed out"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"LinkedIn publish post failed with HTTP {exc.response.status_code}: "
            f"{exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"LinkedIn publish post request failed: {exc}"
        ) from exc

    post_id = response.headers.get("x-restli-id", "")
    return {
        "post_id": post_id,
        "post_url": f"https://www.linkedin.com/feed/update/{post_id}",
    }
