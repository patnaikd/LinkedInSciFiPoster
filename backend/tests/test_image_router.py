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
    # File-based SQLite for tests (in-memory doesn't work well with TestClient threading)
    db_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
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

    # Set image_url on the post so the download endpoint finds it
    from sqlalchemy.orm import sessionmaker as sm
    Session = sm(bind=engine)
    db = Session()
    from app.models.post import Post as PostModel
    post = db.query(PostModel).filter(PostModel.id == post_id).first()
    post.image_url = f"/static/images/{post_id}.png"
    db.commit()
    db.close()

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
