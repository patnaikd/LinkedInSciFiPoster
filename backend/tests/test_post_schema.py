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
