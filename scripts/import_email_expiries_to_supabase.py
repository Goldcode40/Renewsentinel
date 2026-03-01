import csv, os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

ORG_ID = "4bc37ea7-68e3-434b-b0db-7070d2063cf9"
CSV_PATH = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries.csv"

sb: Client = create_client(SUPABASE_URL, SERVICE_KEY)

rows = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append({
            "org_id": ORG_ID,
            "gmail_message_id": r.get("gmail_message_id"),
            "from_email": r.get("from"),
            "subject": r.get("subject"),
            "gmail_date_header": r.get("gmail_date_header"),
            "snippet": r.get("snippet"),
            "parsed_expiry_date": r.get("parsed_expiry_date") or None,
        })

# Upsert by unique index (org_id, gmail_message_id)
# supabase-py uses on_conflict with comma-separated columns
resp = sb.table("email_expiries").upsert(rows, on_conflict="org_id,gmail_message_id").execute()

data = resp.data or []
print(f"OK: upserted {len(rows)} rows into public.email_expiries")
print("Sample returned rows:", len(data))
