from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    sci_fi_item_id = Column(Integer, ForeignKey("sci_fi_library.id"), nullable=True)
    title = Column(String)
    content = Column(Text)
    tone = Column(String, default="professional_witty")
    status = Column(String, default="draft")
    draft_number = Column(Integer, default=1)
    ai_prompt_used = Column(Text)
    image_url = Column(String, nullable=True)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sci_fi_item = relationship("SciFiItem", back_populates="posts")
    research_items = relationship(
        "ResearchItem", back_populates="post", cascade="all, delete-orphan"
    )
