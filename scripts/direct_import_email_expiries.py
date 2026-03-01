import csv, os
from supabase import create_client

# Load env from process (you already did this earlier)
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise SystemExit("Missing env vars")

sb = create_client(url, key)

org_id = "4bc37ea7-68e3-434b-b0db-7070d2063cf9"

src = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries.csv"

def clean(s):
    if s is None: return None
    s = str(s).replace("\r"," ").replace("\n"," ").replace("\t"," ")
    s = " ".join(s.split())
    return s if s != "" else None

rows = []

with open(src, "r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append({
            "org_id": org_id,
            "gmail_message_id": clean(r.get("gmail_message_id")),
            "from_email": clean(r.get("from")),
            "subject": clean(r.get("subject")),
            "gmail_date_header": clean(r.get("gmail_date_header")),
            "snippet": clean(r.get("snippet")),
            "parsed_expiry_date": clean(r.get("parsed_expiry_date")),
        })

resp = sb.table("email_expiries").upsert(
    rows,
    on_conflict="org_id,gmail_message_id"
).execute()

print("Inserted / upserted:", len(rows))
