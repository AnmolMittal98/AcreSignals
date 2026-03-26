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

# Highly Targeted Real Estate RSS Feeds
RSS_FEEDS = [
    {"name": "ET Realty - Residential", "url": "https://realty.economictimes.indiatimes.com/rss/residential"},
    {"name": "ET Realty - Commercial", "url": "https://realty.economictimes.indiatimes.com/rss/commercial"},
    {"name": "ET Realty - Infrastructure", "url": "https://realty.economictimes.indiatimes.com/rss/infrastructure"},
    {"name": "Hindustan Times - Property", "url": "https://www.hindustantimes.com/feeds/rss/real-estate/rssfeed.xml"}
]

# UPDATED PROMPT: Now asks for a JSON Array and handles silent dropping of irrelevant news.
SYSTEM_PROMPT = """
You are an expert real estate intelligence analyst specializing exclusively in the Delhi NCR property market.
Analyze the following batch of news articles and extract specific market signals.

CRITICAL RULES: 
1. Evaluate EACH article individually.
2. If an article is NOT about real estate, infrastructure, or zoning WITHIN the Delhi NCR region (Delhi, Noida, Gurgaon, Ghaziabad, Faridabad, etc.), IGNORE IT completely. Do not include it in your output array.
3. For the articles that ARE relevant, return a JSON array of objects adhering strictly to the schema below.

You must respond ONLY with a valid JSON ARRAY. Do not include markdown formatting like ```json or any conversational text.

Schema for each object in the array:
[
    {
        "batch_id": "Return the exact ID integer provided in the input prompt for this article.",
        "location": "Extract the specific micro-market in Delhi NCR. BE PRECISE. (e.g., 'Sector 150, Noida', 'Dwarka Expressway, Gurgaon').",
        "category": "Classify the event into a short label (e.g., 'Metro Extension', 'Zoning Change', 'Policy Shift', 'Commercial Leasing', 'Project Launch').",
        "impact": "Must be exactly one of: 'Positive', 'Negative', or 'Neutral'.",
        "summary": "Write exactly 2 conversational, brief sentences summarizing how this event affects local property prices. Write in a 'WhatsApp style' suitable for fast scanning. Avoid emojis."
    }
]
"""

def is_relevant_for_ncr(text: str) -> bool:
    """Zero-Cost Python Pre-Filter to save Gemini API Quota."""
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
    """Sends multiple articles to Gemini in a single prompt to save 80% on costs."""
    if not batch:
        return []

    # Construct the batch text
    articles_text = "Articles to Analyze:\n\n"
    for item in batch:
        articles_text += f"--- ARTICLE ID: {item['batch_id']} ---\n"
        articles_text += f"Headline: {item['title']}\n"
        articles_text += f"Text: {item['text']}\n\n"

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(f"{SYSTEM_PROMPT}\n{articles_text}")
        
        response_text = response.text.strip()
        
        # Clean markdown if Gemini accidentally adds it
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        results = json.loads(response_text.strip())
        
        if not isinstance(results, list):
            logging.error("Gemini did not return a JSON array as requested.")
            return []
            
        return results
        
    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON from Gemini. Response was: {response_text}")
        return []
    except Exception as e:
        logging.error(f"Gemini API Error: {str(e)}")
        return []

def fetch_and_process_feeds():
    db: Session = SessionLocal()
    
    for feed_source in RSS_FEEDS:
        logging.info(f"Fetching RSS feed from: {feed_source['name']}")
        feed = feedparser.parse(feed_source['url'])
        
        current_batch = []
        
        for entry in feed.entries[:15]: # Process top 15 from each feed
            # 1. Skip if already in DB
            exists = db.query(MarketSignal).filter(MarketSignal.source_url == entry.link).first()
            if exists:
                continue
                
            article_text = entry.summary if hasattr(entry, 'summary') else entry.title
            full_text_to_check = f"{entry.title} {article_text}"
            
            # 2. Python Pre-filter (Costs 0 Quota)
            if not is_relevant_for_ncr(full_text_to_check):
                continue
            
            # 3. Add to batch
            current_batch.append({
                "batch_id": len(current_batch), # 0, 1, 2, 3, 4
                "title": entry.title,
                "text": article_text,
                "url": entry.link,
                "source_name": feed_source['name'],
                "published_parsed": entry.published_parsed if hasattr(entry, 'published_parsed') else None
            })
            
            # 4. If batch hits 5, process it to save costs
            if len(current_batch) == 5:
                logging.info(f"Processing full batch of 5 articles...")
                process_and_save_batch(db, current_batch)
                current_batch = [] # Reset batch
                time.sleep(15) # Safety pause for API limits
                
        # Process any remaining articles in the feed that didn't make a full 5
        if len(current_batch) > 0:
            logging.info(f"Processing final batch of {len(current_batch)} articles...")
            process_and_save_batch(db, current_batch)
            time.sleep(15)

    db.close()
    logging.info("RSS Feed processing cycle complete.")

def process_and_save_batch(db: Session, batch: list):
    """Helper function to send the batch and save the results."""
    ai_results = process_batch_with_gemini(batch)
    
    for result in ai_results:
        try:
            # Match the AI result back to the original article data using the batch_id
            batch_id = int(result.get('batch_id', -1))
            if batch_id < 0 or batch_id >= len(batch):
                continue
                
            original_article = batch[batch_id]
            
            # Format impact
            impact_enum = ImpactLevel.NEUTRAL
            impact_str = result.get('impact', '').capitalize()
            if impact_str in [item.value for item in ImpactLevel]:
                impact_enum = ImpactLevel(impact_str)

            # Format Date
            pub_date = datetime.utcnow()
            if original_article['published_parsed']:
                pub_date = datetime.fromtimestamp(mktime(original_article['published_parsed']))

            # Save to Database
            new_signal = MarketSignal(
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
            logging.info(f"🟢 Saved curated signal for: {new_signal.location}")
            
        except Exception as db_error:
            db.rollback()
            logging.error(f"Database insertion failed for a batch item: {str(db_error)}")

if __name__ == "__main__":
    fetch_and_process_feeds()