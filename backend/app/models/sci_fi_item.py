from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class SciFiItem(Base):
    __tablename__ = "sci_fi_library"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, nullable=False)  # "book" or "movie"
    title = Column(String, nullable=False)
    author_or_director = Column(String)
    year = Column(Integer)
    description = Column(Text)
    cover_image_url = Column(String)
    external_id = Column(String)
    themes = Column(Text)  # JSON-encoded list
    metadata_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    posts = relationship("Post", back_populates="sci_fi_item")
