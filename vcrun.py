#!/usr/bin/env python3
"""
VC Email Outreach Automation
Loads contacts from CSV/Excel files, generates personalized emails using Azure OpenAI,
and sends via Gmail API with rate limiting and progress tracking.
"""

import os
import pandas as pd
import time
from datetime import datetime
from pathlib import Path
import json
import argparse
import requests
from bs4 import BeautifulSoup
from openai import AzureOpenAI
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64
import pickle
import re
import hashlib

# ============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================================================

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = "https://panopticon.cognitiveservices.azure.com/"  # Update this
AZURE_OPENAI_API_KEY = "aefad978082243b2a79e279b203efc29"  # Update this
AZURE_OPENAI_DEPLOYMENT = "gpt-5-nano"  # Your deployment name
AZURE_OPENAI_API_VERSION = "2024-04-01-preview"

# File Paths (iCloud Drive)
BASE_PATH = Path("h:/iCloud/iCloudDrive/Business Ventures Main/The Utility Company/The Graine Ledger/Ledger1")
CSV_FILE = BASE_PATH / "deliverable-filtered-test_Web3CryptoInvestors_emails.csv"
XLSX_FILE_1 = BASE_PATH / "Web3Crypto Investors_emails.xlsx"
XLSX_FILE_2 = BASE_PATH / "Web3Crypto Investors_names & phones.xlsx"
LOG_FILE = BASE_PATH / "sent_emails_log.csv"
# Optional override via environment variable (absolute or relative path)
LOG_FILE_ENV = os.getenv('SENT_LOG_PATH')
if LOG_FILE_ENV:
    LOG_FILE = Path(LOG_FILE_ENV)

# Gmail API Configuration
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send']
GMAIL_TOKEN_FILE = 'gmail_token.pickle'
GMAIL_CREDENTIALS_FILE = 'gmail_credentials.json'  # Download from Google Cloud Console

# Email Settings
DAILY_LIMIT = 2400  # Maximum emails per day
EMAILS_PER_HOUR = 100  # Rate limit
SECONDS_BETWEEN_EMAILS = 0  # 3600 / 50 = 72 seconds

# Test Mode Settings
TEST_EMAIL = "founders@theutilitycompany.co"  # Email to use in test mode

# Links
INVESTOR_PORTAL_LINK = "https://stack.angellist.com/s/lp1srl5cnf"
DATA_ROOM_LINK = "https://stack.angellist.com/s/x8g9yjgpbw"
PORTALPAY_LINK = "https://pay.ledger1.ai"
CALENDAR_LINK = "https://calendar.app.google/EJ4WsqeS2JSXt6ZcA"
# Google Apps Script Web App URL that updates a Google Sheet and returns a 1x1 pixel
# Example: https://script.google.com/macros/s/AKfycb.../exec
TRACKING_PIXEL_URL = 'https://script.google.com/macros/s/AKfycbzrcA4iT15y1WU01iFgGCZRq-gWTJZu8WQePEj9wu34Q8UCrzfBB-JI_7552fch4Aruvw/exec'

# Your Company Info (for CAN-SPAM compliance)
COMPANY_NAME = "The Utility Company LLC"
COMPANY_ADDRESS = "1005 Wellesley Dr. SE"
COMPANY_CITY_STATE_ZIP = "Albuquerque, NM 87106"

# ============================================================================
# GMAIL API SETUP
# ============================================================================

def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None
    
    # Load existing token
    if os.path.exists(GMAIL_TOKEN_FILE):
        with open(GMAIL_TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    
    # If no valid credentials, authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                GMAIL_CREDENTIALS_FILE, GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save credentials
        with open(GMAIL_TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    
    return build('gmail', 'v1', credentials=creds)

# ============================================================================
# DATA LOADING AND PROCESSING
# ============================================================================

def load_and_consolidate_contacts():
    """Load all contact files and consolidate into single deduplicated list."""
    print("Loading contact files...")
    
    contacts = []
    
    # Load CSV file
    try:
        df1 = pd.read_csv(CSV_FILE)
        contacts.append(df1)
        print(f"  Loaded {len(df1)} contacts from CSV")
    except Exception as e:
        print(f"  Warning: Could not load CSV file: {e}")
    
    # Load Excel file 1
    try:
        df2 = pd.read_excel(XLSX_FILE_1)
        contacts.append(df2)
        print(f"  Loaded {len(df2)} contacts from XLSX 1")
    except Exception as e:
        print(f"  Warning: Could not load XLSX 1 file: {e}")
    
    # Load Excel file 2
    try:
        df3 = pd.read_excel(XLSX_FILE_2)
        contacts.append(df3)
        print(f"  Loaded {len(df3)} contacts from XLSX 2")
    except Exception as e:
        print(f"  Warning: Could not load XLSX 2 file: {e}")
    
    # Consolidate all contacts
    if not contacts:
        raise Exception("No contact files could be loaded!")
    
    df = pd.concat(contacts, ignore_index=True)
    print(f"  Total contacts loaded: {len(df)}")
    
    # Normalize column names and extract relevant fields
    df['email'] = df['Email'].str.lower().str.strip()
    df['name'] = df['Primary Contact'].fillna(df.get('Contact', '')).fillna(df.get('Investors', ''))
    df['firm'] = df.get('Investors', '')
    df['title'] = df.get('Primary Contact Title', df.get('Title', ''))
    df['type'] = df.get('Type', '')
    df['location'] = df.get('Location', '')
    df['disposable'] = df.get('disposable', False)
    df['result'] = df.get('result', '')
    
    # Filter out invalid emails
    print("Filtering contacts...")
    initial_count = len(df)
    
    # Remove rows without email
    df = df[df['email'].notna() & (df['email'] != '')]
    print(f"  Removed {initial_count - len(df)} contacts without email")
    
    # Remove disposable emails
    df = df[df['disposable'] != 'TRUE']
    df = df[df['disposable'] != True]
    print(f"  Removed disposable emails, {len(df)} remaining")
    
    # Remove undeliverable
    df = df[df['result'] != 'undeliverable']
    print(f"  Removed undeliverable emails, {len(df)} remaining")
    
    # Deduplicate by email (keep first)
    df = df.drop_duplicates(subset=['email'], keep='first')
    print(f"  After deduplication: {len(df)} unique contacts")
    
    return df

def load_sent_log():
    """Load the log of already-sent emails."""
    if LOG_FILE.exists():
        try:
            df = pd.read_csv(LOG_FILE)
            return set(df['email'].str.lower().str.strip())
        except Exception as e:
            print(f"Warning: Could not load sent log: {e}")
            return set()
    return set()

def log_sent_email(email, name, firm, timestamp, message_id=None):
    """Append sent email to log file."""
    # Ensure parent directory exists
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Warning: Could not ensure log directory for {LOG_FILE}: {e}")
    log_entry = pd.DataFrame([{
        'email': email,
        'name': name,
        'firm': firm,
        'timestamp': timestamp,
        'status': 'sent',
        'message_id': message_id or ''
    }])
    
    if LOG_FILE.exists():
        log_entry.to_csv(LOG_FILE, mode='a', header=False, index=False)
    else:
        log_entry.to_csv(LOG_FILE, index=False)

def print_sent_report():
    """Print a simple tracking report from sent_emails_log.csv."""
    if not LOG_FILE.exists():
        print(f"No sent_emails_log.csv found at: {LOG_FILE}")
        return

    try:
        df = pd.read_csv(LOG_FILE)
    except Exception as e:
        print(f"Error reading log: {e}")
        return

    # Normalize and derive fields
    if 'timestamp' in df.columns:
        df['date'] = pd.to_datetime(df['timestamp'], errors='coerce').dt.date

    total = len(df)
    unique_recipients = df['email'].dropna().nunique() if 'email' in df.columns else 0
    unique_msgids = df['message_id'].dropna().nunique() if 'message_id' in df.columns else 0

    print("==== SENT EMAILS REPORT ====")
    print(f"Total rows: {total}")
    print(f"Unique recipients: {unique_recipients}")
    print(f"Unique Gmail message IDs: {unique_msgids}")

    # Per-day counts (latest 10)
    if 'date' in df.columns:
        per_day = df.groupby('date').size().reset_index(name='count').sort_values('date', ascending=False)
        print("\nSent per day (latest 10):")
        for _, row in per_day.head(10).iterrows():
            print(f"  {row['date']}: {row['count']}")

    # Top recipient domains
    if 'email' in df.columns:
        domains = df['email'].dropna().str.split('@').str[1]
        top_domains = domains.value_counts().head(5)
        print("\nTop recipient domains:")
        for dom, cnt in top_domains.items():
            print(f"  {dom}: {cnt}")

    # Recent 10
    print("\nRecent 10 sent:")
    cols = [c for c in ['timestamp', 'email', 'name', 'firm', 'message_id'] if c in df.columns]
    for _, r in df.tail(10)[cols].iterrows():
        ts = r.get('timestamp', '')
        em = r.get('email', '')
        nm = r.get('name', '')
        fm = r.get('firm', '')
        mid = r.get('message_id', '')
        print(f"  {ts} | {em} | {nm} | {fm} | {mid}")

# ============================================================================
# COMPANY RESEARCH
# ============================================================================

def scrape_website_info(url, debug=False):
    """Scrape basic information from a website."""
    try:
        if debug:
            print(f"  DEBUG: Scraping website: {url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            info_parts = []
            
            # Try to get meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                info_parts.append(meta_desc.get('content'))
                if debug:
                    print(f"  DEBUG: Found meta description")
            
            # Try og:description
            og_desc = soup.find('meta', property='og:description')
            if og_desc and og_desc.get('content'):
                desc = og_desc.get('content')
                if desc not in info_parts:
                    info_parts.append(desc)
                    if debug:
                        print(f"  DEBUG: Found og:description")
            
            # Look for about/description sections
            about_keywords = ['about', 'mission', 'who we are', 'what we do', 'overview']
            for keyword in about_keywords:
                # Try headings
                headings = soup.find_all(['h1', 'h2', 'h3'], string=re.compile(keyword, re.IGNORECASE))
                for heading in headings[:1]:  # Just first match
                    # Get next paragraph
                    next_p = heading.find_next('p')
                    if next_p:
                        text = next_p.get_text(strip=True)
                        if len(text) > 50 and text not in info_parts:
                            info_parts.append(text)
                            if debug:
                                print(f"  DEBUG: Found about section via heading")
                            break
            
            # If still nothing, get first few meaningful paragraphs
            if not info_parts:
                paragraphs = soup.find_all('p')
                for p in paragraphs[:5]:
                    text = p.get_text(strip=True)
                    # Filter out short paragraphs and common noise
                    if (len(text) > 100 and 
                        'cookie' not in text.lower() and 
                        'privacy' not in text.lower() and
                        'copyright' not in text.lower()):
                        info_parts.append(text)
                        if debug:
                            print(f"  DEBUG: Found content paragraph")
                        if len(info_parts) >= 2:
                            break
            
            if info_parts:
                # Combine and limit length
                combined = ' '.join(info_parts[:2])
                # Limit to ~500 chars
                if len(combined) > 500:
                    combined = combined[:497] + '...'
                return combined
        
        return None
    
    except Exception as e:
        if debug:
            print(f"  DEBUG: Website scraping error: {str(e)}")
        return None

def lookup_company_info(firm_name, email, debug=False):
    """Look up company information using DuckDuckGo search and direct website scraping."""
    
    # Extract domain from email
    domain = ""
    company_name = ""
    if email and '@' in email:
        domain = email.split('@')[1]
        # Extract company name from domain (e.g., amecloudventures.com -> AME Cloud Ventures)
        company_name = domain.split('.')[0]
    
    # Determine search query priority:
    # 1. Use domain-based company name if firm_name is missing, empty, or same as contact name
    # 2. Otherwise use firm_name
    if not firm_name or str(firm_name).lower() == 'nan' or len(str(firm_name).strip()) == 0:
        search_query = f"{company_name} venture capital" if company_name else domain
    else:
        # Check if firm name looks like a person's name (has only 2-3 words, all capitalized)
        words = str(firm_name).split()
        if len(words) <= 3 and all(w[0].isupper() for w in words if w):
            # Likely a person's name, use domain instead
            search_query = f"{company_name} venture capital" if company_name else domain
        else:
            search_query = f"{firm_name} venture capital"
    
    if debug:
        print(f"  DEBUG: Search query: {search_query}")
        print(f"  DEBUG: Domain: {domain}")
    
    if not search_query:
        return "No company information available."
    
    company_info_parts = []
    
    try:
        # Use DuckDuckGo instant answer API
        url = f"https://api.duckduckgo.com/?q={requests.utils.quote(search_query)}&format=json"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('AbstractText'):
                company_info_parts.append(data['AbstractText'])
            
            if data.get('Abstract') and data['Abstract'] != data.get('AbstractText'):
                company_info_parts.append(data['Abstract'])
            
            # Get related topics
            if data.get('RelatedTopics'):
                for topic in data['RelatedTopics'][:2]:
                    if isinstance(topic, dict) and topic.get('Text'):
                        company_info_parts.append(topic['Text'])
        
        # Try alternative search with just the domain/company name
        if not company_info_parts and company_name:
            if debug:
                print(f"  DEBUG: Trying alternative search with company name")
            alt_url = f"https://api.duckduckgo.com/?q={requests.utils.quote(company_name)}&format=json"
            alt_response = requests.get(alt_url, headers=headers, timeout=10)
            
            if alt_response.status_code == 200:
                alt_data = alt_response.json()
                if alt_data.get('AbstractText'):
                    company_info_parts.append(alt_data['AbstractText'])
        
        # If DuckDuckGo didn't return anything, try scraping the website directly
        if not company_info_parts and domain:
            if debug:
                print(f"  DEBUG: DuckDuckGo found nothing, attempting direct website scrape")
            
            # Try both https and http
            for protocol in ['https', 'http']:
                website_url = f"{protocol}://{domain}"
                scraped_info = scrape_website_info(website_url, debug=debug)
                if scraped_info:
                    company_info_parts.append(scraped_info)
                    break
            
            # Also try www subdomain
            if not company_info_parts:
                for protocol in ['https', 'http']:
                    website_url = f"{protocol}://www.{domain}"
                    scraped_info = scrape_website_info(website_url, debug=debug)
                    if scraped_info:
                        company_info_parts.append(scraped_info)
                        break
        
        # Compile company info
        if company_info_parts:
            company_info = ' '.join(company_info_parts[:2])  # Use first 2 pieces
            if debug:
                print(f"  DEBUG: Successfully gathered company info ({len(company_info)} chars)")
            return company_info
        else:
            if debug:
                print(f"  DEBUG: No info found from any source")
            return f"Venture capital firm at {domain}"
    
    except Exception as e:
        if debug:
            print(f"  DEBUG: Company lookup error: {str(e)}")
        return f"Venture capital firm at {domain}"

# ============================================================================
# EMAIL GENERATION AND SENDING
# ============================================================================

def generate_personalized_email(contact, azure_client, company_info="", debug=False):
    """Generate personalized email using Azure OpenAI."""
    
    if debug:
        print(f"  DEBUG: Contact details:")
        print(f"    Name: {contact['name']}")
        print(f"    Firm: {contact['firm']}")
        print(f"    Title: {contact['title']}")
        print(f"    Type: {contact['type']}")
        print(f"    Location: {contact['location']}")
        if company_info:
            print(f"    Company Info: {company_info[:100]}...")
    
    company_context = f"\n\nCompany Research:\n{company_info}\n" if company_info else ""
    
    # Extract potential preferred name from email
    email_username = contact['email'].split('@')[0] if '@' in contact['email'] else ''
    
    # STRUCTURED PROMPT: Persona prompt for Krishna Patel; return JSON with subject/body (plain text only)
    prompt = f"""Persona:
You are Krishna Patel — Founder of The Utility Company (TUC) and creator of PortalPay. Write entirely in first person (I/me) as Krishna; never refer to yourself in third person. Your voice is principled builder, analytical and candid, confident but not salesy.

Goal:
Craft a personalized VC outreach email about PortalPay tailored to the recipient, using any available firm/company research.

Voice and Style:
- Narrative, insight-driven prose; no section headings or bullet points in the email body.
- Avoid phrases like “Founder note”.
- Be concise, confident, and specific; show operator depth and strategic clarity.

PortalPay Briefing (context for personalization):
- Crypto-native payment gateway enabling physical merchants to accept stablecoins and crypto tokens at checkout via QR scan; on-chain settlement that’s transparent and efficient.
- Innovations:
  • Multi-Token Infrastructure: USDC, USDT, cbBTC, cbXRP, ETH on Base
  • Cost Revolution: 2–3% savings vs card rails via on-chain settlement
  • Instant Settlement: Real-time finality (no 2–3 day delays)
  • White-Label Platform: Fully branded portals, custom theming, receipt personalization
  • Smart Treasury: Configurable token mixes with intelligent rotation
  • Programmable Revenue: On-chain revenue splits for partners/franchises
  • Real-Time Intelligence: Live tracking, USD volume analytics, trend insights
  • Global by Default: Borderless stablecoin settlement eliminates FX friction
- Opportunity: Horizontal platform play attacking 2.5–3.5% payment processing drag across physical POS; $100B+ addressable market.
- Tech stack: Thirdweb SDK, Base network, Next.js, Azure Cosmos DB, liquid glass morphism UI
- Traction: Live merchants, white-label ready, comprehensive API docs, multi-chain roadmap (Solana, Polygon, Arbitrum)

Meeting Preferences (embed naturally in CTA):
- I am based in Santa Fe, New Mexico.
- I’m available for remote meetings with all investors.
- In-person meetings only if you’re in Albuquerque or Santa Fe, NM.

Contact:
- Name: {contact['name']}
- Firm: {contact['firm']}
- Email Username: {email_username}
- Title: {contact['title']}
- Investment Type: {contact['type']}
- Location: {contact['location']}

Company Research (optional):
{company_info if company_info else "N/A"}

Requirements:
- Output JSON ONLY with keys "subject" and "body". Example: {{"subject":"...","body":"..."}}
- Body MUST be plain text (no HTML, signature, resources section, footers, or disclaimers).
- Length: 250–300 words.
- Open with a hook tied to their thesis/portfolio using available research.
- Personalize: connect PortalPay’s value to their focus; demonstrate homework.
- Use preferred nickname if the email username or research suggests one.
- Maintain first-person voice throughout (I/me). No third-person references to Krishna. No “Founder note”.
- No explicit headings; write as natural prose paragraphs.
- End with a confident CTA that mentions remote availability and the Santa Fe location.

Return EXACTLY this JSON object:
{{
  "subject": "<compelling personalized subject>",
  "body": "<plain text body with paragraph breaks>"
}}"""
    
    try:
        if debug:
            print(f"  DEBUG: Calling Azure OpenAI with model: {AZURE_OPENAI_DEPLOYMENT}")
            print(f"  DEBUG: API Version: {AZURE_OPENAI_API_VERSION}")
            print(f"  DEBUG: Endpoint: {AZURE_OPENAI_ENDPOINT}")
        
        response = azure_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "You are Krishna Patel (Founder of The Utility Company; creator of PortalPay). Write all outreach emails AS YOURSELF in first person (I/me) — never third person. Return structured JSON with keys 'subject' and 'body' only. Do not include HTML, signatures, resources sections, or disclaimers."
                },
                {"role": "user", "content": prompt}
            ],
            # temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        if debug:
            print(f"  DEBUG: Response received successfully")
            print(f"  DEBUG: Response content length: {len(response.choices[0].message.content)}")
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"  ERROR: Failed to generate email")
        print(f"  ERROR Type: {type(e).__name__}")
        print(f"  ERROR Message: {str(e)}")
        
        # Print more detailed error information
        import traceback
        if debug:
            print(f"  DEBUG: Full traceback:")
            traceback.print_exc()
        
        return None

def parse_email_content(generated_text):
    """Parse subject and body from LLM output. Prefer JSON; fallback to 'Subject:' header parsing."""
    # Try JSON first
    try:
        obj = json.loads(generated_text)
        subject = str(obj.get("subject", "")).strip()
        body = str(obj.get("body", "")).strip()
    except Exception:
        # Fallback: parse a 'Subject:' line followed by body
        lines = generated_text.split('\n')
        subject = ""
        body_lines = []
        found_subject = False
        
        for line in lines:
            if line.lower().startswith('subject:'):
                subject = line.replace('Subject:', '').replace('subject:', '').strip()
                found_subject = True
            elif found_subject and line.strip():
                body_lines.append(line)
        
        body = '\n'.join(body_lines)
        # Convert to plain text by stripping any HTML tags; preserve paragraph breaks
        body = re.sub('<[^<]+?>', '', body).strip()
    
    # Defensive trimming: remove any accidental 'Resources' or instruction fragments
    safe_lines = []
    for l in body.splitlines():
        low = l.strip().lower()
        if "founder note" in low:
            break
        if low == 'resources' or low.startswith('resources') or low.startswith('remember:'):
            break
        if l.strip():
            safe_lines.append(l.strip())
    body = '\n'.join(safe_lines).strip()
    
    if not subject:
        subject = "Exploring Partnership Opportunities"
    return subject, body

def contains_awkward_founder_note(text: str) -> bool:
    """Detects awkward 'Founder note' sections or third-person references to Krishna."""
    low = text.lower()
    triggers = [
        "founder note",
        "founder note and next steps",
        "krishna patel is",
        "krishna is",
        "the founder is",
    ]
    return any(t in low for t in triggers)

def fix_awkward_founder_references(text: str) -> str:
    """Remove 'Founder note' headings and convert third-person references to first person."""
    s = text
    # Remove headings like 'Founder note:' or 'Founder note and next steps:'
    s = re.sub(r'(?i)\bfounder note(?: and next steps)?:\s*', '', s)
    # Convert common third-person phrases to first person
    s = re.sub(r'(?i)\bkrishna patel is\b', 'I am', s)
    s = re.sub(r'(?i)\bkrishna is\b', 'I am', s)
    s = re.sub(r'(?i)\bkrishna would\b', 'I would', s)
    s = re.sub(r'(?i)\bkrishna can\b', 'I can', s)
    # Normalize whitespace
    s = re.sub(r'\n{3,}', '\n\n', s).strip()
    return s

def add_compliance_footer(body):
    """Add CAN-SPAM compliant unsubscribe footer as a distinct footer outside the signature container.

    - If HTML is detected, inserts a styled footer block right before </body> (or </html>),
      ensuring it appears after the signature table and not inside it.
    - If no HTML is detected, falls back to appending a plain-text footer.
    """
    footer_text = f"""To unsubscribe from future emails, please reply with "UNSUBSCRIBE" in the subject line.

{COMPANY_NAME}
{COMPANY_ADDRESS}
{COMPANY_CITY_STATE_ZIP}"""

    # Inline-styled HTML block for broad email client compatibility
    footer_html = f'''<div style="margin-top:24px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280;">
<p style="margin:0 0 6px 0;">To unsubscribe from future emails, please reply with "UNSUBSCRIBE" in the subject line.</p>
<p style="margin:0;">{COMPANY_NAME}<br>{COMPANY_ADDRESS}<br>{COMPANY_CITY_STATE_ZIP}</p>
</div>'''

    try:
        lower = body.lower()
        if '</body>' in lower:
            idx = lower.rfind('</body>')
            return body[:idx] + footer_html + body[idx:]
        if '</html>' in lower:
            idx = lower.rfind('</html>')
            return body[:idx] + footer_html + body[idx:]
    except Exception:
        # If anything goes wrong, just fall back to plain text append
        pass

    # Fallback for plain text or malformed HTML: append with spacing
    return body + "\n\n" + footer_text

# Fixed HTML signature appended to every email (do not rely on LLM to generate signatures)
SIGNATURE_HTML = '''<table cellpadding="0" cellspacing="0" border="0" class="signature-table" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #ffffff 0%, #fafcff 25%, #f0f8ff 50%, #e6f3ff 75%, #ffffff 100%); border-radius: 16px; border: 2px solid rgba(245, 64, 41, 0.2); box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(245, 64, 41, 0.25); margin-top: 32px; width: 100%; max-width: 400px;">
<tbody>
<tr>
<td style="padding: 0;">
<div style="height: 4px; background: linear-gradient(90deg, rgb(245, 64, 41) 0%, rgba(245, 64, 41, 0.7) 50%, rgb(245, 64, 41) 100%);"></div>
<div style="padding: 24px;">
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
<tbody>
<tr>
<td style="vertical-align: top; padding-right: 18px;">
<img src="https://portalpay-b6hqctdfergaadct.z02.azurefd.net/portalpay/uploads/ff16c746-88ae-4727-b066-f0426664d493.png" width="80" height="80" alt="Founder" style="display: block; padding-bottom: 1px;">
<img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TUC.png" width="80" height="80" alt="TUC" style="display: block;">
</td>
<td style="vertical-align: top;">
<h1 style="margin: 0; font-size: 24px; color: rgb(245, 64, 41); font-weight: 700; letter-spacing: -0.5px;">Krishna Patel</h1>
<p style="margin: 4px 0; font-size: 16px; color: rgba(245, 64, 41, 0.8); font-weight: 600;">Founder</p>
<p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d; font-weight: 500;">The Utility Company</p>
<p style="margin: 0 0 12px 0; font-size: 13px; color: #6a7c8d; font-style: italic; border-left: 4px solid rgb(245, 64, 41); padding-left: 12px; background: linear-gradient(90deg, rgba(245, 64, 41, 0.05) 0%, transparent 100%); border-radius: 0 4px 4px 0; padding-top: 4px; padding-bottom: 4px;">Simple Choices. Complex Outcomes.</p>

<div style="background: linear-gradient(90deg, rgb(245, 64, 41) 0%, rgba(245, 64, 41, 0.5) 70%, transparent 100%); height: 3px; margin: 8px 0; width: 120px; border-radius: 2px;"></div>

<div style="margin: 8px 0; padding: 8px; background: linear-gradient(145deg, rgba(245, 64, 41, 0.03) 0%, rgba(245, 64, 41, 0.08) 100%); border-radius: 8px; border: 1px solid rgba(245, 64, 41, 0.1);">
<p style="margin: 2px 0; font-size: 13px; font-weight: 500;">
<img src="https://storage.googleapis.com/tgl_cdn/images/symbols/mail.png" width="16" height="16" alt="Email" style="display: inline-block; vertical-align: middle; margin-right: 6px; filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%);"> <a href="mailto:founders@theutilitycompany.co" style="color: rgb(245, 64, 41); text-decoration: none; font-weight: 600;">founders@theutilitycompany.co</a>
</p>
<p style="margin: 2px 0; font-size: 13px; font-weight: 500;">
<img src="https://storage.googleapis.com/tgl_cdn/images/symbols/web.png" width="16" height="16" alt="Website" style="display: inline-block; vertical-align: middle; margin-right: 6px; filter: brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%);"> <a href="https://theutilitycompany.co" style="color: rgb(245, 64, 41); text-decoration: none; font-weight: 600;">theutilitycompany.co</a>
</p>
</div>

<div style="margin: 10px 0; padding: 6px; background: linear-gradient(135deg, rgba(245, 64, 41, 0.05) 0%, rgba(245, 64, 41, 0.1) 100%); border-radius: 10px; border: 1px solid rgba(245, 64, 41, 0.15);">
<div style="text-align: center; margin: 0; padding: 0; line-height: 0;">
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: Arial; margin: 0 auto; display: inline-table;">
<tbody>
<tr>
<td style="padding-right: 6px;"><a href="https://www.linkedin.com/in/krishna-patel-89039120/" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-linkedin-50.png" width="22" height="22" alt="LinkedIn" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://x.com/The_Utility_Co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-twitter-50.png" width="22" height="22" alt="X/Twitter" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://www.facebook.com/profile.php?id=100083624105531" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-facebook-50.png" width="22" height="22" alt="Facebook" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://www.instagram.com/theutilityco/" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-instagram-50.png" width="22" height="22" alt="Instagram" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://medium.com/@theutilityco" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-medium-50.png" width="22" height="22" alt="Medium" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://www.patreon.com/c/TheUtilityCompany" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/YouTube.png" width="22" height="22" alt="YouTube" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td><a href="https://discord.gg/q4tFymyAnx" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/Discord-Symbol-Blurple.png" height="22" alt="Discord" style="display: block; border: 0; max-width: 24px; object-fit: contain; vertical-align: middle;"></a></td>
</tr>
</tbody>
</table>
</div>
</div>

<div style="margin: 10px 0; padding: 8px; background: linear-gradient(135deg, rgba(245, 64, 41, 0.05) 0%, rgba(245, 64, 41, 0.12) 100%); border-radius: 12px; border: 2px solid rgba(245, 64, 41, 0.2); box-shadow: inset 0 2px 4px rgba(245, 64, 41, 0.1);">
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: Arial;">
<tbody>
<tr>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.arthaneeti.org" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/AR.png" width="32" height="32" alt="Arthaneeti" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/CornucopiaRobotics.png" width="32" height="32" alt="Cornucopia Robotics" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://digibazaar.io" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/DigiBazaarMedallion.png" width="32" height="32" alt="DigiBazaar" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/IE.png" width="32" height="32" alt="IE" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.rensnc.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/MKVLI.png" width="32" height="32" alt="MKVLI" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-bottom:4px"><a href="https://www.nftpd.org" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/NFTPD.png" width="32" height="32" alt="NFTPD" style="display:block;border:0;border-radius:16px;"></a></td>
</tr>
<tr>
<td style="padding-right:4px"><a href="https://osiris.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/OP.png" width="32" height="32" alt="Osiris Protocol" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.requiem-electric.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/RE.png" width="32" height="32" alt="Requiem Electric" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.thegraineledger.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TGL.png" width="32" height="32" alt="The Graine Ledger" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.thelochnessbotanicalsociety.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TLN.png" width="32" height="32" alt="Loch Ness Botanical Society" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://omgrown.life" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TSPAum1.png" width="32" height="32" alt="The Satellite Project Om" style="display:block;border:0;border-radius:16px;"></a></td>
<td><a href="https://vulcan-forge.us" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/VulcanForge2.png" width="32" height="32" alt="Vulcan Forge" style="display:block;border:0;border-radius:16px;"></a></td>
</tr>
</tbody>
</table>
</div>
</td>
</tr>
</tbody>
</table>'''

def append_signature(html: str) -> str:
    """
    Append the fixed company signature to the end of the generated HTML email body.
    If a signature-table already exists, remove it first. Insert before </body> or </html>.
    """
    try:
        cleaned = re.sub(r'<table[^>]*class="signature-table"[\s\S]*?</table>\s*', '', html, flags=re.IGNORECASE)
    except Exception:
        cleaned = html

    lower = cleaned.lower()
    body_close = '</body>'
    html_close = '</html>'
    if body_close in lower:
        idx = lower.rfind(body_close)
        return cleaned[:idx] + SIGNATURE_HTML + cleaned[idx:]
    if html_close in lower:
        idx = lower.rfind(html_close)
        return cleaned[:idx] + SIGNATURE_HTML + cleaned[idx:]
    return cleaned + SIGNATURE_HTML

def build_portalpay_email_html(
    body_text: str,
    utm_id: str = "",
    recipient_email: str = "",
    recipient_name: str = "",
    recipient_firm: str = "",
    subject: str = ""
) -> str:
    """
    Build a fixed PortalPay-styled HTML email template and fill it with body_text (plain text).
    Buttons (Resources) are fixed and styled; signature is appended separately.
    """
    PRIMARY = "#1f2937"  # PortalPay primary text color (slate-800)
    ACCENT = "#F54029"   # PortalPay accent
    FONT = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"

    paragraphs = [p.strip() for p in body_text.split("\n") if p.strip()]
    body_html = "".join([f'<p style="margin: 0 0 16px 0; font-size: 15px; color: {PRIMARY};">{p}</p>' for p in paragraphs])

    # UTM-tag links for basic click tracking
    portalpay = f"{PORTALPAY_LINK}{'?' if '?' not in PORTALPAY_LINK else '&'}utm_source=vcoutreach&utm_medium=email&utm_campaign=portalpay&utm_id={utm_id}" if utm_id else PORTALPAY_LINK
    calendar = f"{CALENDAR_LINK}{'?' if '?' not in CALENDAR_LINK else '&'}utm_source=vcoutreach&utm_medium=email&utm_campaign=portalpay&utm_id={utm_id}" if utm_id else CALENDAR_LINK
    investor = f"{INVESTOR_PORTAL_LINK}{'?' if '?' not in INVESTOR_PORTAL_LINK else '&'}utm_source=vcoutreach&utm_medium=email&utm_campaign=portalpay&utm_id={utm_id}" if utm_id else INVESTOR_PORTAL_LINK
    dataroom = f"{DATA_ROOM_LINK}{'?' if '?' not in DATA_ROOM_LINK else '&'}utm_source=vcoutreach&utm_medium=email&utm_campaign=portalpay&utm_id={utm_id}" if utm_id else DATA_ROOM_LINK

    html = f"""<!DOCTYPE html>
<html>
<head>
<style>
body {{
    font-family: {FONT};
    line-height: 1.8;
    color: {PRIMARY};
    max-width: 640px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
}}
h1, h2, h3 {{
    color: {PRIMARY};
}}
.resources {{
    margin: 28px 0 20px 0;
    padding: 20px;
    background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
    border-radius: 10px;
    border: 1px solid #e1e4e8;
}}
.resources-title {{
    font-size: 13px;
    font-weight: 600;
    color: #6b7280; /* slate-500 */
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px 0;
}}
.link-button {{
    display: inline-block;
    margin: 8px 8px 8px 0;
    padding: 10px 20px;
    background: linear-gradient(135deg, {ACCENT} 0%, #c7301e 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(245,64,41,0.20);
}}
.link-button:hover {{
    background: linear-gradient(135deg, #c7301e 0%, #a52718 100%);
    box-shadow: 0 4px 10px rgba(245,64,41,0.30);
    transform: translateY(-1px);
}}
.link-button-primary {{
    display: inline-block;
    margin: 8px 8px 8px 0;
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(16,185,129,0.25);
}}
.link-button-primary:hover {{
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 4px 12px rgba(16,185,129,0.35);
    transform: translateY(-1px);
}}

/* PortalPay themed primary button with teal border and logo support */
.link-button-portalpay {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 8px 8px 8px 0;
    height: 48px;
    padding: 0 22px;
    line-height: 1;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 10px;
    border: 2px solid #10b981; /* teal border */
    font-size: 15px;
    font-weight: 700;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(16,185,129,0.25);
    vertical-align: middle;
    box-sizing: border-box;
}}
.link-button-portalpay:hover {{
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 4px 12px rgba(16,185,129,0.35);
    transform: translateY(-1px);
}}
.button-icon {{
    width: 24px;
    height: 24px;
    display: inline-block;
    flex-shrink: 0;
    vertical-align: middle;
    align-self: center;
    margin-right: 10px;
}}
.button-icon-spacer {{
    width: 24px;
    height: 24px;
    display: inline-block;
    flex-shrink: 0;
    margin-right: 10px;
}}

.hr-soft {{
    height: 1px;
    border: none;
    background: linear-gradient(90deg, rgba(31,41,55,0.08) 0%, rgba(31,41,55,0.04) 100%);
    margin: 16px 0;
}}
</style>
</head>
<body>
{body_html}

<div class="resources">
    <div class="resources-title">Resources</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td width="50%" style="padding:6px;">
    <a href="{portalpay}" style="display:block;text-decoration:none;">
            <!-- Glass-morphism + mesh gradient button -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:
              radial-gradient(120% 140% at 15% 15%, rgba(16,185,129,0.35) 0%, rgba(5,150,105,0.22) 38%, rgba(4,120,87,0.16) 62%, rgba(3,84,63,0.12) 100%),
              linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
              linear-gradient(135deg, #0f766e 0%, #065f46 100%);
              border:2px solid #14b8a6; border-radius:16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 24px rgba(15,118,110,0.35);">
              <tr>
<td align="center" valign="middle" style="height:40px; line-height:20px; padding:0 12px; font-size:14px; font-weight:700; color:#f1f5f9; font-family: {FONT}; letter-spacing:0.2px; white-space:nowrap;">
<img src="{PORTALPAY_LINK}/ppsymbol.png" width="16" height="16" alt="PortalPay" style="vertical-align:middle; margin-right:8px;"> Explore PortalPay
                </td>
              </tr>
            </table>
          </a>
        </td>
        <td width="50%" style="padding:6px;">
          <a href="{calendar}" style="display:block;text-decoration:none;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:
              radial-gradient(120% 140% at 15% 15%, rgba(16,185,129,0.35) 0%, rgba(5,150,105,0.22) 38%, rgba(4,120,87,0.16) 62%, rgba(3,84,63,0.12) 100%),
              linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
              linear-gradient(135deg, #0f766e 0%, #065f46 100%);
              border:2px solid #14b8a6; border-radius:16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 24px rgba(15,118,110,0.35);">
              <tr>
<td align="center" valign="middle" style="height:40px; line-height:20px; padding:0 12px; font-size:14px; font-weight:700; color:#f1f5f9; font-family: {FONT}; letter-spacing:0.2px; white-space:nowrap;">
<img src="{PORTALPAY_LINK}/ppsymbol.png" width="16" height="16" alt="" style="visibility:hidden; vertical-align:middle; margin-right:8px;"> 📅 Schedule a Call
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding:6px;">
          <a href="{investor}" style="display:block;text-decoration:none;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:
              radial-gradient(120% 140% at 15% 15%, rgba(16,185,129,0.35) 0%, rgba(5,150,105,0.22) 38%, rgba(4,120,87,0.16) 62%, rgba(3,84,63,0.12) 100%),
              linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
              linear-gradient(135deg, #0f766e 0%, #065f46 100%);
              border:2px solid #14b8a6; border-radius:16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 24px rgba(15,118,110,0.35);">
              <tr>
<td align="center" valign="middle" style="height:40px; line-height:20px; padding:0 12px; font-size:14px; font-weight:700; color:#f1f5f9; font-family: {FONT}; letter-spacing:0.2px; white-space:nowrap;">
<img src="{PORTALPAY_LINK}/ppsymbol.png" width="16" height="16" alt="" style="visibility:hidden; vertical-align:middle; margin-right:8px;"> View Investor Portal
                </td>
              </tr>
            </table>
          </a>
        </td>
        <td width="50%" style="padding:6px;">
          <a href="{dataroom}" style="display:block;text-decoration:none;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:
              radial-gradient(120% 140% at 15% 15%, rgba(16,185,129,0.35) 0%, rgba(5,150,105,0.22) 38%, rgba(4,120,87,0.16) 62%, rgba(3,84,63,0.12) 100%),
              linear-gradient(120deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
              linear-gradient(135deg, #0f766e 0%, #065f46 100%);
              border:2px solid #14b8a6; border-radius:16px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 24px rgba(15,118,110,0.35);">
              <tr>
<td align="center" valign="middle" style="height:40px; line-height:20px; padding:0 12px; font-size:14px; font-weight:700; color:#f1f5f9; font-family: {FONT}; letter-spacing:0.2px; white-space:nowrap;">
<img src="{PORTALPAY_LINK}/ppsymbol.png" width="16" height="16" alt="" style="visibility:hidden; vertical-align:middle; margin-right:8px;"> Access Data Room
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>
    </table>
</div>

</body>
</html>"""
    # Append tracking pixel if configured
    try:
        if TRACKING_PIXEL_URL and utm_id:
            pixel_src = (
                f"{TRACKING_PIXEL_URL}{'?' if '?' not in TRACKING_PIXEL_URL else '&'}"
                f"utm_id={utm_id}"
                f"&u={utm_id}"  # alias for robustness
                f"&email={requests.utils.quote(recipient_email or '')}"
                f"&e={requests.utils.quote(recipient_email or '')}"  # alias for robustness
                f"&name={requests.utils.quote(recipient_name or '')}"
                f"&firm={requests.utils.quote(recipient_firm or '')}"
                f"&subject={requests.utils.quote(subject or '')}"
                f"&campaign=vcoutreach"
                f"&r={int(time.time())}"
            )
            tracking_pixel_html = f'<img src="{pixel_src}" width="1" height="1" style="display:block;max-width:1px;max-height:1px;border:0;opacity:0;" alt="">'
            html = html.replace("</body>", tracking_pixel_html + "\n</body>")
    except Exception:
        pass
    return html

def send_email_via_gmail(service, to_email, subject, body, debug=False):
    """Send email via Gmail API with HTML formatting."""
    try:
        # Create a multipart message for HTML email
        message = MIMEMultipart('alternative')
        message['to'] = to_email
        message['subject'] = subject
        
        # Create plain text version (fallback)
        # Remove HTML tags for plain text version
        plain_text = re.sub('<[^<]+?>', '', body)
        part1 = MIMEText(plain_text, 'plain')
        
        # Create HTML version
        part2 = MIMEText(body, 'html')
        
        # Attach parts (plain text first, then HTML as preferred)
        message.attach(part1)
        message.attach(part2)
        
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Send email (Gmail signature will be automatically appended if configured)
        result = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        if debug:
            print(f"  DEBUG: Email sent successfully to {to_email} (message id: {result.get('id')})")
        
        return result.get('id')
    except Exception as e:
        print(f"  ERROR: Failed to send email: {e}")
        return False

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='VC Email Outreach Automation')
    parser.add_argument('--test', action='store_true', 
                        help='Run in test mode (sends email to founders@theutilitycompany.co using first real VC)')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug mode with verbose logging')
    parser.add_argument('--dry-run', action='store_true',
                        help='Dry run: generate and assemble email but do NOT send or log')
    parser.add_argument('--report', action='store_true',
                        help='Output tracking report (reads sent_emails_log.csv) and exit')
    parser.add_argument('--log-file', type=str,
                        help='Path to write/read sent_emails_log.csv (overrides default)')
    args = parser.parse_args()
    
    global LOG_FILE
    # Optional CLI override for log file path
    if hasattr(args, 'log_file') and args.log_file:
        try:
            LOG_FILE = Path(args.log_file)
            if not LOG_FILE.parent.exists():
                LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not use --log-file {args.log_file}: {e}")
    
    print("=" * 70)
    print("VC EMAIL OUTREACH AUTOMATION")
    if args.test:
        print("*** TEST MODE ENABLED ***")
        print("Note: Test mode does not log to CSV.")
    if args.debug:
        print("*** DEBUG MODE ENABLED ***")
    print("=" * 70)
    print()
    # Show log file location early for clarity
    try:
        exists = LOG_FILE.exists()
        print(f"Log file path: {LOG_FILE} {'(exists)' if exists else '(will be created after first non-test send)'}")
    except Exception as e:
        print(f"Log file path: {LOG_FILE} (error checking existence: {e})")
    # Ensure CSV exists with header so it is visible even before first send
    try:
        if not LOG_FILE.exists():
            LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
            pd.DataFrame(columns=['email','name','firm','timestamp','status','message_id']).to_csv(LOG_FILE, index=False)
            print(f"Initialized CSV at: {LOG_FILE}")
    except Exception as e:
        print(f"Warning: Could not initialize CSV at {LOG_FILE}: {e}")
    
    if args.report:
        print("Generating tracking report...")
        print_sent_report()
        return
    
    # Initialize Azure OpenAI client
    print("Initializing Azure OpenAI client...")
    azure_client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT
    )
    print("✓ Azure OpenAI client initialized")
    print()
    
    # Initialize Gmail service (skip in dry-run)
    if args.dry_run:
        print("DRY RUN: Skipping Gmail initialization")
        gmail_service = None
    else:
        print("Initializing Gmail service...")
        gmail_service = get_gmail_service()
        print("✓ Gmail service initialized")
    print()
    
    # Load contacts (use sample in dry-run)
    if args.dry_run:
        print("DRY RUN: Using sample contact for generation preview")
        contacts_df = pd.DataFrame([{
            'email': 'jerry@amecloudventures.com',
            'name': 'Jerry',
            'firm': 'AME Cloud Ventures',
            'title': 'Partner',
            'type': 'Seed/Series A',
            'location': 'Palo Alto, CA',
            'disposable': False,
            'result': ''
        }])
    else:
        contacts_df = load_and_consolidate_contacts()
    print()
    
    # Load sent log (skip in dry-run)
    if args.dry_run:
        print("DRY RUN: Skipping sent log load")
        sent_emails = set()
    else:
        print("Loading sent emails log...")
        sent_emails = load_sent_log()
        print(f"  Found {len(sent_emails)} already-sent emails")
    print()
    
    # Filter out already-sent contacts
    unsent_df = contacts_df[~contacts_df['email'].isin(sent_emails)]
    print(f"Contacts to process: {len(unsent_df)}")
    print(f"Daily limit: {DAILY_LIMIT}")
    print()
    
    # Handle test mode
    if args.test:
        print("=" * 70)
        print("TEST MODE: Using first real VC from list")
        print(f"Test email will be sent to: {TEST_EMAIL}")
        print("=" * 70)
        print()
        # Get only the first contact for test mode
        batch_df = unsent_df.head(1)
        print(f"Selected VC for test: {batch_df.iloc[0]['name']} from {batch_df.iloc[0]['firm']}")
        print()
    else:
        # Limit to daily batch
        batch_df = unsent_df.head(DAILY_LIMIT)
        print(f"Processing batch of {len(batch_df)} emails")
        print("=" * 70)
        print()
    
    # Process each contact
    sent_count = 0
    failed_count = 0
    
    for idx, contact in batch_df.iterrows():
        print(f"[{sent_count + 1}/{len(batch_df)}] Processing: {contact['name']} ({contact['email']})")
        
        # Lookup company information
        print("  Looking up company information...")
        company_info = lookup_company_info(contact['firm'], contact['email'], debug=args.debug)
        
        # Generate email
        print("  Generating personalized email...")
        generated_email = generate_personalized_email(contact, azure_client, company_info=company_info, debug=args.debug)
        
        if not generated_email:
            print("  ✗ Failed to generate email")
            failed_count += 1
            continue
        
        # Parse email (plain text) and build PortalPay-styled HTML template
        subject, body_text = parse_email_content(generated_email)
        # Post-process to remove any awkward 'Founder note' sections or third-person references to Krishna
        body_text = fix_awkward_founder_references(body_text)
        utm_id = hashlib.sha256(contact['email'].encode('utf-8')).hexdigest()[:12]
        body = build_portalpay_email_html(
            body_text,
            utm_id,
            contact['email'],
            str(contact.get('name', '') or ''),
            str(contact.get('firm', '') or ''),
            subject
        )
        body = append_signature(body)
        body = add_compliance_footer(body)
        
        print(f"  Subject: {subject}")
        
        # Optional dry-run: do not send or log
        if args.dry_run:
            print("  DRY RUN: Not sending or logging. Showing preview:")
            print(f"  Subject Preview: {subject}")
            print("  Body Preview (first 400 chars):")
            print(body_text[:400] + ("..." if len(body_text) > 400 else ""))
            continue
        
        # Determine recipient email (test mode or actual)
        recipient_email = TEST_EMAIL if args.test else contact['email']
        
        if args.test:
            print(f"  TEST MODE: Sending to {TEST_EMAIL} instead of {contact['email']}")
        
        # Send email
        print("  Sending email...")
        message_id = send_email_via_gmail(gmail_service, recipient_email, subject, body, debug=args.debug)
        
        if message_id:
            print("  ✓ Email sent successfully")
            
            # Log sent email (log actual VC email, not test email)
            if not args.test:
                log_sent_email(
                    contact['email'],
                    contact['name'],
                    contact['firm'],
                    datetime.now().isoformat(),
                    message_id
                )
            else:
                print("  TEST MODE: Email not logged to prevent marking VC as contacted")
            
            sent_count += 1
            
            # Rate limiting (except for last email or in test mode)
            if sent_count < len(batch_df) and not args.test:
                print(f"  Waiting {SECONDS_BETWEEN_EMAILS} seconds (rate limiting)...")
                time.sleep(SECONDS_BETWEEN_EMAILS)
        else:
            print("  ✗ Failed to send email")
            failed_count += 1
        
        print()
    
    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total emails sent: {sent_count}")
    print(f"Failed: {failed_count}")
    print(f"Remaining contacts: {len(unsent_df) - len(batch_df)}")
    print()
    print("Script completed successfully!")
    print()

if __name__ == "__main__":
    main()
