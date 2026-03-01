import os, re, csv, html
from datetime import datetime
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import pickle

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# IMPORTANT: this must point to your downloaded OAuth credentials.json
CREDENTIALS_PATH = r"C:\Users\rjayg\renewsentinel\credentials.json"

OUTPUT_CSV = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries.csv"

# Gmail search query — tuned for “expiry/renewal” type emails
GMAIL_QUERY = (
    '(expires OR expiry OR expiration OR renew OR renewal OR "due date" OR "valid until" OR "policy" OR "license") '
    'newer_than:365d'
)

DATE_PATTERNS = [
    # 2026-12-31
    (re.compile(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b"), "%Y-%m-%d"),
    # 12/31/2026 or 12-31-2026
    (re.compile(r"\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b"), "MDY"),
    # March 1, 2026  (also Mar 1 2026)
    (re.compile(r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
                r"Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,)?\s+(20\d{2})\b", re.IGNORECASE), "MON_D_Y"),
]

MONTHS = {
    "jan":1,"january":1,"feb":2,"february":2,"mar":3,"march":3,"apr":4,"april":4,"may":5,"jun":6,"june":6,
    "jul":7,"july":7,"aug":8,"august":8,"sep":9,"september":9,"oct":10,"october":10,"nov":11,"november":11,"dec":12,"december":12
}

def pick_best_date(text: str):
    """Return best guessed expiry date (ISO string) found in text, else ''."""
    if not text:
        return ""
    candidates = []

    # Normalize HTML entities, collapse whitespace
    t = html.unescape(text)
    t = re.sub(r"\s+", " ", t).strip()

    # Pattern 1: YYYY-MM-DD
    for rx, fmt in DATE_PATTERNS[:1]:
        for m in rx.finditer(t):
            try:
                dt = datetime.strptime(m.group(0), fmt)
                candidates.append(dt)
            except:
                pass

    # Pattern 2: MM/DD/YYYY or MM-DD-YYYY
    rx, _ = DATE_PATTERNS[1]
    for m in rx.finditer(t):
        try:
            mm = int(m.group(1)); dd = int(m.group(2)); yy = int(m.group(3))
            dt = datetime(yy, mm, dd)
            candidates.append(dt)
        except:
            pass

    # Pattern 3: Month D YYYY
    rx, _ = DATE_PATTERNS[2]
    for m in rx.finditer(t):
        try:
            mon = MONTHS[m.group(1).lower()]
            dd = int(m.group(2))
            yy = int(m.group(3))
            dt = datetime(yy, mon, dd)
            candidates.append(dt)
        except:
            pass

    if not candidates:
        return ""

    # Heuristic: choose the latest date (most likely the actual expiry vs older references)
    best = max(candidates)
    return best.strftime("%Y-%m-%d")

def authenticate_gmail():
    creds = None
    token_path = os.path.join(os.path.dirname(OUTPUT_CSV), "token.pickle")

    if os.path.exists(token_path):
        with open(token_path, "rb") as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "wb") as f:
            pickle.dump(creds, f)

    return build("gmail", "v1", credentials=creds)

def get_header(headers, name):
    name = name.lower()
    for h in headers or []:
        if (h.get("name") or "").lower() == name:
            return h.get("value") or ""
    return ""

def main():
    svc = authenticate_gmail()

    resp = svc.users().messages().list(
        userId="me",
        labelIds=["INBOX"],
        q=GMAIL_QUERY,
        maxResults=50
    ).execute()

    msgs = resp.get("messages", [])
    rows = []

    for m in msgs:
        msg = svc.users().messages().get(
            userId="me",
            id=m["id"],
            format="metadata",
            metadataHeaders=["Subject","From","Date"]
        ).execute()

        headers = (msg.get("payload") or {}).get("headers") or []
        subject = get_header(headers, "Subject")
        from_ = get_header(headers, "From")
        date_hdr = get_header(headers, "Date")
        snippet = msg.get("snippet") or ""

        # Try to find an expiry-like date in subject/snippet
        expiry = pick_best_date(subject + " " + snippet)

        rows.append({
            "gmail_message_id": m["id"],
            "from": from_,
            "subject": subject,
            "gmail_date_header": date_hdr,
            "snippet": html.unescape(snippet),
            "parsed_expiry_date": expiry,
        })

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [
            "gmail_message_id","from","subject","gmail_date_header","snippet","parsed_expiry_date"
        ])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"OK: wrote {len(rows)} rows -> {OUTPUT_CSV}")
    print("Note: parsed_expiry_date may be blank if no date was found in subject/snippet.")

if __name__ == "__main__":
    main()
