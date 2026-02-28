param(
  [string]$Path = ".\src\app\dashboard-premium\page.tsx"
)

$raw = Get-Content $Path -Raw

function S([int[]]$codes) {
  -join ($codes | ForEach-Object { [char]$_ })
}

# 1) â€”  => —
$badEmDash = S @(0x00E2,0x20AC,0x201D)     # â €
$raw = $raw.Replace($badEmDash, "—")

# 2) LoadingÎ“Ã‡Âª => Loading...
$badLoading = "Loading" + (S @(0x00CE,0x201C,0x00C3,0x2021,0x00C2,0x00AA))
$raw = $raw.Replace($badLoading, "Loading...")

# 3) â”¬â•– =>  -  (field separator)
$badSep = S @(0x00E2,0x201D,0x00AC,0x00E2,0x2022,0x2013)
$raw = $raw.Replace($badSep, " - ")

# 4) Fix button labels that have garbage BEFORE the word Delete/Edit
#    e.g. "â‰¡Æ’Ã¹... Delete" => "Delete"
$raw = [regex]::Replace($raw, '([^\x00-\x7F]+)\s+Delete', 'Delete')
$raw = [regex]::Replace($raw, '([^\x00-\x7F]+)\s+Edit', 'Edit')

# 5) Î“Ã‡Ã³ (weird divider) => " · "
$badDot = S @(0x00CE,0x201C,0x00C3,0x2021,0x00C3,0x00B3)
$raw = $raw.Replace($badDot, " · ")

# 6) Stray token line like "Î“Â£Ã²" => remove
$badStray = S @(0x00CE,0x201C,0x00C2,0x00A3,0x00C3,0x00B2)
$raw = $raw.Replace($badStray, "")

Set-Content -Path $Path -Value $raw -Encoding UTF8
Write-Host "Patched: $Path"
