from sqlalchemy import Column, String, Text, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class Profile(Base):
    __tablename__ = 'profiles'
    
    profile_url = Column(String, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    full_name = Column(String)
    title = Column(Text)
    connection_since = Column(DateTime(timezone=True))
    profile_image_url = Column(String)
    # Note attributes
    notes = Column(Text)
    category = Column(String)
    recheck_date = Column(DateTime(timezone=True))
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Create engine with database URL directly
engine = create_engine(os.getenv('DATABASE_URL'))