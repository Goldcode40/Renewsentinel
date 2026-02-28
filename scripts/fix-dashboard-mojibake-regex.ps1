$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path

$bytes = [System.IO.File]::ReadAllBytes($full)

# Try both decodes; pick the one that actually contains the mojibake markers
$utf8Text = [System.Text.Encoding]::UTF8.GetString($bytes)
$winText  = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)

$text = $utf8Text
if ($text -notmatch "Ã¢â‚¬â„¢|Ã‚Â·") { $text = $winText }

# Replace the broken sequences globally (regex)
$text = [regex]::Replace($text, "Ã¢â‚¬â„¢", "'")
$text = [regex]::Replace($text, "Ã‚Â·", "-")

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $text, $utf8NoBom)

Write-Host "DONE: regex mojibake cleanup applied"
