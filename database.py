import os
import enum
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Enum, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./market_signals.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ImpactLevel(str, enum.Enum):
    POSITIVE = "Positive"  
    NEGATIVE = "Negative"  
    NEUTRAL = "Neutral"    

class MarketSignal(Base):
    __tablename__ = "market_signals"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String(150), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False)
    impact = Column(Enum(ImpactLevel), nullable=False, default=ImpactLevel.NEUTRAL)
    summary = Column(Text, nullable=False)
    source_url = Column(String(500), unique=True, nullable=False)
    source_name = Column(String(100), nullable=False) 
    published_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class GovernmentCircular(Base):
    __tablename__ = "government_circulars"

    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(100), index=True, nullable=False) # e.g., "Noida Authority"
    title = Column(String(500), nullable=False)
    url = Column(String(500), unique=True, nullable=False) # PDF Link
    published_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    print("Database schema successfully initialized.")