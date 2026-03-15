# Manual LinkedIn Publishing + fal.ai Image Generation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automated LinkedIn OAuth publishing with a manual copy-paste workflow and add fal.ai image generation to the Authoring page.

**Architecture:** The backend removes all LinkedIn OAuth code and adds a new `/api/image` router that calls fal.ai, downloads the generated image locally, and serves it via a static file mount. The frontend adds an image generation panel below the text editor in AuthoringPage and replaces PublishingPage with a 3-step manual guide.

**Tech Stack:** FastAPI, SQLAlchemy (SQLite), fal-client (Python), React, React Query, axios, Tailwind CSS v4, lucide-react

---

## Chunk 1: Backend — Remove LinkedIn, Add Image Generation

### Task 0: Install test dependencies and create tests directory

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Add pytest and pytest-asyncio to requirements**

  Open `backend/requirements.txt` and add after the last line:

  ```
  pytest==8.3.3
  pytest-asyncio==0.24.0
  ```

- [ ] **Step 2: Install them**

  ```bash
  cd backend
  source venv/bin/activate
  pip install pytest==8.3.3 pytest-asyncio==0.24.0
  ```

  Expected: `Successfully installed pytest-8.3.3 pytest-asyncio-0.24.0` (or already satisfied)

- [ ] **Step 3: Create the tests directory and __init__.py**

  ```bash
  mkdir -p backend/tests
  touch backend/tests/__init__.py
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/requirements.txt backend/tests/__init__.py
  git commit -m "chore: add pytest/pytest-asyncio test dependencies and tests dir"
  ```

---

### Task 1: Add fal-client dependency and FAL_KEY config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add fal-client to requirements**

  Open `backend/requirements.txt` and add after the last line:

  ```
  fal-client==0.5.6
  ```

- [ ] **Step 2: Update config.py — remove LinkedIn vars, add FAL_KEY**

  Replace the full contents of `backend/app/config.py` with:

  ```python
  from pydantic_settings import BaseSettings


  class Settings(BaseSettings):
      DATABASE_URL: str = "sqlite:///./scifi_poster.db"
      ANTHROPIC_API_KEY: str = ""
      TMDB_API_KEY: str = ""
      NEWS_API_KEY: str = ""
      FAL_KEY: str = ""

      model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


  settings = Settings()
  ```

- [ ] **Step 3: Update .env.example**

  Replace full contents of `backend/.env.example` with:

  ```
  DATABASE_URL=sqlite:///./scifi_poster.db
  ANTHROPIC_API_KEY=sk-ant-xxx
  TMDB_API_KEY=
  NEWS_API_KEY=
  FAL_KEY=
  ```

- [ ] **Step 4: Install fal-client into the venv**

  ```bash
  cd backend
  source venv/bin/activate
  pip install fal-client==0.5.6
  ```

  Expected: `Successfully installed fal-client-0.5.6` (or already satisfied)

- [ ] **Step 5: Commit**

  ```bash
  git add backend/requirements.txt backend/app/config.py backend/.env.example
  git commit -m "chore: add fal-client dep, remove LinkedIn config vars"
  ```

---

### Task 2: Update Post model and schema — remove LinkedIn fields, add image_url

**Files:**
- Modify: `backend/app/models/post.py`
- Modify: `backend/app/schemas/post.py`
- Modify: `backend/app/routers/posts.py`

- [ ] **Step 1: Write a test for the updated PostResponse schema**

  Create `backend/tests/test_post_schema.py`:

  ```python
  from app.schemas.post import PostResponse
  from datetime import datetime


  def test_post_response_has_image_url():
      """PostResponse should include image_url and not linkedin fields."""
      fields = PostResponse.model_fields
      assert "image_url" in fields
      assert "linkedin_post_url" not in fields
      assert "linkedin_post_id" not in fields


  def test_post_response_image_url_is_optional():
      """image_url should be nullable."""
      field = PostResponse.model_fields["image_url"]
      assert field.default is None
  ```

- [ ] **Step 2: Run the test — expect FAIL**

  ```bash
  cd backend
  source venv/bin/activate
  python -m pytest tests/test_post_schema.py -v
  ```

  Expected: FAIL — `assert "image_url" in fields` fails, `linkedin_post_url` still present.

- [ ] **Step 3: Update Post model**

  Replace the full contents of `backend/app/models/post.py` with:

  ```python
  from datetime import datetime

  from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
  from sqlalchemy.orm import relationship

  from app.database import Base


  class Post(Base):
      __tablename__ = "posts"

      id = Column(Integer, primary_key=True, index=True)
      sci_fi_item_id = Column(Integer, ForeignKey("sci_fi_library.id"), nullable=True)
      title = Column(String)
      content = Column(Text)
      tone = Column(String, default="professional_witty")
      status = Column(String, default="draft")
      draft_number = Column(Integer, default=1)
      ai_prompt_used = Column(Text)
      image_url = Column(String, nullable=True)
      published_at = Column(DateTime)
      created_at = Column(DateTime, default=datetime.utcnow)
      updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

      sci_fi_item = relationship("SciFiItem", back_populates="posts")
      research_items = relationship(
          "ResearchItem", back_populates="post", cascade="all, delete-orphan"
      )
  ```

- [ ] **Step 4: Update PostResponse schema**

  Replace the full contents of `backend/app/schemas/post.py` with:

  ```python
  from datetime import datetime

  from pydantic import BaseModel, ConfigDict

  from app.schemas.library import SciFiItemResponse
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
      image_url: str | None = None
      published_at: datetime | None = None
      created_at: datetime
      updated_at: datetime
      sci_fi_item: SciFiItemResponse | None = None
      research_items: list[ResearchItemResponse] = []

      model_config = ConfigDict(from_attributes=True)
  ```

- [ ] **Step 5: Update _post_to_response in posts.py**

  In `backend/app/routers/posts.py`, replace the `_post_to_response` function (lines 47–67) with:

  ```python
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
          image_url=post.image_url,
          published_at=post.published_at,
          created_at=post.created_at,
          updated_at=post.updated_at,
          sci_fi_item=_sci_fi_item_to_response(post.sci_fi_item),
          research_items=research_items,
      )
  ```

- [ ] **Step 6: Run the test — expect PASS**

  ```bash
  cd backend
  python -m pytest tests/test_post_schema.py -v
  ```

  Expected: PASS — both assertions satisfied.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/app/models/post.py backend/app/schemas/post.py backend/app/routers/posts.py backend/tests/test_post_schema.py
  git commit -m "feat: replace linkedin_post fields with image_url on Post model"
  ```

---

### Task 3: Add SQLite migration for image_url column in startup lifespan

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write a test for the migration**

  Create `backend/tests/test_migration.py`:

  ```python
  import sqlite3
  import pytest


  def test_image_url_column_exists_after_migration(tmp_path):
      """Startup migration should add image_url column if missing."""
      db_path = tmp_path / "test.db"
      conn = sqlite3.connect(str(db_path))
      # Create posts table without image_url (simulating old schema)
      conn.execute("""
          CREATE TABLE posts (
              id INTEGER PRIMARY KEY,
              title TEXT,
              linkedin_post_url TEXT,
              linkedin_post_id TEXT
          )
      """)
      conn.commit()

      # Run migration
      try:
          conn.execute("ALTER TABLE posts ADD COLUMN image_url TEXT")
          conn.commit()
      except Exception:
          pass  # column already exists

      # Verify column present
      cursor = conn.execute("PRAGMA table_info(posts)")
      columns = [row[1] for row in cursor.fetchall()]
      assert "image_url" in columns
      conn.close()
  ```

- [ ] **Step 2: Run the test — expect PASS** (pure SQLite, no app import needed)

  ```bash
  cd backend
  python -m pytest tests/test_migration.py -v
  ```

  Expected: PASS.

- [ ] **Step 3: Update main.py with migration + static dir creation**

  Replace the full contents of `backend/app/main.py` with:

  ```python
  import os
  from contextlib import asynccontextmanager

  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from fastapi.staticfiles import StaticFiles

  from app.database import Base, engine
  from app.routers import ai, image, library, news, posts, research, search, settings

  # Create static/images directory before StaticFiles mount.
  # StaticFiles raises RuntimeError if the directory doesn't exist at import time.
  os.makedirs("static/images", exist_ok=True)


  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Create tables for new schemas
      Base.metadata.create_all(bind=engine)

      # Add image_url column if it doesn't exist yet (SQLite ALTER TABLE migration).
      # Note: linkedin_post_url and linkedin_post_id remain as phantom columns in the
      # SQLite file (SQLite pre-3.35 cannot DROP COLUMN) but are no longer in the model.
      from sqlalchemy import text
      with engine.connect() as conn:
          try:
              conn.execute(text("ALTER TABLE posts ADD COLUMN image_url TEXT"))
              conn.commit()
          except Exception:
              pass  # column already exists

      yield


  app = FastAPI(title="LinkedIn Sci-Fi Poster", version="1.0.0", lifespan=lifespan)

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:5173"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

  # Serve generated images at /static/images/<filename>
  app.mount("/static", StaticFiles(directory="static"), name="static")

  app.include_router(search.router, prefix="/api/search", tags=["search"])
  app.include_router(library.router, prefix="/api/library", tags=["library"])
  app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
  app.include_router(research.router, prefix="/api/research", tags=["research"])
  app.include_router(news.router, prefix="/api/news", tags=["news"])
  app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
  app.include_router(image.router, prefix="/api/image", tags=["image"])
  app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


  @app.get("/api/health")
  async def health_check():
      return {"status": "ok"}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/main.py backend/tests/test_migration.py
  git commit -m "feat: add image_url migration and static file mount in lifespan"
  ```

---

### Task 4: Create fal_service.py

**Files:**
- Create: `backend/app/services/fal_service.py`
- Create: `backend/tests/test_fal_service.py`

- [ ] **Step 1: Write a test for fal_service**

  Create `backend/tests/test_fal_service.py`:

  ```python
  import pytest
  from unittest.mock import AsyncMock, MagicMock, patch


  @pytest.mark.asyncio
  async def test_generate_image_returns_bytes():
      """generate_image should call fal and return raw image bytes."""
      fake_image_bytes = b"\x89PNG\r\n"
      fake_url = "https://fal.ai/fake-cdn/image.png"

      mock_result = MagicMock()
      mock_result.images = [MagicMock(url=fake_url)]

      with patch("app.services.fal_service.fal_client") as mock_fal, \
           patch("app.services.fal_service.httpx") as mock_httpx:
          mock_fal.run = AsyncMock(return_value=mock_result)
          mock_response = MagicMock()
          mock_response.content = fake_image_bytes
          mock_response.raise_for_status = MagicMock()
          mock_httpx.AsyncClient.return_value.__aenter__ = AsyncMock(
              return_value=MagicMock(get=AsyncMock(return_value=mock_response))
          )
          mock_httpx.AsyncClient.return_value.__aexit__ = AsyncMock(return_value=False)

          from app.services.fal_service import generate_image
          result = await generate_image("a sci-fi landscape")

      assert result == fake_image_bytes
  ```

- [ ] **Step 2: Run test — expect FAIL** (module doesn't exist yet)

  ```bash
  cd backend
  python -m pytest tests/test_fal_service.py -v
  ```

  Expected: FAIL with `ModuleNotFoundError` or import error.

  Note: The test written in Step 1 uses slightly different mock patterns than the final implementation. Step 4 below will replace it with the correct version once the service exists. This is intentional — the goal of Step 1 is just to confirm the module is missing.

- [ ] **Step 3: Create fal_service.py**

  Create `backend/app/services/fal_service.py`:

  ```python
  """fal.ai image generation service.

  Calls fal-ai/flux/schnell with the given prompt, downloads the image bytes
  from the returned CDN URL, and returns them. The router is responsible for
  saving the bytes to disk.

  Auth is handled automatically by fal_client via the FAL_KEY environment variable.
  """
  from __future__ import annotations

  import fal_client
  import httpx


  async def generate_image(prompt: str) -> bytes:
      """Generate an image via fal.ai and return the raw PNG bytes.

      Args:
          prompt: Text prompt for image generation.

      Returns:
          Raw image bytes downloaded from the fal.ai CDN URL.

      Raises:
          Exception: If fal.ai call fails or image download fails.
      """
      result = await fal_client.run_async(
          "fal-ai/flux/schnell",
          arguments={"prompt": prompt, "image_size": "landscape_4_3"},
      )
      image_url: str = result["images"][0]["url"]

      async with httpx.AsyncClient() as client:
          response = await client.get(image_url)
          response.raise_for_status()
          return response.content
  ```

- [ ] **Step 4: Update test to match the actual fal_client API**

  The fal_client's async API returns a dict, not an object with `.images`. Update `backend/tests/test_fal_service.py` to match:

  ```python
  import pytest
  from unittest.mock import AsyncMock, MagicMock, patch


  @pytest.mark.asyncio
  async def test_generate_image_returns_bytes():
      """generate_image should call fal and return raw image bytes."""
      fake_image_bytes = b"\x89PNG\r\n"
      fake_url = "https://fal.ai/fake-cdn/image.png"

      mock_result = {"images": [{"url": fake_url}]}

      mock_response = MagicMock()
      mock_response.content = fake_image_bytes
      mock_response.raise_for_status = MagicMock()

      mock_client_instance = MagicMock()
      mock_client_instance.get = AsyncMock(return_value=mock_response)

      with patch("app.services.fal_service.fal_client") as mock_fal, \
           patch("app.services.fal_service.httpx.AsyncClient") as mock_httpx_cls:
          mock_fal.run_async = AsyncMock(return_value=mock_result)
          mock_httpx_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
          mock_httpx_cls.return_value.__aexit__ = AsyncMock(return_value=False)

          from app.services.fal_service import generate_image
          result = await generate_image("a sci-fi landscape")

      assert result == fake_image_bytes
      mock_fal.run_async.assert_called_once_with(
          "fal-ai/flux/schnell",
          arguments={"prompt": "a sci-fi landscape", "image_size": "landscape_4_3"},
      )
  ```

- [ ] **Step 5: Run test — expect PASS**

  ```bash
  cd backend
  python -m pytest tests/test_fal_service.py -v
  ```

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/app/services/fal_service.py backend/tests/test_fal_service.py
  git commit -m "feat: add fal_service for image generation via fal-ai/flux/schnell"
  ```

---

### Task 5: Create image router

**Files:**
- Create: `backend/app/routers/image.py`
- Create: `backend/tests/test_image_router.py`

- [ ] **Step 1: Write tests for the image router**

  Create `backend/tests/test_image_router.py`:

  ```python
  import os
  import pytest
  from unittest.mock import AsyncMock, patch
  from fastapi.testclient import TestClient
  from sqlalchemy import create_engine
  from sqlalchemy.orm import sessionmaker

  from app.database import Base, get_db
  from app.models.post import Post


  @pytest.fixture
  def test_client(tmp_path):
      # In-memory SQLite for tests
      engine = create_engine("sqlite:///:memory:")
      Base.metadata.create_all(bind=engine)
      TestSession = sessionmaker(bind=engine)

      def override_db():
          db = TestSession()
          try:
              yield db
          finally:
              db.close()

      # Create a static/images dir in tmp_path
      images_dir = tmp_path / "static" / "images"
      images_dir.mkdir(parents=True)

      # Import app after patching static dir
      from app.main import app
      app.dependency_overrides[get_db] = override_db

      # Insert a test post
      db = TestSession()
      post = Post(title="Test Post", content="Hello", tone="professional_witty", status="draft")
      db.add(post)
      db.commit()
      db.refresh(post)
      post_id = post.id
      db.close()

      client = TestClient(app, raise_server_exceptions=True)
      return client, post_id, str(images_dir), engine


  def test_generate_image_success(test_client, tmp_path, monkeypatch):
      client, post_id, images_dir, engine = test_client
      fake_bytes = b"\x89PNG fake image data"

      monkeypatch.chdir(tmp_path)  # make static/images resolve correctly
      (tmp_path / "static" / "images").mkdir(parents=True, exist_ok=True)

      with patch("app.routers.image.generate_image", new=AsyncMock(return_value=fake_bytes)):
          resp = client.post("/api/image/generate", json={"post_id": post_id, "prompt": "sci-fi sky"})

      assert resp.status_code == 200
      data = resp.json()
      assert data["image_url"] == f"/static/images/{post_id}.png"

      # Verify file was written
      saved = (tmp_path / "static" / "images" / f"{post_id}.png").read_bytes()
      assert saved == fake_bytes


  def test_generate_image_post_not_found(test_client, tmp_path, monkeypatch):
      client, post_id, images_dir, engine = test_client
      monkeypatch.chdir(tmp_path)
      (tmp_path / "static" / "images").mkdir(parents=True, exist_ok=True)

      with patch("app.routers.image.generate_image", new=AsyncMock(return_value=b"data")):
          resp = client.post("/api/image/generate", json={"post_id": 9999, "prompt": "x"})

      assert resp.status_code == 404


  def test_download_image_success(test_client, tmp_path, monkeypatch):
      client, post_id, images_dir, engine = test_client
      monkeypatch.chdir(tmp_path)
      img_path = tmp_path / "static" / "images" / f"{post_id}.png"
      img_path.parent.mkdir(parents=True, exist_ok=True)
      img_path.write_bytes(b"\x89PNG data")

      resp = client.get(f"/api/image/download/{post_id}")
      assert resp.status_code == 200
      assert resp.headers["content-disposition"] == 'attachment; filename="post-image.png"'
      assert resp.content == b"\x89PNG data"


  def test_download_image_not_found(test_client, tmp_path, monkeypatch):
      client, post_id, images_dir, engine = test_client
      monkeypatch.chdir(tmp_path)
      (tmp_path / "static" / "images").mkdir(parents=True, exist_ok=True)

      resp = client.get(f"/api/image/download/9999")
      assert resp.status_code == 404
  ```

- [ ] **Step 2: Run tests — expect FAIL** (router doesn't exist yet)

  ```bash
  cd backend
  python -m pytest tests/test_image_router.py -v
  ```

  Expected: FAIL with import error.

- [ ] **Step 3: Create the image router**

  Create `backend/app/routers/image.py`:

  ```python
  """Image generation and download router.

  POST /api/image/generate  — calls fal.ai, saves image locally, updates post.image_url
  GET  /api/image/download/{post_id} — streams saved image as a browser download
  """
  from __future__ import annotations

  from pathlib import Path

  from fastapi import APIRouter, Depends, HTTPException
  from fastapi.responses import FileResponse
  from pydantic import BaseModel
  from sqlalchemy.orm import Session

  from app.database import get_db
  from app.models.post import Post
  from app.services.fal_service import generate_image

  router = APIRouter()

  IMAGES_DIR = Path("static/images")


  class GenerateRequest(BaseModel):
      post_id: int
      prompt: str


  class GenerateResponse(BaseModel):
      image_url: str


  @router.post("/generate", response_model=GenerateResponse)
  async def generate_post_image(
      payload: GenerateRequest,
      db: Session = Depends(get_db),
  ) -> GenerateResponse:
      """Generate an image for a post via fal.ai and save it locally."""
      post = db.query(Post).filter(Post.id == payload.post_id).first()
      if not post:
          raise HTTPException(status_code=404, detail="Post not found")

      try:
          image_bytes = await generate_image(payload.prompt)
      except Exception as e:
          raise HTTPException(status_code=502, detail=f"Image generation failed: {e}")

      image_path = IMAGES_DIR / f"{payload.post_id}.png"
      image_path.write_bytes(image_bytes)

      image_url = f"/static/images/{payload.post_id}.png"
      post.image_url = image_url
      db.commit()

      return GenerateResponse(image_url=image_url)


  @router.get("/download/{post_id}")
  async def download_post_image(
      post_id: int,
      db: Session = Depends(get_db),
  ) -> FileResponse:
      """Return the generated image as a browser file download."""
      post = db.query(Post).filter(Post.id == post_id).first()
      if not post or not post.image_url:
          raise HTTPException(status_code=404, detail="Image not found for this post")

      image_path = IMAGES_DIR / f"{post_id}.png"
      if not image_path.exists():
          raise HTTPException(status_code=404, detail="Image file not found on disk")

      return FileResponse(
          path=str(image_path),
          media_type="image/png",
          filename="post-image.png",
          headers={"Content-Disposition": 'attachment; filename="post-image.png"'},
      )
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd backend
  python -m pytest tests/test_image_router.py -v
  ```

  Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/routers/image.py backend/tests/test_image_router.py
  git commit -m "feat: add image generation and download router"
  ```

---

### Task 6: Remove LinkedIn router and service files

**Files:**
- Delete: `backend/app/routers/linkedin.py`
- Delete: `backend/app/services/linkedin_service.py`

- [ ] **Step 1: Delete the LinkedIn files**

  ```bash
  rm backend/app/routers/linkedin.py
  rm backend/app/services/linkedin_service.py
  ```

- [ ] **Step 2: Verify the backend starts without errors**

  ```bash
  cd backend
  source venv/bin/activate
  python -c "from app.main import app; print('OK')"
  ```

  Expected: `OK` with no import errors.

- [ ] **Step 3: Run all backend tests**

  ```bash
  cd backend
  python -m pytest tests/ -v
  ```

  Expected: All tests PASS.

- [ ] **Step 4: Commit**

  ```bash
  git add -u
  git commit -m "feat: remove LinkedIn OAuth router and service"
  ```

---

## Chunk 2: Frontend Changes

### Task 7: Update api.js — remove LinkedIn functions, add generateImage

**Files:**
- Modify: `frontend/src/services/api.js`

- [ ] **Step 1: Open api.js and make the following changes**

  In `frontend/src/services/api.js`:

  1. Remove these 4 lines entirely:
     ```js
     export const getLinkedInAuthUrl = () => client.get('/linkedin/authorize').then(r => r.data)
     export const getLinkedInStatus = () => client.get('/linkedin/status').then(r => r.data)
     export const publishToLinkedIn = (data) => client.post('/linkedin/publish', data).then(r => r.data)
     export const disconnectLinkedIn = () => client.delete('/linkedin/disconnect').then(r => r.data)
     ```

  2. Add after the AI section:
     ```js
     // Image
     export const generateImage = (data) => client.post('/image/generate', data).then(r => r.data)
     ```

  The final file should look like:

  ```js
  import axios from 'axios'

  const client = axios.create({ baseURL: '/api' })

  // Search
  export const searchBooks = (q, page = 1) => client.get('/search/books', { params: { query: q, page } }).then(r => r.data)
  export const searchMovies = (q, page = 1) => client.get('/search/movies', { params: { query: q, page } }).then(r => r.data)
  export const getTrendingMovies = (page = 1) => client.get('/search/movies/trending', { params: { page } }).then(r => r.data)

  // Library
  export const getLibrary = (params) => client.get('/library', { params }).then(r => r.data)
  export const saveToLibrary = (item) => client.post('/library', item).then(r => r.data)
  export const deleteFromLibrary = (id) => client.delete(`/library/${id}`)

  // Posts
  export const getPosts = (params) => client.get('/posts', { params }).then(r => r.data)
  export const getPost = (id) => client.get(`/posts/${id}`).then(r => r.data)
  export const createPost = (data) => client.post('/posts', data).then(r => r.data)
  export const updatePost = (id, data) => client.put(`/posts/${id}`, data).then(r => r.data)
  export const deletePost = (id) => client.delete(`/posts/${id}`)

  // Research
  export const getResearchItems = (postId) => client.get('/research', { params: { post_id: postId } }).then(r => r.data)
  export const addResearchItem = (data) => client.post('/research', data).then(r => r.data)
  export const deleteResearchItem = (id) => client.delete(`/research/${id}`)

  // News
  export const searchNews = (keywords, page = 1) => client.get('/news/search', { params: { keywords, page } }).then(r => r.data)

  // AI
  export const generatePost = (data) => client.post('/ai/generate', data).then(r => r.data)

  // Image
  export const generateImage = (data) => client.post('/image/generate', data).then(r => r.data)

  // Settings
  export const getSettings = () => client.get('/settings').then(r => r.data)
  export const upsertSetting = (key, value) => client.put('/settings', { key, value }).then(r => r.data)
  export const deleteSetting = (key) => client.delete(`/settings/${key}`)
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/services/api.js
  git commit -m "feat: remove LinkedIn API fns, add generateImage to api.js"
  ```

---

### Task 8: Update SettingsPage.jsx — remove LinkedIn UI

**Files:**
- Modify: `frontend/src/pages/SettingsPage.jsx`

- [ ] **Step 1: Replace SettingsPage.jsx with the cleaned version**

  Replace the full contents of `frontend/src/pages/SettingsPage.jsx` with:

  ```jsx
  import {
    Settings,
    Key,
    Info,
    Server,
  } from 'lucide-react';

  export default function SettingsPage() {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Settings className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>

          {/* API Keys Info */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-cyan-400" />
              API Configuration
            </h2>

            <div className="flex items-start gap-3 p-4 bg-slate-900/50 border border-slate-700 rounded-lg mb-4">
              <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-slate-400 text-sm leading-relaxed">
                <p className="mb-2">
                  API keys are configured on the server side via environment variables.
                  To set up or modify API keys, edit the{' '}
                  <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">.env</code>{' '}
                  file in the{' '}
                  <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/</code>{' '}
                  directory.
                </p>
                <p>
                  Copy{' '}
                  <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/.env.example</code>{' '}
                  to{' '}
                  <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/.env</code>{' '}
                  and fill in your keys.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-slate-300 text-sm font-medium">ANTHROPIC_API_KEY</p>
                  <p className="text-slate-500 text-xs">Required for AI post generation with Claude</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-slate-300 text-sm font-medium">TMDB_API_KEY</p>
                  <p className="text-slate-500 text-xs">Required for movie search via TMDB</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-slate-300 text-sm font-medium">NEWS_API_KEY</p>
                  <p className="text-slate-500 text-xs">Required for news article search</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-slate-300 text-sm font-medium">FAL_KEY</p>
                  <p className="text-slate-500 text-xs">Required for AI image generation via fal.ai</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify no LinkedIn imports remain**

  ```bash
  grep -n "linkedin\|LinkedIn" frontend/src/pages/SettingsPage.jsx
  ```

  Expected: No output.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/SettingsPage.jsx
  git commit -m "feat: remove LinkedIn UI from SettingsPage, add FAL_KEY entry"
  ```

---

### Task 9: Update AuthoringPage.jsx — add image generation section

**Files:**
- Modify: `frontend/src/pages/AuthoringPage.jsx`

- [ ] **Step 1: Add state variables and imports at the top of AuthoringPage**

  In `frontend/src/pages/AuthoringPage.jsx`, add `generateImage` to the API import:

  ```js
  import {
    getPost,
    getResearchItems,
    generatePost,
    updatePost,
    generateImage,
  } from '../services/api';
  ```

  Add these lucide icons to the icon import (replace existing import block):

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
    Download,
  } from 'lucide-react';
  ```

- [ ] **Step 2: Add image state variables inside the component function**

  Inside `AuthoringPage` (after existing state declarations), add:

  ```js
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePromptInitialized, setImagePromptInitialized] = useState(false);
  ```

- [ ] **Step 3: Add auto-fill logic for the image prompt**

  After the existing `if (post && !contentLoaded)` block, add:

  ```js
  if (post && sciFiItem && !imagePromptInitialized) {
    const themes = parseThemes(sciFiItem.themes);
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

- [ ] **Step 4: Add the image generation mutation**

  After the `saveMutation` declaration, add:

  ```js
  const imageMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: (data) => {
      setImageUrl(data.image_url);
      toast.success('Image generated!');
    },
    onError: (err) => toast.error(err.message || 'Image generation failed'),
  });

  const handleGenerateImage = () => {
    imageMutation.mutate({ post_id: parseInt(postId), prompt: imagePrompt });
  };
  ```

- [ ] **Step 5: Add the Image Generation section to JSX**

  In the JSX, after the closing `</div>` of the Content Textarea section (around where the bottom actions div starts), insert the Image Generation section:

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
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 block">
          Image prompt
        </label>
        <textarea
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Describe the image for your post..."
          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm leading-relaxed resize-none"
          rows={3}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerateImage}
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

      {imageUrl && (
        <div className="flex items-start gap-4 pt-2">
          <img
            src={imageUrl}
            alt="Generated post image"
            className="w-40 h-auto rounded-lg border border-slate-700 object-cover"
          />
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs">Ready to download</span>
            <a
              href={`/api/image/download/${postId}`}
              download="post-image.png"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download Image
            </a>
          </div>
        </div>
      )}
    </div>
  </div>
  ```

- [ ] **Step 6: Start the dev server and manually verify the Image section renders**

  ```bash
  cd frontend
  npm run dev
  ```

  Navigate to an authoring page (e.g. `http://localhost:5173/author/1`). Confirm:
  - Image section appears below the text editor
  - Image prompt is auto-filled based on the sci-fi item
  - "Generate Image" button is visible and responds to click (even if fal.ai call fails without a key)

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/pages/AuthoringPage.jsx
  git commit -m "feat: add fal.ai image generation section to AuthoringPage"
  ```

---

### Task 10: Replace PublishingPage.jsx with manual guide

**Files:**
- Modify: `frontend/src/pages/PublishingPage.jsx`

- [ ] **Step 1: Replace the full contents of PublishingPage.jsx**

  Replace `frontend/src/pages/PublishingPage.jsx` with:

  ```jsx
  import { useState } from 'react';
  import { useParams, useNavigate } from 'react-router-dom';
  import { useQuery } from '@tanstack/react-query';
  import {
    ClipboardCopy,
    Download,
    ExternalLink,
    CheckCircle,
    Loader2,
    ImageOff,
    Plus,
    History,
    ArrowLeft,
  } from 'lucide-react';
  import { getPost } from '../services/api';

  export default function PublishingPage() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const { data: post, isLoading } = useQuery({
      queryKey: ['post', postId],
      queryFn: () => getPost(postId),
    });

    const handleCopy = async () => {
      if (!post?.content) return;
      await navigator.clipboard.writeText(post.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <ClipboardCopy className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Publish to LinkedIn</h1>
          </div>

          {/* Step 1: Copy post text */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 mb-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">1</span>
                <h2 className="text-base font-semibold text-white">Copy your post text</h2>
              </div>
              <span className={`text-sm ${(post?.content?.length || 0) > 3000 ? 'text-red-400' : 'text-slate-500'}`}>
                {post?.content?.length || 0} characters
              </span>
            </div>
            <div className="p-5">
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap mb-4">
                {post?.content || 'No content yet.'}
              </div>
              <button
                onClick={handleCopy}
                disabled={!post?.content}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-300" />
                ) : (
                  <ClipboardCopy className="w-4 h-4" />
                )}
                {copied ? 'Copied!' : 'Copy Post Text'}
              </button>
            </div>
          </div>

          {/* Step 2: Download image */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 mb-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">2</span>
              <h2 className="text-base font-semibold text-white">Download your image</h2>
            </div>
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
          </div>

          {/* Step 3: Post on LinkedIn */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">3</span>
              <h2 className="text-base font-semibold text-white">Post on LinkedIn</h2>
            </div>
            <div className="p-5">
              <ol className="text-slate-300 text-sm leading-loose list-decimal list-inside space-y-1 mb-5">
                <li>Open LinkedIn and click <strong className="text-white">"Start a post"</strong></li>
                <li>Paste your copied text <span className="text-slate-500">(Ctrl+V / ⌘V)</span></li>
                <li>Click the <strong className="text-white">photo icon</strong> and upload your downloaded image</li>
                <li>Review and click <strong className="text-white">"Post"</strong></li>
              </ol>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open LinkedIn
              </a>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/author/${postId}`)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Authoring
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Another Post
            </button>
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              <History className="w-4 h-4" />
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify no LinkedIn imports remain in PublishingPage**

  ```bash
  grep -n "linkedin\|LinkedIn\|publishMutation\|getLinkedInStatus" frontend/src/pages/PublishingPage.jsx
  ```

  Expected: No output.

- [ ] **Step 3: Manually verify the Publishing page in the browser**

  Navigate to `http://localhost:5173/publish/1` (or any valid post ID). Confirm:
  - 3-step guide is visible
  - "Copy Post Text" button copies to clipboard
  - If post has no `image_url`, "Go back to Authoring" message shows
  - "Open LinkedIn" button opens linkedin.com in a new tab

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/PublishingPage.jsx
  git commit -m "feat: replace LinkedIn publish UI with manual copy-paste guide"
  ```

---

### Task 11: Final cleanup and smoke test

**Files:**
- None created; verification only

- [ ] **Step 1: Check for any remaining LinkedIn references in the frontend**

  ```bash
  grep -rn "linkedin\|LinkedIn" frontend/src/ --include="*.jsx" --include="*.js"
  ```

  Expected: Only references should be the "Open LinkedIn" button URL in PublishingPage and the linkedin.com URL text. No imports from services or API calls.

- [ ] **Step 2: Check for any remaining LinkedIn references in the backend**

  ```bash
  grep -rn "linkedin" backend/app/ --include="*.py"
  ```

  Expected: No output (all LinkedIn code removed).

- [ ] **Step 3: Run all backend tests**

  ```bash
  cd backend
  source venv/bin/activate
  python -m pytest tests/ -v
  ```

  Expected: All tests PASS.

- [ ] **Step 4: Run the frontend build**

  ```bash
  cd frontend
  npm run build
  ```

  Expected: Build completes with no errors.

- [ ] **Step 5: Start both servers and do a full end-to-end walkthrough**

  Terminal 1 — backend:
  ```bash
  cd backend && source venv/bin/activate && uvicorn app.main:app --reload
  ```

  Terminal 2 — frontend:
  ```bash
  cd frontend && npm run dev
  ```

  Walk through:
  1. Open `http://localhost:5173`
  2. Create/open a post, navigate to Authoring
  3. Verify Image section is visible with auto-filled prompt
  4. Click "Continue to Publish"
  5. Verify 3-step manual guide is shown (no LinkedIn OAuth UI)
  6. Open `http://localhost:5173/settings` — verify LinkedIn section is gone, FAL_KEY is listed

- [ ] **Step 6: Final commit**

  ```bash
  git add .
  git commit -m "chore: final cleanup — remove all LinkedIn references"
  ```
