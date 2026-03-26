from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import SessionLocal, MarketSignal, GovernmentCircular
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/signals")
def get_signals():
    db = SessionLocal()
    try:
        signals = db.query(MarketSignal).order_by(MarketSignal.published_at.desc()).limit(50).all()
        return signals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/api/circulars")
def get_circulars():
    db = SessionLocal()
    try:
        # Fetch up to 20 circulars
        circulars = db.query(GovernmentCircular).order_by(GovernmentCircular.published_date.desc()).limit(20).all()
        
        # Explicitly format as a dictionary so JavaScript can read it perfectly
        formatted_circulars = []
        for c in circulars:
            formatted_circulars.append({
                "source_name": c.source_name,
                "title": c.title,
                "url": c.url,
                "published_date": c.published_date.isoformat() if c.published_date else None
            })
        return formatted_circulars
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(base_dir, "frontend") 
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")