$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path

$bytes = [System.IO.File]::ReadAllBytes($full)
$text  = [System.Text.Encoding]::UTF8.GetString($bytes)

# Fix the specific mojibake we saw in the UI
$text = $text.Replace("WeÃ¢â‚¬â„¢ll", "We'll")

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $text, $utf8NoBom)

Write-Host "DONE: encoding rewrite complete"
