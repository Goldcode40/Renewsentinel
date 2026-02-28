$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path

$bytes = [System.IO.File]::ReadAllBytes($full)
$text  = [System.Text.Encoding]::UTF8.GetString($bytes)

# Fix curly apostrophe mojibake (both cases)
$text = $text.Replace("WeÃ¢â‚¬â„¢ll", "We'll")
$text = $text.Replace("weÃ¢â‚¬â„¢ll", "we'll")

# Fix the broken middle-dot separator mojibake:
# Replace " Ã‚Â· " with " - " (ASCII safe)
$text = $text.Replace(" Ã‚Â· ", " - ")

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $text, $utf8NoBom)

Write-Host "DONE: mojibake cleanup applied"
