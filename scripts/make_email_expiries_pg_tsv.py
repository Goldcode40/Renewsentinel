import csv

src = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries.csv"
dst = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries_pg.tsv"

def clean(s: str) -> str:
    if s is None: return ""
    s = str(s)
    s = s.replace("\r"," ").replace("\n"," ").replace("\t"," ")
    s = " ".join(s.split())
    return s

with open(src, "r", encoding="utf-8", newline="") as f_in, open(dst, "w", encoding="utf-8", newline="") as f_out:
    r = csv.DictReader(f_in)
    cols = ["gmail_message_id","from","subject","gmail_date_header","snippet","parsed_expiry_date"]

    count = 0
    for row in r:
        gmail_message_id = clean(row.get("gmail_message_id",""))
        from_email = clean(row.get("from",""))
        subject = clean(row.get("subject",""))
        gmail_date_header = clean(row.get("gmail_date_header",""))
        snippet = clean(row.get("snippet",""))
        expiry = clean(row.get("parsed_expiry_date",""))

        # IMPORTANT: Postgres TEXT COPY expects \N for NULL
        if expiry == "":
            expiry = r"\N"

        f_out.write("\t".join([gmail_message_id, from_email, subject, gmail_date_header, snippet, expiry]) + "\n")
        count += 1

print(f"OK: wrote {count} rows -> {dst}")
