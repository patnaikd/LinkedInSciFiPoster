from __future__ import annotations

import anthropic

from app.config import settings

TONE_DESCRIPTIONS: dict[str, str] = {
    "professional_witty": (
        "professional yet witty, with clever observations and a touch of humor"
    ),
    "thought_leadership": (
        "authoritative and insightful, positioned as industry thought leadership"
    ),
    "casual_fun": (
        "casual, fun, and conversational with humor"
    ),
    "provocative": (
        "bold and provocative, challenging conventional thinking"
    ),
    "storytelling": (
        "narrative-driven, telling a story that connects past fiction to present reality"
    ),
}

MODEL = "claude-sonnet-4-5-20250514"


def generate_post(
    sci_fi_item: dict,
    research_items: list[dict],
    tone: str,
    additional_instructions: str | None = None,
    previous_draft: str | None = None,
) -> tuple[str, str]:
    """Generate a LinkedIn post connecting a sci-fi work to current trends.

    Args:
        sci_fi_item: Dict with keys: title, author_or_director, year, description, themes.
        research_items: List of dicts with keys: title, url, snippet.
        tone: One of the keys in TONE_DESCRIPTIONS.
        additional_instructions: Optional extra instructions for the model.
        previous_draft: Optional previous draft for refinement.

    Returns:
        A tuple of (generated_content, full_prompt_used).

    Raises:
        ValueError: If the tone is not recognised.
        RuntimeError: If the Anthropic API call fails.
    """
    tone_description = TONE_DESCRIPTIONS.get(tone)
    if tone_description is None:
        raise ValueError(
            f"Unknown tone '{tone}'. Must be one of: {', '.join(TONE_DESCRIPTIONS)}"
        )

    # --- Build the system prompt ---
    system_prompt = (
        "You are a LinkedIn content creator who writes engaging posts that connect "
        "science fiction themes to current real-world trends. "
        f"Your posts are {tone_description}. "
        "Keep posts under 3000 characters (LinkedIn limit). "
        "Use line breaks for readability. "
        "Include 3-5 relevant hashtags at the end."
    )

    # --- Build the user prompt ---
    sci_fi_section_lines = [
        "## Sci-Fi Source Material",
        f"- Title: {sci_fi_item.get('title', 'N/A')}",
        f"- Author / Director: {sci_fi_item.get('author_or_director', 'N/A')}",
        f"- Year: {sci_fi_item.get('year', 'N/A')}",
        f"- Description: {sci_fi_item.get('description', 'N/A')}",
        f"- Themes: {', '.join(sci_fi_item.get('themes', [])) or 'N/A'}",
    ]

    news_section_lines = ["", "## Current News & Trends to Connect"]
    if research_items:
        for idx, item in enumerate(research_items, start=1):
            news_section_lines.append(
                f"{idx}. **{item.get('title', 'N/A')}** — {item.get('snippet', 'N/A')}"
            )
            url = item.get("url")
            if url:
                news_section_lines.append(f"   Link: {url}")
    else:
        news_section_lines.append("No specific news items provided. Use your knowledge of current trends.")

    instructions_section_lines = [
        "",
        "## Instructions",
        "Write a compelling LinkedIn post that draws a parallel between the sci-fi "
        "source material and the current news / trends listed above. Make it engaging "
        "and shareable.",
    ]

    if additional_instructions:
        instructions_section_lines.append(f"\nAdditional instructions: {additional_instructions}")

    if previous_draft:
        instructions_section_lines.append(
            f"\nHere is a previous draft to refine and improve:\n\n{previous_draft}"
        )

    user_prompt = "\n".join(
        sci_fi_section_lines + news_section_lines + instructions_section_lines
    )

    full_prompt = f"[System]\n{system_prompt}\n\n[User]\n{user_prompt}"

    # --- Call the Anthropic API ---
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt},
            ],
        )
    except anthropic.AuthenticationError as exc:
        raise RuntimeError(
            "Anthropic API authentication failed. Check your ANTHROPIC_API_KEY."
        ) from exc
    except anthropic.RateLimitError as exc:
        raise RuntimeError(
            "Anthropic API rate limit exceeded. Please try again later."
        ) from exc
    except anthropic.APIError as exc:
        raise RuntimeError(
            f"Anthropic API error: {exc}"
        ) from exc

    generated_content = message.content[0].text
    return generated_content, full_prompt
