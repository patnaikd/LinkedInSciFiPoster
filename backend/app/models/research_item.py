from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ResearchItem(Base):
    __tablename__ = "research_items"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    source_type = Column(String)  # "news_api", "manual_url", "manual_text"
    title = Column(String)
    url = Column(String)
    snippet = Column(Text)
    source_name = Column(String)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="research_items")
