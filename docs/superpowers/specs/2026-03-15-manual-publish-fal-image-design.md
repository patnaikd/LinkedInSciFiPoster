# Design: Manual LinkedIn Publishing + fal.ai Image Generation

**Date:** 2026-03-15
**Status:** Approved

## Overview

Replace the automated LinkedIn OAuth publishing flow with a manual copy-paste workflow. Add AI image generation (via fal.ai) to the Authoring page so users can generate, preview, and download a post image, then manually upload it to LinkedIn themselves.

## Goals

- Remove all LinkedIn OAuth and auto-publish functionality
- Add fal.ai image generation to the Authoring page (below text editor)
- Make the Publishing page a step-by-step manual guide (copy text, download image, open LinkedIn)
- Keep Ideation, Research, and History pages unchanged

## Architecture

### Backend changes

**Remove:** `backend/app/routers/linkedin.py`
**Remove:** `backend/app/services/linkedin_service.py`
**Remove:** LinkedIn router registration from `backend/app/main.py`
**Remove:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` from `backend/.env.example` and from `backend/app/config.py` (Settings class). Add `FAL_KEY: str = ""` to `config.py`.

**Add:** `backend/app/routers/image.py` — new router with two endpoints:
- `POST /api/image/generate` — accepts `{ post_id, prompt }`. Calls fal.ai with the user-supplied prompt (verbatim — no server-side prompt construction). Downloads the returned image bytes, saves to `backend/static/images/<post_id>.png`, updates `post.image_url = "/static/images/<post_id>.png"` in the database. Returns `{ image_url: "/static/images/<post_id>.png" }`. If the post has no linked sci-fi item, accept the request and use the user-supplied prompt as-is. Returns HTTP 502 on fal.ai failure.
- `GET /api/image/download/{post_id}` — reads `backend/static/images/<post_id>.png` and returns it as a `FileResponse` with `Content-Disposition: attachment; filename="post-image.png"`, forcing a browser download.

**Add:** `backend/app/services/fal_service.py` — wraps the fal.ai Python client. Calls `fal-ai/flux/schnell`, receives the temporary CDN URL from fal.ai, downloads the image bytes via HTTP, returns the raw bytes to the router for local storage. This avoids depending on ephemeral fal.ai CDN URLs.

**Add:** `FAL_KEY` to `backend/.env.example`

**Static file serving:** In `main.py`, create `backend/static/images/` directory on startup using `os.makedirs("static/images", exist_ok=True)` (runs in the lifespan startup hook). Then mount `StaticFiles(directory="static")` at `/static`.

**Post model changes:**
- Add `image_url = Column(String, nullable=True)` to `backend/app/models/post.py`
- Add `image_url: str | None = None` to `PostResponse` in `backend/app/schemas/post.py`
- Update `_post_to_response` helper in `backend/app/routers/posts.py`: remove `linkedin_post_id=post.linkedin_post_id` and `linkedin_post_url=post.linkedin_post_url` kwargs, add `image_url=post.image_url`. All three must happen together — partial changes cause Pydantic validation errors at runtime.
- **Remove** `linkedin_post_id` and `linkedin_post_url` from the Post model and PostResponse schema (dead LinkedIn fields)
- **Database migration:** `create_all()` does not alter existing tables. Add a startup migration step in the lifespan hook that runs: `ALTER TABLE posts ADD COLUMN image_url TEXT` wrapped in a `try/except` (ignores the error if the column already exists). Also drop `linkedin_post_id` and `linkedin_post_url` — since SQLite does not support `DROP COLUMN` before version 3.35, leave those columns in the database but remove them from the SQLAlchemy model and schema (they become ignored phantom columns). Document this clearly in the lifespan hook code.

**Add:** `FAL_KEY` to `backend/.env.example`

### Frontend changes

**AuthoringPage.jsx** — add Image Generation section below the text editor textarea:
- Image prompt textarea, pre-filled on mount with: `"[title] — [themes joined by comma] — cinematic sci-fi style, dramatic lighting, photorealistic"`. If post has no sci-fi item, pre-fill with a generic prompt. Editable by the user.
- "Generate Image" button → calls `POST /api/image/generate` with `{ post_id, prompt }`.
- Inline loading state while generating (~10–20s).
- Image preview thumbnail after generation (uses `/static/images/<post_id>.png`).
- "Download Image" button — plain `<a href="/api/image/download/<post_id>" download>` anchor tag. No axios call needed; the backend sets `Content-Disposition: attachment` to force the download.
- Image generation is **optional** — "Continue to Publish" does not require an image.
- `handleContinue` saves `{ content, tone }` as before. The image URL is already persisted by the generate endpoint — no extra save needed on continue.

**PublishingPage.jsx** — replace LinkedIn OAuth UI entirely. Fetch post via existing `getPost` query (already present). Post now includes `image_url` from the updated schema. Show a 3-step manual guide:
1. **Copy post text** — full post content in a readonly box + "Copy Post Text" button (`navigator.clipboard.writeText`), shows "Copied!" for 2 seconds after click.
2. **Download image** — thumbnail (`<img src={post.image_url}>`) + "Download Image" anchor (`<a href="/api/image/download/<postId>" download>`). If `post.image_url` is null/empty, show "Go back to Authoring to generate an image" and hide the download button.
3. **Post on LinkedIn** — numbered instructions + "Open LinkedIn" button (`window.open("https://www.linkedin.com", "_blank")`).

Remove from PublishingPage: all imports/calls to `getLinkedInStatus`, `publishToLinkedIn`, `getLinkedInAuthUrl`, `disconnectLinkedIn`, and the `publishMutation` useMutation block.

**SettingsPage.jsx:**
- Remove imports and calls to `getLinkedInStatus` and `disconnectLinkedIn`
- Remove the `disconnectMutation` useMutation block
- Remove LinkedIn connection status and disconnect UI from the rendered JSX
- In the API Configuration key list, replace the `LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET` row with a `FAL_KEY` row

**api.js:**
- Remove: `getLinkedInAuthUrl`, `getLinkedInStatus`, `publishToLinkedIn`, `disconnectLinkedIn`
- Add: `generateImage(data)` → `client.post('/image/generate', data).then(r => r.data)`

### Data flow

1. User authors post text in AuthoringPage (unchanged).
2. User optionally edits the auto-filled image prompt and clicks "Generate Image".
3. Frontend calls `POST /api/image/generate` with `{ post_id, prompt }`.
4. Backend calls fal.ai, downloads the returned image, saves to `backend/static/images/<post_id>.png`, updates `post.image_url`, returns `{ image_url: "/static/images/<post_id>.png" }`.
5. Frontend shows image preview and "Download Image" anchor.
6. User clicks "Continue to Publish" (image optional). Navigates to `/publish/<postId>`.
7. PublishingPage fetches post (including `image_url`), shows 3-step manual guide.

### fal.ai model

Use `fal-ai/flux/schnell`. Auth via `FAL_KEY` env var, handled automatically by the fal Python client.

## Error handling

- If fal.ai call fails: backend returns HTTP 502, frontend shows error toast, keeps prompt editable for retry.
- If `post.image_url` is null on PublishingPage: hide download button, show "Go back to Authoring to generate an image."
- Copy button: `navigator.clipboard.writeText`, show "Copied!" for 2 seconds.

## What is NOT changing

- Ideation, Research, History pages — untouched.
- Claude AI post generation — untouched.
- No new authentication added.
