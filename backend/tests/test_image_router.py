import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models.post import Post
from app.models.post_image import PostImage


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
    return client, post_id, engine


def test_generate_image_success(test_client):
    client, post_id, engine = test_client
    fake_bytes = b"\x89PNG fake image data"

    with patch("app.routers.image.generate_image", new=AsyncMock(return_value=fake_bytes)):
        resp = client.post("/api/image/generate", json={"post_id": post_id, "prompt": "sci-fi sky"})

    assert resp.status_code == 201
    data = resp.json()
    assert data["post_id"] == post_id
    assert data["prompt"] == "sci-fi sky"
    assert data["is_selected"] is False
    assert "id" in data
    assert "created_at" in data
    # Verify image stored in DB
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    image = db.query(PostImage).filter(PostImage.post_id == post_id).first()
    assert image is not None
    assert image.image_data == fake_bytes
    db.close()


def test_generate_image_post_not_found(test_client):
    client, post_id, engine = test_client

    with patch("app.routers.image.generate_image", new=AsyncMock(return_value=b"data")):
        resp = client.post("/api/image/generate", json={"post_id": 9999, "prompt": "x"})

    assert resp.status_code == 404


def test_download_image_success(test_client):
    client, post_id, engine = test_client
    fake_bytes = b"\x89PNG data"

    # Insert a selected PostImage directly into the DB
    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    image = PostImage(post_id=post_id, image_data=fake_bytes, prompt="test", is_selected=True)
    db.add(image)
    db.commit()
    db.close()

    resp = client.get(f"/api/image/download/{post_id}")
    assert resp.status_code == 200
    assert resp.headers["content-disposition"] == 'attachment; filename="post-image.png"'
    assert resp.content == fake_bytes


def test_download_image_not_found(test_client):
    client, post_id, engine = test_client

    # No PostImage exists for this post — should return 404
    resp = client.get(f"/api/image/download/{post_id}")
    assert resp.status_code == 404


def test_get_image_success(test_client):
    client, post_id, engine = test_client
    fake_bytes = b"\x89PNG serve test"

    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    image = PostImage(post_id=post_id, image_data=fake_bytes, prompt="test", is_selected=False)
    db.add(image)
    db.commit()
    db.refresh(image)
    image_id = image.id
    db.close()

    resp = client.get(f"/api/image/{image_id}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content == fake_bytes


def test_get_image_not_found(test_client):
    client, post_id, engine = test_client
    resp = client.get("/api/image/99999")
    assert resp.status_code == 404


def test_select_image(test_client):
    client, post_id, engine = test_client
    fake_bytes = b"\x89PNG"

    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    img1 = PostImage(post_id=post_id, image_data=fake_bytes, is_selected=False)
    img2 = PostImage(post_id=post_id, image_data=fake_bytes, is_selected=False)
    db.add_all([img1, img2])
    db.commit()
    db.refresh(img1)
    db.refresh(img2)
    img1_id, img2_id = img1.id, img2.id
    db.close()

    # Select img1
    resp = client.put(f"/api/image/{img1_id}/select")
    assert resp.status_code == 200
    assert resp.json()["is_selected"] is True

    # Verify img2 is not selected
    db = TestSession()
    img2_db = db.query(PostImage).filter(PostImage.id == img2_id).first()
    assert img2_db.is_selected is False
    db.close()


def test_delete_image(test_client):
    client, post_id, engine = test_client

    TestSession = sessionmaker(bind=engine)
    db = TestSession()
    image = PostImage(post_id=post_id, image_data=b"\x89PNG", is_selected=False)
    db.add(image)
    db.commit()
    db.refresh(image)
    image_id = image.id
    db.close()

    resp = client.delete(f"/api/image/{image_id}")
    assert resp.status_code == 204

    # Verify deleted
    db = TestSession()
    assert db.query(PostImage).filter(PostImage.id == image_id).first() is None
    db.close()
