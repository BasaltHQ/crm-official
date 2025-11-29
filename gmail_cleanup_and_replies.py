#!/usr/bin/env python3
"""
Gmail Cleanup and Replies CSV Builder

Features:
- Cleans up failed delivery emails (bounces) by moving them to Trash (or hard deleting with a flag)
- Scans your sent-email threads and extracts replies you've received
- Outputs a CSV report of replies

Authentication:
- Uses the same gmail_credentials.json and gmail_token.pickle as vcrun.py
- Requires Gmail scope "gmail.modify" (read + move to trash). If your existing token only has "gmail.send",
  this script will prompt a one-time re-auth to add the additional scope.

Usage examples:
  # Default: cleanup bounces (trash) and build replies CSV for last 180 days
  python scripts/gmail_cleanup_and_replies.py

  # Hard-delete bounces instead of trash
  python scripts/gmail_cleanup_and_replies.py --hard-delete

  # Dry run the cleanup (no deletions), still build replies CSV
  python scripts/gmail_cleanup_and_replies.py --dry-run

  # Restrict replies to threads from a specific sent log (as produced by vcrun.py)
  python scripts/gmail_cleanup_and_replies.py --sent-log "h:/iCloud/.../sent_emails_log.csv"

  # Limit replies to since a date or days window
  python scripts/gmail_cleanup_and_replies.py --since "2025-07-01"
  python scripts/gmail_cleanup_and_replies.py --days 90

  # Only perform cleanup or only build replies csv
  python scripts/gmail_cleanup_and_replies.py --only-cleanup
  python scripts/gmail_cleanup_and_replies.py --only-replies

  # Choose output CSV path
  python scripts/gmail_cleanup_and_replies.py --out "./gmail_replies.csv"
"""

import os
import sys
import csv
import re
import time
import argparse
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple, Set
from pathlib import Path
from email.utils import parseaddr

import pickle

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


# Defaults align with vcrun.py, but can be overridden via CLI
GMAIL_TOKEN_FILE = 'gmail_token.pickle'
GMAIL_CREDENTIALS_FILE = 'gmail_credentials.json'

# We need modify (implies read access, label changes, trash). This will trigger a one-time auth if your
# current token only has gmail.send
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.modify']


def get_gmail_service(token_file: str, credentials_file: str, scopes: List[str]):
    """Authenticate and return Gmail API service with required scopes.

    If an existing token is present but missing required scopes, re-run OAuth flow.
    """
    creds = None

    if os.path.exists(token_file):
        with open(token_file, 'rb') as token:
            creds = pickle.load(token)

    needs_reauth = False
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                needs_reauth = True
        else:
            needs_reauth = True

    # Ensure scopes include the required ones (existing token may only have gmail.send)
    if creds and hasattr(creds, 'scopes'):
        existing = set(creds.scopes or [])
        required = set(scopes)
        if not required.issubset(existing):
            needs_reauth = True

    if needs_reauth:
        flow = InstalledAppFlow.from_client_secrets_file(credentials_file, scopes)
        creds = flow.run_local_server(port=0)
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)

    return build('gmail', 'v1', credentials=creds)


def get_profile_email(service) -> str:
    """Return the authenticated user's primary email address."""
    profile = service.users().getProfile(userId='me').execute()
    return profile.get('emailAddress', '')


def list_messages(service, query: str, label_ids: Optional[List[str]] = None, max_pages: int = 1000) -> List[str]:
    """List message IDs matching a Gmail query, with pagination."""
    msgs = []
    page_token = None
    pages = 0
    while True:
        kwargs = {'userId': 'me', 'q': query, 'maxResults': 500}
        if page_token:
            kwargs['pageToken'] = page_token
        if label_ids:
            kwargs['labelIds'] = label_ids
        resp = service.users().messages().list(**kwargs).execute()
        ids = [m['id'] for m in resp.get('messages', [])]
        msgs.extend(ids)
        page_token = resp.get('nextPageToken')
        pages += 1
        if not page_token or pages >= max_pages:
            break
    return msgs


def get_message_metadata(service, message_id: str) -> Dict:
    """Get message with metadata (headers, internalDate, snippet)."""
    return service.users().messages().get(
        userId='me',
        id=message_id,
        format='metadata',
        metadataHeaders=['From', 'To', 'Subject', 'Date', 'In-Reply-To', 'References', 'Message-Id', 'Reply-To']
    ).execute()


def get_thread(service, thread_id: str) -> Dict:
    """Get an entire thread with metadata for each message."""
    return service.users().threads().get(
        userId='me',
        id=thread_id,
        format='metadata',
        metadataHeaders=['From', 'To', 'Subject', 'Date', 'In-Reply-To', 'References', 'Message-Id', 'Reply-To']
    ).execute()


def header_map(payload: Dict) -> Dict[str, str]:
    """Convert payload.headers list to case-insensitive dict."""
    result = {}
    headers = (payload or {}).get('headers', [])
    for h in headers:
        name = h.get('name', '')
        value = h.get('value', '')
        if name:
            result[name.lower()] = value
    return result


def parse_name_email(from_header: str) -> Tuple[str, str]:
    """Parse 'From' into (name, email)."""
    name, email = parseaddr(from_header or '')
    return name or '', email or ''


BOUNCE_FROM_PATTERNS = [
    r'mail delivery subsystem',
    r'mailer-daemon',
    r'postmaster',
]

BOUNCE_SUBJECT_PATTERNS = [
    r'delivery status notification',
    r'undelivered mail returned to sender',
    r'delivery incomplete',
    r'message blocked',
    r'failure notice',
]

def is_bounce_message(msg_metadata: Dict) -> bool:
    """Heuristic to detect failed delivery notifications."""
    payload = (msg_metadata or {}).get('payload', {})
    hmap = header_map(payload)
    from_val = (hmap.get('from') or '').lower()
    subj_val = (hmap.get('subject') or '').lower()

    if any(pat in from_val for pat in BOUNCE_FROM_PATTERNS):
        return True
    if any(pat in subj_val for pat in BOUNCE_SUBJECT_PATTERNS):
        return True
    # Sometimes bounces are in "Mail Delivery Subsystem" with different subjects
    if 'mail delivery subsystem' in from_val:
        return True
    return False


def trash_or_delete(service, message_id: str, hard_delete: bool = False) -> None:
    """Move message to Trash or permanently delete."""
    if hard_delete:
        service.users().messages().delete(userId='me', id=message_id).execute()
    else:
        service.users().messages().trash(userId='me', id=message_id).execute()


def cleanup_bounces(service, since_query: Optional[str], dry_run: bool, hard_delete: bool) -> Dict[str, int]:
    """
    Find bounce/failed delivery emails and move them to Trash (or delete).

    Returns a summary dict with counts.
    """
    # Build a robust query; include anywhere (Inbox, archived, etc.)
    # Optionally add a since restriction
    or_terms = [
        'from:"Mail Delivery Subsystem"',
        'from:mailer-daemon',
        'from:postmaster',
        'subject:"Delivery Status Notification"',
        'subject:"Undelivered Mail Returned to Sender"',
        'subject:"Delivery incomplete"',
        'subject:"Message blocked"',
        'subject:"failure notice"',
    ]
    query = f'in:anywhere ({ " OR ".join(or_terms) })'
    if since_query:
        query = f'{query} {since_query}'

    message_ids = list_messages(service, query)
    inspected = 0
    matched = 0
    acted = 0

    for mid in message_ids:
        try:
            meta = get_message_metadata(service, mid)
            inspected += 1
            if is_bounce_message(meta):
                matched += 1
                if dry_run:
                    # Print for visibility
                    payload = meta.get('payload', {})
                    hmap = header_map(payload)
                    print(f"[DRY-RUN] Bounce candidate: id={mid} subject={hmap.get('subject','')} from={hmap.get('from','')}")
                else:
                    trash_or_delete(service, mid, hard_delete=hard_delete)
                    acted += 1
            # else: ignore false positives
        except HttpError as he:
            print(f"  Warning: failed reading {mid}: {he}")
        except Exception as e:
            print(f"  Warning: unexpected error for {mid}: {e}")

    return {'inspected': inspected, 'matched': matched, 'acted': acted}


def load_sent_log_ids(sent_log_path: Path) -> List[str]:
    """Load Gmail message IDs from a vcrun.py-like sent log. Column 'message_id' is expected."""
    ids = []
    if not sent_log_path.exists():
        return ids
    try:
        with sent_log_path.open('r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                mid = (row.get('message_id') or '').strip()
                if mid:
                    ids.append(mid)
    except Exception as e:
        print(f"Warning: could not read sent log at {sent_log_path}: {e}")
    return ids


def epoch_ms_to_iso(ms_str: str) -> str:
    try:
        ms = int(ms_str)
        dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        return dt.isoformat()
    except Exception:
        return ''


def build_since_query(days: Optional[int], since_date: Optional[str]) -> Optional[str]:
    """
    Build a Gmail search suffix for date filtering.
    - If since_date provided as YYYY-MM-DD, produce 'after:YYYY/MM/DD'
    - Else if days provided, produce 'newer_than:Nd'
    """
    if since_date:
        # Gmail expects YYYY/MM/DD for after:
        try:
            d = datetime.strptime(since_date, '%Y-%m-%d')
            return f'after:{d.strftime("%Y/%m/%d")}'
        except Exception:
            print("Warning: --since date must be YYYY-MM-DD; ignoring.")
    if days and days > 0:
        return f'newer_than:{days}d'
    return None


def extract_header(hmap: Dict[str, str], key: str) -> str:
    return hmap.get(key.lower(), '')


def build_replies_csv(
    service,
    my_email: str,
    out_path: Path,
    since_epoch_ms: Optional[int],
    sent_log_ids: Optional[List[str]] = None
) -> int:
    """
    Build a CSV of replies received in threads where you've sent emails.

    Strategy:
      - If sent_log_ids provided: for each sent Gmail message id, fetch its thread and collect messages not from me.
      - Else: query threads with 'from:me' in recent window, and collect messages not from me in those threads.

    Returns count of rows written.
    """
    rows: List[Dict[str, str]] = []
    seen_reply_ids: Set[str] = set()
    thread_ids: Set[str] = set()

    # Helper to process a thread and collect reply messages
    def process_thread(thread_id: str):
        nonlocal rows
        try:
            th = get_thread(service, thread_id)
            messages = th.get('messages', [])
            # Identify if the thread includes at least one message from me
            has_me = False
            for m in messages:
                payload = m.get('payload', {})
                hmap = header_map(payload)
                from_hdr = extract_header(hmap, 'From')
                _, sender_email = parse_name_email(from_hdr)
                if sender_email.lower() == my_email.lower():
                    has_me = True
                    break
            if not has_me:
                return

            for m in messages:
                mid = m.get('id', '')
                if mid in seen_reply_ids:
                    continue
                payload = m.get('payload', {})
                hmap = header_map(payload)
                from_hdr = extract_header(hmap, 'From')
                name, sender_email = parse_name_email(from_hdr)
                # Only count messages not from me
                if sender_email.lower() == my_email.lower():
                    continue

                # Date filtering
                internal_date = m.get('internalDate')
                if since_epoch_ms and internal_date:
                    try:
                        if int(internal_date) < since_epoch_ms:
                            continue
                    except Exception:
                        pass

                # Build row
                to_hdr = extract_header(hmap, 'To')
                subject = extract_header(hmap, 'Subject')
                date_iso = epoch_ms_to_iso(internal_date or '')
                snippet = (m.get('snippet') or '').strip()

                row = {
                    'thread_id': thread_id,
                    'reply_message_id': mid,
                    'reply_date': date_iso,
                    'from_name': name,
                    'from_email': sender_email,
                    'subject': subject,
                    'to': to_hdr,
                    'snippet': snippet,
                }
                rows.append(row)
                seen_reply_ids.add(mid)

        except HttpError as he:
            print(f"  Warning: failed reading thread {thread_id}: {he}")
        except Exception as e:
            print(f"  Warning: unexpected error for thread {thread_id}: {e}")

    if sent_log_ids:
        # Gather thread IDs from sent message IDs
        for sid in sent_log_ids:
            try:
                meta = get_message_metadata(service, sid)
                tid = meta.get('threadId')
                if tid:
                    thread_ids.add(tid)
            except HttpError as he:
                # Sent message ID may be old/expired or not accessible with current scopes
                print(f"  Warning: could not fetch sent message {sid}: {he}")
            except Exception as e:
                print(f"  Warning: error fetching sent message {sid}: {e}")
        for tid in thread_ids:
            process_thread(tid)
    else:
        # Fallback: scan recent threads from messages sent by me
        # Use a reasonable default window if since not provided
        base_query = 'from:me'
        # We'll build the since restriction as a message-level restriction
        # to reduce search space we can still add a newer_than:Nd if since not provided
        # Default to 180 days
        default_since = f'newer_than:180d' if not since_epoch_ms else ''
        q = f'{base_query} {default_since}'.strip()
        message_ids = list_messages(service, q)
        for mid in message_ids:
            try:
                meta = get_message_metadata(service, mid)
                tid = meta.get('threadId')
                if tid:
                    thread_ids.add(tid)
            except Exception:
                # ignore
                pass
        for tid in thread_ids:
            process_thread(tid)

    # Sort rows by date ascending
    def parse_iso(s: str) -> float:
        try:
            return datetime.fromisoformat(s).timestamp()
        except Exception:
            return 0.0

    rows.sort(key=lambda r: parse_iso(r.get('reply_date', '')))

    # Write CSV
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'thread_id',
            'reply_message_id',
            'reply_date',
            'from_name',
            'from_email',
            'subject',
            'to',
            'snippet',
        ])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    return len(rows)


def main():
    parser = argparse.ArgumentParser(description='Clean up Gmail failed deliveries and build a CSV of replies.')
    parser.add_argument('--credentials', default=GMAIL_CREDENTIALS_FILE, help='Path to gmail_credentials.json')
    parser.add_argument('--token', default=GMAIL_TOKEN_FILE, help='Path to gmail_token.pickle')
    parser.add_argument('--hard-delete', action='store_true', help='Permanently delete bounces instead of moving to Trash')
    parser.add_argument('--dry-run', action='store_true', help='Do not delete/trash, just print bounce candidates')
    parser.add_argument('--since', type=str, help='Only consider messages after this date (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='Only consider messages newer than N days')
    parser.add_argument('--sent-log', type=str, help='Path to sent_emails_log.csv from vcrun.py to constrain replies')
    parser.add_argument('--out', type=str, help='Output CSV path for replies (default: ./gmail_replies_YYYYMMDD_HHMMSS.csv)')
    parser.add_argument('--only-cleanup', action='store_true', help='Only run cleanup of failed deliveries')
    parser.add_argument('--only-replies', action='store_true', help='Only build replies CSV, skip cleanup')
    args = parser.parse_args()

    token_path = args.token
    cred_path = args.credentials

    # Calculate time filters
    since_query_suffix = build_since_query(args.days, args.since)

    # For thread message-level filtering, compute epoch ms threshold if provided
    since_epoch_ms = None
    if args.since:
        try:
            d = datetime.strptime(args.since, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            since_epoch_ms = int(d.timestamp() * 1000)
        except Exception:
            print("Warning: --since date must be YYYY-MM-DD; ignoring thread-level since.")
    elif args.days and args.days > 0:
        d = datetime.now(tz=timezone.utc) - timedelta(days=args.days)
        since_epoch_ms = int(d.timestamp() * 1000)

    # Initialize Gmail
    print("Initializing Gmail service...")
    try:
        service = get_gmail_service(token_path, cred_path, GMAIL_SCOPES)
    except Exception as e:
        print(f"ERROR: Could not initialize Gmail service: {e}")
        sys.exit(1)
    my_email = get_profile_email(service)
    print(f"✓ Gmail ready as {my_email}")
    print()

    # Cleanup phase
    if not args.only_replies:
        print("Cleaning up failed deliveries (bounces)...")
        summary = cleanup_bounces(service, since_query_suffix, dry_run=args.dry_run, hard_delete=args.hard_delete)
        action_word = "would be deleted" if args.dry_run else ("deleted" if args.hard_delete else "trashed")
        print(f"Cleanup summary: inspected={summary['inspected']} matched={summary['matched']} {action_word}={summary['acted']}")
        print()

    # Replies phase
    if not args.only_cleanup:
        # Determine output path
        out_csv = Path(args.out) if args.out else Path(f'./gmail_replies_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        sent_ids = None
        if args.sent_log:
            sent_ids = load_sent_log_ids(Path(args.sent_log))
            print(f"Loaded {len(sent_ids)} sent message IDs from sent log")
        print(f"Building replies CSV -> {out_csv}")
        count = build_replies_csv(service, my_email, out_csv, since_epoch_ms, sent_log_ids=sent_ids)
        print(f"✓ Replies CSV written with {count} rows at: {out_csv.resolve()}")
        print()

    print("Done.")


if __name__ == '__main__':
    main()
