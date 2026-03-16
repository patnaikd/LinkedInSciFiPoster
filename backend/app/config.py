from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./scifi_poster.db"
    ANTHROPIC_API_KEY: str = ""
    TMDB_API_KEY: str = ""
    NEWS_API_KEY: str = ""
    FAL_KEY: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
