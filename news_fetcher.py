import os
import json
import logging
import time
from datetime import datetime
from time import mktime
import feedparser
import google.generativeai as genai
from sqlalchemy.orm import Session
from database import SessionLocal, MarketSignal, ImpactLevel
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Critical Error: GEMINI_API_KEY is missing from environment variables.")

genai.configure(api_key=GEMINI_API_KEY)

# THE "WIDER NET": 11 Highly Targeted Feeds
RSS_FEEDS = [
    {"name": "ET Realty - Residential", "url": "https://realty.economictimes.indiatimes.com/rss/residential"},
    {"name": "ET Realty - Commercial", "url": "https://realty.economictimes.indiatimes.com/rss/commercial"},
    {"name": "ET Realty - Infrastructure", "url": "https://realty.economictimes.indiatimes.com/rss/infrastructure"},
    {"name": "Hindustan Times - Property", "url": "https://www.hindustantimes.com/feeds/rss/real-estate/rssfeed.xml"},
    {"name": "Moneycontrol - Real Estate", "url": "https://www.moneycontrol.com/rss/realestate.xml"},
    {"name": "Financial Express - Real Estate", "url": "https://www.financialexpress.com/money/real-estate/feed/"},
    {"name": "Google News - Noida RERA", "url": "https://news.google.com/rss/search?q=noida+rera+real+estate&hl=en-IN&gl=IN&ceid=IN:en"},
    {"name": "Google News - Dwarka Expressway", "url": "https://news.google.com/rss/search?q=dwarka+expressway+property&hl=en-IN&gl=IN&ceid=IN:en"},
    {"name": "Google News - Yamuna Expressway", "url": "https://news.google.com/rss/search?q=yamuna+expressway+land+acquisition&hl=en-IN&gl=IN&ceid=IN:en"},
    {"name": "Google News - Gurgaon Real Estate", "url": "https://news.google.com/rss/search?q=gurgaon+real+estate&hl=en-IN&gl=IN&ceid=IN:en"},
    {"name": "Google News - Delhi DDA", "url": "https://news.google.com/rss/search?q=dda+delhi+real+estate&hl=en-IN&gl=IN&ceid=IN:en"}
]

SYSTEM_PROMPT = """
You are an elite real estate intelligence analyst for the Delhi NCR market (Delhi, Noida, Gurgaon, Yamuna Expressway). 
Analyze this batch of news articles. If an article is NOT about NCR real estate, IGNORE IT completely.

For relevant articles, return a JSON array. Follow this strict schema:
[
    {
        "batch_id": "Exact ID integer provided in the input.",
        "headline": "A punchy, 4-6 word financial broadsheet headline (e.g., 'DDA Offers 25% Flat Discount' or 'Accenture Leases 1.65L SqFt').",
        "location": "Hyper-local market (e.g., 'Sector 150, Noida', 'SPR, Gurgaon').",
        "category": "Use one: 'Infrastructure', 'Policy Shift', 'Commercial', 'Residential', 'Land Acquisition'.",
        "impact": "Must be exactly: 'Positive', 'Negative', or 'Neutral'.",
        "summary": "Write exactly 2 crisp, financial-broadsheet style sentences. Sentence 1: The core fact (who/what/where). Sentence 2: The direct impact on local property yields, rental demand, or capital appreciation. NO fluff. NO emojis. Be clinical and authoritative."
    }
]
"""

def is_relevant_for_ncr(text: str) -> bool:
    """Zero-Cost Python Pre-Filter."""
    text = text.lower()
    target_keywords = [
        'delhi', 'ncr', 'new delhi', 'noida', 'gurgaon', 'gurugram', 
        'faridabad', 'ghaziabad', 'greater noida', 'sonipat', 'meerut',
        'rohtak', 'manesar', 'bhiwadi', 'sohna', 'palwal',
        'jewar', 'dwarka expressway', 'yamuna expressway', 'okhla',
        'vasant vihar', 'dlf', 'aerocity', 'golf course road', 'spr',
        'southern peripheral road', 'npr', 'kmp expressway',
        'rera', 'up rera', 'hrera', 'dda', 'gmda', 'noida authority', 
        'yeida', 'gnida', 'dtcp', 'mcd', 'ndmc'
    ]
    return any(keyword in text for keyword in target_keywords)

def process_batch_with_gemini(batch: list) -> list:
    if not batch:
        return []

    articles_text = "Articles to Analyze:\n\n"
    for item in batch:
        articles_text += f"--- ARTICLE ID: {item['batch_id']} ---\n"
        articles_text += f"Headline: {item['title']}\n"
        articles_text += f"Text: {item['text']}\n\n"

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        
        # UPGRADE: Force Native JSON Mode to prevent formatting crashes
        response = model.generate_content(
            f"{SYSTEM_PROMPT}\n{articles_text}",
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        raw_text = response.text.strip()
        
        # UPGRADE: Bulletproof markdown stripping
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
        if raw_text.endswith("```"):
            raw_text = raw_text.rsplit("\n", 1)[0]
        raw_text = raw_text.strip()
        
        if not raw_text:
            logging.warning("Gemini returned an empty string (likely safety filter triggered).")
            return []
            
        # UPGRADE: strict=False ignores invisible control characters
        results = json.loads(raw_text, strict=False)
        
        if not isinstance(results, list):
            logging.error("Gemini returned JSON, but not an array as expected.")
            return []
            
        return results
        
    except json.JSONDecodeError as e:
        logging.error(f"Failed to decode JSON from Gemini. Error: {e}\nRaw Text Preview: {raw_text[:100]}")
        return []
    except Exception as e:
        logging.error(f"Gemini API Error: {str(e)}")
        return []

def fetch_and_process_feeds():
    db: Session = SessionLocal()
    MAX_DAYS_OLD = 15 
    
    for feed_source in RSS_FEEDS:
        logging.info(f"Fetching RSS feed from: {feed_source['name']}")
        try:
            feed = feedparser.parse(feed_source['url'])
        except Exception as e:
            logging.error(f"Failed to parse feed {feed_source['name']}: {e}")
            continue
        
        current_batch = []
        
        for entry in feed.entries[:25]:
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                pub_date = datetime.fromtimestamp(mktime(entry.published_parsed))
                days_old = (datetime.utcnow() - pub_date).days
                if days_old > MAX_DAYS_OLD:
                    continue 
            
            exists = db.query(MarketSignal).filter(MarketSignal.source_url == entry.link).first()
            if exists:
                continue
                
            article_text = entry.summary if hasattr(entry, 'summary') else entry.title
            full_text_to_check = f"{entry.title} {article_text}"
            
            if not is_relevant_for_ncr(full_text_to_check):
                continue
            
            current_batch.append({
                "batch_id": len(current_batch),
                "title": entry.title,
                "text": article_text,
                "url": entry.link,
                "source_name": feed_source['name'],
                "published_parsed": entry.published_parsed if hasattr(entry, 'published_parsed') else None
            })
            
            if len(current_batch) >= 20:
                logging.info(f"Processing batch of {len(current_batch)} articles...")
                process_and_save_batch(db, current_batch)
                current_batch = []
                time.sleep(20) 
                
        if len(current_batch) > 0:
            logging.info(f"Processing final batch of {len(current_batch)} articles...")
            process_and_save_batch(db, current_batch)
            time.sleep(20)

    db.close()
    logging.info("RSS Feed processing cycle complete.")

def process_and_save_batch(db: Session, batch: list):
    ai_results = process_batch_with_gemini(batch)
    
    for result in ai_results:
        try:
            batch_id = int(result.get('batch_id', -1))
            if batch_id < 0 or batch_id >= len(batch):
                continue
                
            original_article = batch[batch_id]
            
            impact_enum = ImpactLevel.NEUTRAL
            impact_str = result.get('impact', '').capitalize()
            if impact_str in [item.value for item in ImpactLevel]:
                impact_enum = ImpactLevel(impact_str)

            pub_date = datetime.utcnow()
            if original_article['published_parsed']:
                pub_date = datetime.fromtimestamp(mktime(original_article['published_parsed']))

            new_signal = MarketSignal(
                headline=result.get('headline', 'Market Update'), 
                location=result.get('location', 'Delhi NCR'),
                category=result.get('category', 'Market Update'),
                impact=impact_enum,
                summary=result.get('summary', 'Market conditions are evolving. Check source for details.'),
                source_url=original_article['url'],
                source_name=original_article['source_name'],
                published_at=pub_date
            )
            db.add(new_signal)
            db.commit()
            logging.info(f"🟢 Saved curated signal for: {new_signal.headline}")
            
        except Exception as db_error:
            db.rollback()
            logging.error(f"Database insertion failed for a batch item: {str(db_error)}")

if __name__ == "__main__":
    fetch_and_process_feeds()