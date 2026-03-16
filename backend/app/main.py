import logging
import os
import traceback
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings as app_settings
from app.database import Base, engine
from app.routers import ai, image, library, news, posts, research, search, settings

logger = logging.getLogger(__name__)

# fal_client reads FAL_KEY from os.environ at call time.
# pydantic-settings loads .env into Settings fields but not os.environ,
# so we must explicitly sync FAL_KEY across.
if app_settings.FAL_KEY:
    os.environ.setdefault("FAL_KEY", app_settings.FAL_KEY)

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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s\n%s",
        request.method,
        request.url,
        traceback.format_exc(),
    )
    return JSONResponse(status_code=500, content={"detail": str(exc)})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in app_settings.ALLOWED_ORIGINS.split(",")],
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


_FRONTEND_DIST = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)

if os.path.isdir(_FRONTEND_DIST):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")),
        name="frontend-assets",
    )

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
