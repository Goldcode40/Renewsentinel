$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path
$src  = Get-Content $full -Raw

# Replace the requirements "meta" line (state/trade/type) with clean ASCII
# It targets the div that starts with {r.state} and ends with {r.requirement_type}
$src2 = [regex]::Replace(
  $src,
  '(?s)<div className="text-xs text-gray-600">\s*\{r\.state\}.*?\{r\.requirement_type\}\s*</div>',
  '<div className="text-xs text-gray-600">{r.state} - {r.trade} - {r.requirement_type}</div>'
)

if ($src2 -eq $src) {
  Write-Host "WARNING: Did not find the requirements meta line to replace (pattern mismatch)."
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $src2, $utf8NoBom)
  Write-Host "DONE: requirements meta line replaced (ASCII-safe)."
}
