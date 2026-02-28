$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path
$src  = Get-Content $full -Raw

# 1) Fix the Concierge modal close button label (force plain "X")
#    Target: a button with title="Close" inside the concierge modal block
$src2 = [regex]::Replace(
  $src,
  '(?s)(<button\b[^>]*\btitle="Close"[^>]*>)(.*?)(</button>)',
  '${1}X${3}',
  1
)

# 2) Fix uploaded-docs display separator: force " - " between doc_type and filename
#    Target the specific JSX expression that renders doc_type + separator + original_filename
$src2 = [regex]::Replace(
  $src2,
  '(?s)(\{d\.doc_type\}\s*)([^<]{0,20})(\s*\{d\.original_filename\})',
  '${1} - ${3}',
  1
)

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $src2, $utf8NoBom)

Write-Host "DONE: patched close button + doc separator (ASCII-safe)."
