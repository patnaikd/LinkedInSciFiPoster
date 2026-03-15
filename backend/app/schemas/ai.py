from pydantic import BaseModel


class GeneratePostRequest(BaseModel):
    post_id: int
    tone: str = "professional_witty"
    additional_instructions: str | None = None


class GeneratePostResponse(BaseModel):
    generated_content: str
    prompt_used: str
    draft_number: int
