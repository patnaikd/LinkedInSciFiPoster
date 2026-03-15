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
