$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$full = Resolve-Path $path
$src  = Get-Content $full -Raw

# 1) Replace ALL close button inner content with plain "X"
$src = [regex]::Replace(
  $src,
  '(?s)(title="Close"\s*>\s*)(.*?)(\s*</button>)',
  '${1}X${3}'
)

# 2) Replace the uploaded-doc separator line completely
$src = [regex]::Replace(
  $src,
  '(?s)<span className="font-mono">\{d\.doc_type\}</span>.*?\{d\.original_filename \|\| d\.path\}',
  '<span className="font-mono">{d.doc_type}</span> - {d.original_filename || d.path}'
)

# Write clean UTF-8 no BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($full, $src, $utf8NoBom)

Write-Host "DONE: hard-replaced broken UI blocks."
