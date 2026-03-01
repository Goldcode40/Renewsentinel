import csv

src = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries.csv"
dst = r"C:\Users\rjayg\renewsentinel\scripts\email_expiries_clean.csv"

with open(src, "r", encoding="utf-8", newline="") as f_in, open(dst, "w", encoding="utf-8", newline="") as f_out:
    reader = csv.DictReader(f_in)
    w = csv.DictWriter(f_out, fieldnames=reader.fieldnames, quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    for row in reader:
        snip = row.get("snippet") or ""
        snip = snip.replace("\r", " ").replace("\n", " ").replace("\t", " ")
        row["snippet"] = " ".join(snip.split())
        w.writerow(row)

print("OK: wrote", dst)
