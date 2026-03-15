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
