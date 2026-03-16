# Image Carousel Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Overview

Replace the current single-image-per-post system (static files + `Post.image_url`) with a multi-image system that stores image bytes in the database, shows a horizontal scroll carousel in the Authoring page, and lets the user pick one image as "selected" for publishing.

## Requirements

- Images stored as binary blobs in the database — no static files on disk
- Each post can have unlimited generated images (user deletes manually)
- Horizontal scroll carousel (arrows + dot indicators) in `AuthoringPage`
- User can select one image per post for publishing (saved to DB)
- User can delete any image from the carousel
- Selected image is downloadable via the existing download endpoint
- Image `src` served via a dedicated streaming endpoint, not static file URLs

---

## Data Model

### New table: `post_images`

| Column | Type | Constraints |
|---|---|---|
| `id` | Integer | Primary key |
| `post_id` | Integer | FK → `posts.id`, not null |
| `image_data` | LargeBinary | Raw PNG bytes, not null |
| `prompt` | Text | Prompt used to generate the image |
| `is_selected` | Boolean | Default `False`; at most one `True` per post |
| `created_at` | DateTime | Default `utcnow` |

### New model: `PostImage` (`backend/app/models/post_image.py`)

```python
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, Text
from sqlalchemy.orm import relationship
from app.database import Base

class PostImage(Base):
    __tablename__ = "post_images"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    image_data = Column(LargeBinary, nullable=False)
    prompt = Column(Text)
    is_selected = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="images")
```

### `models/__init__.py` — must add import

Add `from .post_image import PostImage` to `backend/app/models/__init__.py`. Without this, `Base.metadata.create_all()` never sees the new table and `post_images` is never created.

### Changes to `Post` model (`backend/app/models/post.py`)

**Important: add the `images` relationship before modifying `_post_to_response()` in `posts.py`** — the function accesses `post.images`, which requires the relationship to exist on the model first.

- `image_url` column: stop writing to it; do **not** drop (SQLite pre-3.35 cannot DROP COLUMN). The column stays in the DB and ORM model; it is simply excluded from `PostResponse`.
- Add `images` relationship using the **string form** for `order_by` to avoid circular import issues:
  ```python
  images = relationship(
      "PostImage",
      back_populates="post",
      cascade="all, delete-orphan",
      order_by="PostImage.created_at",  # ascending, oldest first
  )
  ```
- Deleting a `Post` via the ORM cascade-deletes all its `PostImage` rows automatically. Note: SQLite has FK enforcement off by default, so this cascade works only when using ORM-level deletion (which `delete_post` in `posts.py` does).

### New schema: `PostImageResponse` (`backend/app/schemas/post_image.py`)

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class PostImageResponse(BaseModel):
    id: int
    post_id: int
    prompt: str | None
    is_selected: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

`backend/app/schemas/__init__.py` is currently empty — no changes needed there. Import `PostImageResponse` directly by module path: `from app.schemas.post_image import PostImageResponse`.

### Changes to `PostResponse` (`backend/app/schemas/post.py`)

- **Remove** `image_url: str | None` field (column stays in DB but is excluded from API responses — a breaking API change; both frontend consumers are updated below)
- **Add** `images: list[PostImageResponse] = []`
- Import `PostImageResponse` from `app.schemas.post_image`
- Image bytes are not included in responses — served on demand via `GET /api/image/{id}`

### `_post_to_response()` in `posts.py`

- Remove the `image_url=post.image_url` line
- Add `images=[PostImageResponse.model_validate(img) for img in post.images]`
- Add `joinedload(Post.images)` to **every** SQLAlchemy query that calls `_post_to_response`:
  - `get_post` — single-post fetch
  - `list_posts` — list endpoint (already joins `sci_fi_item` and `research_items`)
  - `create_post` — re-query after insert
  - `update_post` — re-query after update

---

## Backend API

### Route registration order in `image.py`

FastAPI resolves GET routes top-to-bottom. `GET /download/{post_id}` (fixed segment `download`) must be registered before `GET /{image_id}`:

```
POST  /suggest-prompt        ← POST, no conflict
POST  /generate              ← POST, no conflict
GET   /download/{post_id}    ← MUST come before /{image_id}
GET   /{image_id}            ← would shadow "download" if registered first
PUT   /{image_id}/select     ← different method, ordering irrelevant
DELETE /{image_id}           ← different method, ordering irrelevant
```

### Endpoint specifications

#### `POST /api/image/suggest-prompt` — unchanged
- Decorator: `@router.post("/suggest-prompt", response_model=SuggestPromptResponse)`
- `post_id` is a **query parameter**: `POST /api/image/suggest-prompt?post_id=<id>`
- Handler signature: `async def suggest_post_image_prompt(post_id: int, db: Session = Depends(get_db))`
- Errors: 400 if post has no linked sci-fi item; 502 if Claude fails

#### `POST /api/image/generate`
- Decorator: `@router.post("/generate", response_model=PostImageResponse, status_code=201)`
- Request body: `{post_id: int, prompt: str}`
- Calls `fal_service.generate_image(prompt)` (async, returns raw PNG bytes)
- Creates a `PostImage` row; `is_selected=False`
- Returns: `201 Created` with `PostImageResponse`
- Errors: 404 if `post_id` not found; 502 if fal.ai fails
- Note: fal.ai/flux/schnell currently returns PNG; bytes are stored and served as `image/png` without content-type verification. This is a known simplification — add mime-type detection if model behaviour changes.

#### `GET /api/image/download/{post_id}`
- Find the `PostImage` for this post where `is_selected=True`
- Stream bytes as `image/png` with `Content-Disposition: attachment; filename="post-image.png"`
- Error: `404` if no selected image exists for the post

#### `GET /api/image/{image_id}`
- Look up `PostImage` by id — `HTTPException(status_code=404, detail="Image not found")` if not found
- Return: `Response(content=image.image_data, media_type="image/png")` — use FastAPI's `Response` class with the raw bytes from `LargeBinary`. Do **not** use `FileResponse` (requires a file path) or return bytes directly (FastAPI would JSON-serialize them as base64, breaking `<img src>` tags).
- Note: fal.ai/flux/schnell currently returns PNG; bytes are stored and served as `image/png` without content-type verification. Known simplification.

#### `PUT /api/image/{image_id}/select`
- Decorator: `@router.put("/{image_id}/select", response_model=PostImageResponse)`
- Within a **single DB transaction**:
  1. Look up `PostImage` by `image_id` — 404 if not found
  2. Deselect all siblings with a bulk update: `db.query(PostImage).filter(PostImage.post_id == image.post_id, PostImage.id != image_id).update({"is_selected": False}, synchronize_session="fetch")`
  3. Set `is_selected=True` on this image
  4. Commit
- Returns: `200 OK` with `PostImageResponse`

#### `DELETE /api/image/{image_id}`
- Decorator: `@router.delete("/{image_id}")` — **no `status_code` on the decorator**
- Look up `PostImage` — 404 if not found
- Delete and commit
- Returns: `return Response(status_code=204)` — **must use this pattern** (FastAPI 0.115.0 assertion error if `status_code=204` is on the decorator instead)

### `main.py` changes

- **Atomically remove both of these lines in the same commit** (removing `makedirs` before the mount causes a startup crash because `StaticFiles` requires the directory to exist):
  - `os.makedirs("static/images", exist_ok=True)`
  - `app.mount("/static", StaticFiles(directory="static"), name="static")`
- Leave the `app.mount("/assets", ...)` frontend dist mount untouched
- Remove the `ALTER TABLE posts ADD COLUMN image_url TEXT` migration block from `lifespan`
- `Base.metadata.create_all(bind=engine)` in `lifespan` will automatically create `post_images` once `PostImage` is imported in `models/__init__.py`

---

## Frontend

### `api.js` changes

- `generateImage(data)` — response shape changes to `PostImageResponse`: `{id, post_id, prompt, is_selected, created_at}`
- Add `selectImage(imageId)` → `PUT /api/image/${imageId}/select` → returns updated `PostImageResponse`
- Add `deleteImage(imageId)` → `DELETE /api/image/${imageId}` → returns 204
- Images displayed as `<img src={"/api/image/" + id} />` — derive the URL from `id`, no separate URL field
- `getPost` response already includes `images: PostImageResponse[]` via updated `PostResponse`

### `AuthoringPage.jsx` — state cleanup

**Remove these state variables and all related code:**
- `imageUrl` / `setImageUrl`
- `imagePromptInitialized` / `setImagePromptInitialized` — and the two inline `if` blocks (~lines 152–162) that call `setImagePromptInitialized`

**Replace prompt initialisation with a `useEffect`:**
```js
useEffect(() => {
  if (sciFiItem) {
    const themeStr = themes.length > 0 ? themes.join(', ') : 'science fiction';
    setImagePrompt(`${sciFiItem.title} — ${themeStr} — cinematic sci-fi style, dramatic lighting, photorealistic`);
  } else {
    // No sci-fi item linked: leave prompt at its default value (empty or previous value)
    // Do not set a generic fallback — let the user type their own prompt
  }
}, [sciFiItem?.id]);
```

**Remove from `lucide-react` imports:** `Download` (replaced by a plain `<a>` tag)

**Add state:** `focusedIndex` (integer, default `0`)

**Update `imageMutation.onSuccess`:**
- Remove `setImageUrl(data.image_url)`
- Add `queryClient.invalidateQueries({ queryKey: ['post', postId] })`
- Handle focus index via a single `useEffect` that clamps on both generate and delete:
  ```js
  useEffect(() => {
    const len = post?.images?.length ?? 0;
    setFocusedIndex(prev => (len === 0 ? 0 : Math.min(prev, len - 1)));
  }, [post?.images?.length]);
  ```
  This keeps focus at the current position if the image still exists (delete of a non-last item), and clamps to the last item if the focused image was deleted. After a new image is generated the user can navigate to it — no auto-jump to the last image.

**Update `deleteImage` mutation `onSuccess`:**
- Invalidate `['post', postId]` only
- Let the `useEffect` handle focus clamping (do not call `setFocusedIndex` here)

**Add pending state handling:**
- `selectMutation.isPending` → disable "Use this image" button while pending
- `deleteMutation.isPending` → disable "Delete" button while pending; show spinner

### `AuthoringPage.jsx` — Image panel carousel

Replace the current single-image display block with:

**Structure:**
```
[Image Generation Prompt section — unchanged]
[Generate Image button — unchanged]

[Carousel — only shown when post.images.length > 0]
  ← [focused image: <img src={"/api/image/" + images[focusedIndex].id} />] →
  [dot indicators]
  [action bar: "✓ Selected" badge OR "Use this image" button (disabled while pending) | "Delete" button (disabled while pending)]

[Empty state — shown when post.images.length === 0]
  "No images generated yet"

[Download link — only shown when post.images.some(img => img.is_selected)]
  <a href={`/api/image/download/${postId}`} download="post-image.png">Download selected image</a>
```

**Carousel behaviour:**
- Prev/next arrows: decrement/increment `focusedIndex`, clamped to `[0, images.length - 1]`
- Dot indicators: one dot per image; clicking a dot sets `focusedIndex`
- Selected image card gets `ring-2 ring-cyan-400` styling
- `useEffect` on `post?.images?.length` handles clamping

**"Use this image" / Selected badge:**
- If `images[focusedIndex].is_selected`: show cyan `✓ Selected` badge
- Otherwise: "Use this image" button (disabled while `selectMutation.isPending`) → `selectImage(id)` → invalidate `['post', postId]`

**Delete button:**
- Disabled while `deleteMutation.isPending`; show spinner
- On click: `deleteImage(id)` → invalidate `['post', postId]`

**Download link:**
- `<a href={"/api/image/download/" + postId} download="post-image.png">Download selected image</a>`
- Only render when `post.images.some(img => img.is_selected)`

### `PublishingPage.jsx` — update image section (line 87)

Currently reads `post?.image_url`. Replace the entire image section:

```jsx
const selectedImg = post?.images?.find(img => img.is_selected);

// Replace: {post?.image_url ? (...) : (...)}
// With:
{selectedImg ? (
  <div className="flex items-center gap-5">
    <img
      src={"/api/image/" + selectedImg.id}
      alt="Post image"
      className="w-32 h-auto rounded-lg border border-slate-700 object-cover"
    />
    <div>
      <p className="text-slate-400 text-sm mb-3">Generated in Authoring step</p>
      <a
        href={`/api/image/download/${postId}`}
        download="post-image.png"
        className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        Download Image
      </a>
    </div>
  </div>
) : (
  <div className="flex items-center gap-3 text-slate-500">
    <ImageOff className="w-5 h-5 flex-shrink-0" />
    <p className="text-sm">
      No image selected.{' '}
      <button onClick={() => navigate(`/author/${postId}`)} className="text-cyan-400 hover:underline">
        Go back to Authoring
      </button>{' '}
      to generate and select one.
    </p>
  </div>
)}
```

---

## Migration Notes

- `Post.image_url` column stays in the SQLite file but is no longer read or written
- `PostResponse` no longer exposes `image_url` — breaking API change; both frontend consumers (`AuthoringPage.jsx`, `PublishingPage.jsx`) are updated by this spec
- Existing posts will show an empty carousel — no data migration needed
- Old static files in `static/images/` can be deleted manually; they are no longer referenced
- SQLite FK enforcement is off by default; cascade-delete of `PostImage` relies on ORM-level deletion (which the existing `delete_post` endpoint uses)

## Out of Scope

- Image editing or cropping
- Uploading external images
- Limit on number of images per post (user manages manually)
- LinkedIn API image attachment (user downloads and attaches manually)
