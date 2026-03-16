# Image Carousel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single static-file image system with a DB-stored multi-image carousel — each post can have many generated images, the user picks one as selected for publishing, and can delete any from the carousel.

**Architecture:** A new `PostImage` SQLAlchemy model stores raw PNG bytes in SQLite. The `image.py` router is rewritten with new endpoints to serve, select, and delete images. `AuthoringPage.jsx` gets a horizontal scroll carousel with per-image select/delete actions, and `PublishingPage.jsx` is updated to read from the new `images` array.

**Tech Stack:** FastAPI 0.115.0, SQLAlchemy + SQLite, React + React Query + Tailwind v4, fal.ai image generation

---

## Chunk 1: Backend — PostImage model and schema

### Task 1: Create the PostImage model

**Files:**
- Create: `backend/app/models/post_image.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/post.py`

- [ ] **Step 1: Create `backend/app/models/post_image.py`**

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

- [ ] **Step 2: Add import to `backend/app/models/__init__.py`**

Replace the file contents with:
```python
from .post import Post
from .post_image import PostImage
from .research_item import ResearchItem
from .sci_fi_item import SciFiItem
from .settings import AppSetting

__all__ = ["SciFiItem", "Post", "PostImage", "ResearchItem", "AppSetting"]
```

- [ ] **Step 3: Add `images` relationship to `backend/app/models/post.py`**

In `post.py`, add the `images` relationship after the existing `research_items` relationship. The file currently ends at line 28 with:
```python
    research_items = relationship(
        "ResearchItem", back_populates="post", cascade="all, delete-orphan"
    )
```

Add below it:
```python
    images = relationship(
        "PostImage",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="PostImage.created_at",
    )
```

- [ ] **Step 4: Start the backend and verify the table is created**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Expected: server starts without error and logs show no `OperationalError`. Stop the server, then confirm the table exists in the SQLite DB:

```bash
sqlite3 app.db ".tables"
```

Expected output includes `post_images` in the list of tables. If it is missing, check that `PostImage` is imported in `models/__init__.py` — `create_all` only creates tables for imported models.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/post_image.py backend/app/models/__init__.py backend/app/models/post.py
git commit -m "feat: add PostImage model with post relationship"
```

---

### Task 2: Create the PostImageResponse schema and update PostResponse

**Files:**
- Create: `backend/app/schemas/post_image.py`
- Modify: `backend/app/schemas/post.py`
- Modify: `backend/app/routers/posts.py`

- [ ] **Step 1: Create `backend/app/schemas/post_image.py`**

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PostImageResponse(BaseModel):
    id: int
    post_id: int
    prompt: str | None = None
    is_selected: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 2: Update `backend/app/schemas/post.py`**

Replace file contents with:
```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.library import SciFiItemResponse
from app.schemas.post_image import PostImageResponse
from app.schemas.research import ResearchItemResponse


class PostCreate(BaseModel):
    sci_fi_item_id: int | None = None
    title: str | None = None
    content: str | None = None
    tone: str = "professional_witty"


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tone: str | None = None
    status: str | None = None


class PostResponse(BaseModel):
    id: int
    sci_fi_item_id: int | None = None
    title: str | None = None
    content: str | None = None
    tone: str
    status: str
    draft_number: int
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    sci_fi_item: SciFiItemResponse | None = None
    research_items: list[ResearchItemResponse] = []
    images: list[PostImageResponse] = []

    model_config = ConfigDict(from_attributes=True)
```

Note: `image_url` is intentionally removed from `PostResponse`.

- [ ] **Step 3: Update `_post_to_response()` in `backend/app/routers/posts.py`**

Update the imports at the top of `posts.py` to add `PostImageResponse`:
```python
from app.schemas.post import PostCreate, PostResponse, PostUpdate
from app.schemas.post_image import PostImageResponse
```

Replace the `_post_to_response` function body:
```python
def _post_to_response(post: Post) -> PostResponse:
    """Convert a Post ORM instance to a response with properly parsed nested data."""
    research_items = [
        ResearchItemResponse.model_validate(ri) for ri in post.research_items
    ]
    images = [PostImageResponse.model_validate(img) for img in post.images]
    return PostResponse(
        id=post.id,
        sci_fi_item_id=post.sci_fi_item_id,
        title=post.title,
        content=post.content,
        tone=post.tone,
        status=post.status,
        draft_number=post.draft_number,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        sci_fi_item=_sci_fi_item_to_response(post.sci_fi_item),
        research_items=research_items,
        images=images,
    )
```

- [ ] **Step 4: Add `joinedload(Post.images)` to all four query sites in `posts.py`**

There are four places in `posts.py` that call `.options(joinedload(Post.sci_fi_item), joinedload(Post.research_items))`. Replace **each one** with the line below. Apply the same replacement in all four locations — `list_posts`, `get_post`, the re-query in `create_post`, and the re-query in `update_post`:

```python
        .options(joinedload(Post.sci_fi_item), joinedload(Post.research_items), joinedload(Post.images))
```

Confirm after editing: search the file for `.options(joinedload` — you should find exactly 4 occurrences, all three-argument form.

- [ ] **Step 5: Start backend and verify posts endpoint still works**

```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload
```

In another terminal:
```bash
curl -s http://localhost:8000/api/posts | python3 -m json.tool
```

Expected: JSON array of posts. Each post object has an `"images": []` field and **no** `"image_url"` field. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/post_image.py backend/app/schemas/post.py backend/app/routers/posts.py
git commit -m "feat: add PostImageResponse schema, update PostResponse and posts router"
```

---

## Chunk 2: Backend — image router rewrite

### Task 3: Rewrite `backend/app/routers/image.py`

**Files:**
- Modify: `backend/app/routers/image.py`

- [ ] **Step 1: Replace `backend/app/routers/image.py` with the new implementation**

```python
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
```

- [ ] **Step 2: Update `backend/app/main.py` — remove static file infrastructure**

In `main.py`, atomically remove both of these lines in the same edit (removing `makedirs` alone without the mount causes a startup crash):

Remove:
```python
os.makedirs("static/images", exist_ok=True)
```

Remove:
```python
app.mount("/static", StaticFiles(directory="static"), name="static")
```

Remove the `StaticFiles` import — it is no longer used. Keep `FileResponse` (used by the SPA fallback handler). Change the import line from:
```python
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
```
to:
```python
from fastapi.responses import FileResponse, JSONResponse
```

Also remove the `ALTER TABLE posts ADD COLUMN image_url TEXT` migration block from the `lifespan` function (the try/except block that adds that column).

Leave the `app.mount("/assets", ...)` frontend dist mount untouched.

- [ ] **Step 3: Start backend and smoke-test the new endpoints**

```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload
```

```bash
# Check health
curl -s http://localhost:8000/api/health

# List posts (should have images: [] on each)
curl -s http://localhost:8000/api/posts | python3 -m json.tool | head -40

# Verify 404 on missing image
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/image/99999
# Expected: 404

# Verify download 404 — no images exist in post_images table yet, so any post_id returns 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/image/download/1
# Expected: 404 — endpoint returns 404 when no PostImage row with is_selected=True exists for the post
```

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/image.py backend/app/main.py
git commit -m "feat: rewrite image router to store images in DB, remove static files"
```

---

## Chunk 3: Frontend — api.js and AuthoringPage carousel

### Task 4: Update `frontend/src/services/api.js`

**Files:**
- Modify: `frontend/src/services/api.js`

- [ ] **Step 1: Add two new exports to the Image section of `api.js`**

After the existing `suggestImagePrompt` line, add:
```js
export const selectImage = (imageId) => client.put(`/image/${imageId}/select`).then(r => r.data)
export const deleteImage = (imageId) => client.delete(`/image/${imageId}`)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add selectImage and deleteImage API helpers"
```

---

### Task 5: Rewrite the image panel in `AuthoringPage.jsx`

**Files:**
- Modify: `frontend/src/pages/AuthoringPage.jsx`

- [ ] **Step 1: Update imports at the top of `AuthoringPage.jsx`**

First, add `useEffect` to the React import. The current line is:
```js
import { useState } from 'react';
```
Change to:
```js
import { useState, useEffect } from 'react';
```

Replace the lucide-react import block. Remove `Download` (no longer needed as an icon). The new imports block:
```js
import {
  PenTool,
  Sparkles,
  Save,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Film,
  Loader2,
  FileText,
  MessageSquare,
  ExternalLink,
  ImageIcon,
  Trash2,
  Check,
} from 'lucide-react';
```

Add `selectImage` and `deleteImage` to the services import:
```js
import {
  getPost,
  getResearchItems,
  generatePost,
  updatePost,
  generateImage,
  suggestImagePrompt,
  selectImage,
  deleteImage,
} from '../services/api';
```

- [ ] **Step 2: Replace state variables — apply Steps 2 and 3b atomically**

**Important:** Steps 2 and 3b must be applied in the same edit pass. Removing `imagePromptInitialized` state (this step) without simultaneously removing the if-blocks that call `setImagePromptInitialized` (Step 3b) will cause a build error. Do both before running the dev server.

Find and remove:
```js
  const [imageUrl, setImageUrl] = useState('');
  const [imagePromptInitialized, setImagePromptInitialized] = useState(false);
```

Add in their place:
```js
  const [focusedIndex, setFocusedIndex] = useState(0);
```

- [ ] **Step 3: Move derived consts above hooks and add `useEffect` calls**

The current file has `const sciFiItem`, `const themes`, and the two `imagePromptInitialized` if-blocks placed *below* the hooks section (after `suggestPromptMutation`). Because hooks must not be called after conditional code or an early-return guard, the two new `useEffect` calls must be placed with the other hooks — which means their dependencies (`sciFiItem`, `themes`, `post?.images`) must be derived before the hooks run.

**Step 3a — Confirm derivation consts are in the right place (no move needed):**

Find these two lines in the component (currently after `suggestPromptMutation` and before `if (postLoading)`):
```js
  const sciFiItem = post?.sci_fi_item;
  const themes = sciFiItem ? parseThemes(sciFiItem.themes) : [];
```
These depend on `post` (from `useQuery`) so they cannot move above the `useQuery` call. They are already in the correct position — after all `useQuery`/`useMutation` hooks and before the `if (postLoading)` early-return guard. Leave them exactly where they are.

**Step 3b — Remove the two `imagePromptInitialized` if-blocks:**
```js
  if (post && sciFiItem && !imagePromptInitialized) {
    const themeStr = themes.length > 0 ? themes.join(', ') : 'science fiction';
    setImagePrompt(
      `${sciFiItem.title} — ${themeStr} — cinematic sci-fi style, dramatic lighting, photorealistic`
    );
    setImagePromptInitialized(true);
  }
  if (post && !sciFiItem && !imagePromptInitialized) {
    setImagePrompt('cinematic sci-fi landscape, dramatic lighting, photorealistic');
    setImagePromptInitialized(true);
  }
```

**Step 3c — Add two `useEffect` calls after `suggestPromptMutation` (within the hooks section, before `handleGenerateImage`):**
```js
  // Initialise image prompt when sci-fi item first loads
  useEffect(() => {
    if (!sciFiItem) return;
    const themeStr = themes.length > 0 ? themes.join(', ') : 'science fiction';
    setImagePrompt(
      `${sciFiItem.title} — ${themeStr} — cinematic sci-fi style, dramatic lighting, photorealistic`
    );
  }, [sciFiItem?.id]);

  // Clamp focusedIndex when images array changes (generate adds, delete removes)
  useEffect(() => {
    const len = post?.images?.length ?? 0;
    setFocusedIndex(prev => (len === 0 ? 0 : Math.min(prev, len - 1)));
  }, [post?.images?.length]);
```

**Step 3d — Add `images` derived const** just before the `if (postLoading)` early-return check:
```js
  const images = post?.images ?? [];
```

This const is used in the JSX (Step 6) but does not need to be above the hooks since it is not used inside a `useEffect`.

- [ ] **Step 4: Add the select and delete mutations**

After `suggestPromptMutation`, add:
```js
  const selectMutation = useMutation({
    mutationFn: (imageId) => selectImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Image selected for publishing');
    },
    onError: (err) => toast.error(err.message || 'Failed to select image'),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId) => deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete image'),
  });
```

- [ ] **Step 5: Update `imageMutation.onSuccess`**

Replace:
```js
  const imageMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: (data) => {
      setImageUrl(data.image_url);
      toast.success('Image generated!');
    },
    onError: (err) => toast.error(err.message || 'Image generation failed'),
  });
```

With:
```js
  const imageMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Image generated!');
    },
    onError: (err) => toast.error(err.message || 'Image generation failed'),
  });
```

- [ ] **Step 6: Remove dead `handleGenerateImage` function**

The existing `handleGenerateImage` function (lines ~114–116) will become dead code once the JSX is updated in the next step to inline the mutation call. Remove it now:
```js
  const handleGenerateImage = () => {
    imageMutation.mutate({ post_id: parseInt(postId), prompt: imagePrompt });
  };
```

- [ ] **Step 7: Replace the Image Generation Section JSX**

Find and replace the entire `{/* Image Generation Section */}` div (from `<div className="bg-slate-800 rounded-xl border border-cyan-500/30 mb-6">` to its closing `</div>`).

Replace with:

```jsx
          {/* Image Generation Section */}
          <div className="bg-slate-800 rounded-xl border border-cyan-500/30 mb-6">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 text-sm font-medium">Post Image</span>
              </div>
              <span className="text-xs text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                fal.ai
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Prompt input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500 uppercase tracking-wide">
                    Image prompt
                  </label>
                  <button
                    onClick={() => suggestPromptMutation.mutate()}
                    disabled={suggestPromptMutation.isPending || !sciFiItem}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                    title={!sciFiItem ? 'Requires a linked sci-fi item' : 'Suggest prompt from articles'}
                  >
                    {suggestPromptMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {suggestPromptMutation.isPending ? 'Suggesting…' : 'Suggest from articles'}
                  </button>
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image for your post..."
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm leading-relaxed resize-none"
                  rows={3}
                />
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => imageMutation.mutate({ post_id: parseInt(postId), prompt: imagePrompt })}
                  disabled={imageMutation.isPending || !imagePrompt.trim()}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  {imageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {imageMutation.isPending ? 'Generating…' : 'Generate Image'}
                </button>
                {imageMutation.isPending && (
                  <span className="text-slate-500 text-xs">~10–20 seconds</span>
                )}
              </div>

              {/* Carousel */}
              {images.length > 0 ? (
                <div className="pt-2 space-y-3">
                  {/* Image display with prev/next arrows */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFocusedIndex(prev => Math.max(0, prev - 1))}
                      disabled={focusedIndex === 0}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 relative">
                      <img
                        src={`/api/image/${images[focusedIndex].id}`}
                        alt={`Generated image ${focusedIndex + 1}`}
                        className={`w-full h-48 object-cover rounded-lg border-2 transition-all ${
                          images[focusedIndex].is_selected
                            ? 'border-cyan-400'
                            : 'border-slate-700'
                        }`}
                      />
                      {images[focusedIndex].is_selected && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Selected
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setFocusedIndex(prev => Math.min(images.length - 1, prev + 1))}
                      disabled={focusedIndex === images.length - 1}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dot indicators */}
                  {images.length > 1 && (
                    <div className="flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setFocusedIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === focusedIndex ? 'bg-cyan-400' : 'bg-slate-600 hover:bg-slate-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-3">
                    {images[focusedIndex].is_selected ? (
                      <span className="flex items-center gap-1.5 text-cyan-400 text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Selected for publishing
                      </span>
                    ) : (
                      <button
                        onClick={() => selectMutation.mutate(images[focusedIndex].id)}
                        disabled={selectMutation.isPending}
                        className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {selectMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Use this image
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(images[focusedIndex].id)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 bg-red-900/50 hover:bg-red-800/50 disabled:opacity-50 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-800/50"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                    <span className="text-slate-600 text-xs ml-auto">
                      {focusedIndex + 1} / {images.length}
                    </span>
                  </div>

                  {/* Download link — only when an image is selected */}
                  {images.some(img => img.is_selected) && (
                    <a
                      href={`/api/image/download/${postId}`}
                      download="post-image.png"
                      className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                    >
                      ↓ Download selected image
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-sm pt-1">No images generated yet.</p>
              )}
            </div>
          </div>
```

- [ ] **Step 8: Start the dev server and manually test the carousel**

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`. Navigate to an existing post's Authoring page. Generate an image. Verify:
- Image appears in the carousel
- "Use this image" button marks it as selected (cyan border + badge)
- Generating a second image adds it to the carousel; arrows and dots appear
- Delete button removes the image; carousel adjusts
- Download link appears when an image is selected

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/AuthoringPage.jsx
git commit -m "feat: add image carousel to AuthoringPage with select/delete"
```

---

## Chunk 4: Frontend — PublishingPage update

### Task 6: Update `PublishingPage.jsx` to use `post.images`

**Files:**
- Modify: `frontend/src/pages/PublishingPage.jsx`

- [ ] **Step 1: Update the image section in `PublishingPage.jsx`**

In `PublishingPage.jsx`, find the `{/* Step 2: Download image */}` section. Replace the condition and image display block:

Current code (lines 87–121):
```jsx
          <div className="p-5">
            {post?.image_url ? (
              <div className="flex items-center gap-5">
                <img
                  src={post.image_url}
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
                  No image generated.{' '}
                  <button
                    onClick={() => navigate(`/author/${postId}`)}
                    className="text-cyan-400 hover:underline"
                  >
                    Go back to Authoring
                  </button>{' '}
                  to generate one.
                </p>
              </div>
            )}
          </div>
```

Add a `const selectedImg` derivation just inside the component body (before the `if (isLoading)` guard — `post` is available from `useQuery`):
```js
  const selectedImg = post?.images?.find(img => img.is_selected);
```

Then replace the inner `<div className="p-5">` block with:
```jsx
          <div className="p-5">
            {selectedImg ? (
              <div className="flex items-center gap-5">
                <img
                  src={`/api/image/${selectedImg.id}`}
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
                  <button
                    onClick={() => navigate(`/author/${postId}`)}
                    className="text-cyan-400 hover:underline"
                  >
                    Go back to Authoring
                  </button>{' '}
                  to generate and select one.
                </p>
              </div>
            )}
          </div>
```

- [ ] **Step 2: Manually verify PublishingPage**

With backend and frontend running, navigate to the Publishing page for a post that has a selected image. Verify:
- The selected image thumbnail is shown
- The Download button works
- For a post with no selected image, the fallback message is shown with the "Go back to Authoring" link

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PublishingPage.jsx
git commit -m "feat: update PublishingPage to use post.images instead of image_url"
```

---

## Final: Integration smoke test and cleanup

- [ ] **Step 1: Full flow test**

With backend and frontend running:
1. Open an existing post → Authoring page
2. Generate 3 images with different prompts
3. Use prev/next arrows to navigate between them
4. Select the second image → confirm cyan border and "Selected for publishing" badge
5. Delete the third image → confirm it disappears and dots update
6. Click "Download selected image" → confirm PNG downloads
7. Click "Continue to Publish" → Publishing page shows the selected image thumbnail and Download button
8. Delete the selected image from Authoring → Publishing page now shows the fallback message

- [ ] **Step 2: Verify no static file remnants**

```bash
# No static/images directory should be needed
ls backend/static/images 2>/dev/null && echo "directory exists" || echo "directory gone (expected)"
```

- [ ] **Step 3: Final commit (if anything remains uncommitted)**

```bash
git status
```

If `git status` shows nothing to commit, all work is already committed — skip this step. If there are untracked changes, stage them explicitly by file path (do not use `git add -A`) and commit:
```bash
git add <specific-files>
git commit -m "chore: post-implementation cleanup"
```
