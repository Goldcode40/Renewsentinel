$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path
$bytes = [System.IO.File]::ReadAllBytes($full)

# Try UTF-8 first; if it doesn't contain the markers, fall back to cp1252 decode
$utf8Text = [System.Text.Encoding]::UTF8.GetString($bytes)
$winText  = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)

$text = $utf8Text
if ($text -notmatch "Ã|â€“|â€”|â€") { $text = $winText }

# Fix common remaining mojibake:
# "Ã—" is often a broken "×"
$text = [regex]::Replace($text, "Ã—", "×")

# Broken en/em dashes
$text = [regex]::Replace($text, "â€“", "-")
$text = [regex]::Replace($text, "â€”", "-")

# Any lingering bad quotes (safe ASCII fallback)
$text = [regex]::Replace($text, "â€˜|â€™", "'")
$text = [regex]::Replace($text, "â€œ|â€", '"')

# Write back UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $text, $utf8NoBom)

Write-Host "DONE: remaining mojibake cleanup applied"
