import os
import enum
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Enum, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./market_signals.db")

# 1. Cloud providers sometimes use 'postgres://', but SQLAlchemy requires 'postgresql://'
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 2. Dynamic Engine: Removes SQLite-specific thread arguments if using Postgres
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ImpactLevel(str, enum.Enum):
    POSITIVE = "Positive"  
    NEGATIVE = "Negative"  
    NEUTRAL = "Neutral"    

class MarketSignal(Base):
    __tablename__ = "market_signals"

    id = Column(Integer, primary_key=True, index=True)
    headline = Column(String(200), nullable=False, default="Market Update")
    location = Column(String(150), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False)
    impact = Column(Enum(ImpactLevel), nullable=False, default=ImpactLevel.NEUTRAL)
    summary = Column(Text, nullable=False)
    source_url = Column(Text, unique=True, nullable=False) # UPGRADED: Infinite length for Google News URLs
    source_name = Column(String(100), nullable=False) 
    published_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class GovernmentCircular(Base):
    __tablename__ = "government_circulars"

    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(100), index=True, nullable=False) 
    title = Column(String(500), nullable=False)
    url = Column(Text, unique=True, nullable=False) # UPGRADED: Infinite length for deep links
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
    # Wipe the old 500-character limited tables
    Base.metadata.drop_all(bind=engine)
    # Build the upgraded infinite-length tables
    init_db()
    print("Database schema successfully upgraded in the cloud with infinite URL limits.")