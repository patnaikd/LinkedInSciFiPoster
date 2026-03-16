from app.schemas.post import PostResponse
from app.schemas.post_image import PostImageResponse


def test_post_response_has_images():
    """PostResponse should include images list, not image_url or linkedin fields."""
    fields = PostResponse.model_fields
    assert "images" in fields
    assert "image_url" not in fields
    assert "linkedin_post_url" not in fields
    assert "linkedin_post_id" not in fields


def test_post_response_images_defaults_to_empty_list():
    """images should default to an empty list."""
    field = PostResponse.model_fields["images"]
    assert field.default == []


def test_post_image_response_fields():
    """PostImageResponse should have id, post_id, prompt, is_selected, created_at."""
    fields = PostImageResponse.model_fields
    assert "id" in fields
    assert "post_id" in fields
    assert "prompt" in fields
    assert "is_selected" in fields
    assert "created_at" in fields
    assert "image_data" not in fields  # bytes are not exposed in the schema
