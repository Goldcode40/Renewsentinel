param(
  [Parameter(Mandatory=$true)][string]$RoutePath,
  [Parameter(Mandatory=$true)][string]$GateLabel
)

if (!(Test-Path $RoutePath)) { throw "Missing file: $RoutePath" }

$lines = Get-Content $RoutePath
$raw   = $lines -join "`n"

function Insert-AfterLine([string[]]$arr, [int]$lineNumber1Based, [string[]]$toInsert) {
  $i0 = $lineNumber1Based - 1
  if ($i0 -lt 0 -or $i0 -ge $arr.Length) { throw "Bad line index: $lineNumber1Based" }
  return $arr[0..$i0] + $toInsert + $arr[($i0+1)..($arr.Length-1)]
}

# Detect response helper
$usesNextResponse = ($raw -match 'NextResponse') -or ($raw -match 'from\s+"next/server"')
$jsonFn = if ($usesNextResponse) { "NextResponse.json" } else { "Response.json" }

# Ensure billingGate import exists
if ($raw -notmatch 'from\s+"@/lib/billingGate"') {
  $lastImport = ($lines | Select-String -Pattern '^\s*import\s' | Select-Object -Last 1)
  if (-not $lastImport) { throw "No import lines found in $RoutePath" }
  $lines = Insert-AfterLine $lines $lastImport.LineNumber @('import { requireActiveOrTrial } from "@/lib/billingGate"')
  $raw = $lines -join "`n"
}

# Find a supabase client variable (const X = getSupabaseAdmin() OR supabaseAdmin() OR sb() OR createClient())
$clientVar = $null
$clientLine = $null

$cm = [regex]::Match($raw, '\bconst\s+([A-Za-z0-9_]+)\s*=\s*(getSupabaseAdmin|supabaseAdmin|sb|createClient)\(')
if ($cm.Success) {
  $clientVar = $cm.Groups[1].Value
  $clientLine = ($lines | Select-String -Pattern ("const\s+$([regex]::Escape($clientVar))\s*=") | Select-Object -First 1)
}
if (-not $clientVar -or -not $clientLine) { throw "Could not detect supabase client variable in $RoutePath" }

# Find org variable (broad): const <name> = ...get("org_id")... OR form.get("org_id")
$orgVar = $null
$orgLine = $null

$om = [regex]::Match($raw, '\bconst\s+([A-Za-z0-9_]+)\s*=\s*.*(searchParams\.get\("org_id"\)|form\.get\("org_id"\)|get\("org_id"\))')
if ($om.Success) {
  $orgVar = $om.Groups[1].Value
  $orgLine = ($lines | Select-String -Pattern ("const\s+$([regex]::Escape($orgVar))\s*=") | Select-Object -First 1)
}
# Fallback: JSON body pattern (common in POST routes): const body = await req.json(); then use body.org_id
if (-not $orgVar -or -not $orgLine) {
  $bm = [regex]::Match($raw, '\bconst\s+([A-Za-z0-9_]+)\s*=\s*\(?(?:await\s+)?req\.json\(\)\)?')
  if ($bm.Success) {
    $candidate = $bm.Groups[1].Value
    if ($raw -match [regex]::Escape($candidate + '.org_id')) {
      $orgVar = "$candidate.org_id"
      $orgLine = ($lines | Select-String -Pattern ("const\s+$([regex]::Escape($candidate))\s*=") | Select-Object -First 1)
    }
  }
}
if (-not $orgVar -or -not $orgLine) { throw "Could not detect org variable assignment from org_id in $RoutePath" }

# Insert gate once, after whichever comes later: orgLine or clientLine
$raw2 = $lines -join "`n"
if ($raw2 -notmatch [regex]::Escape("HARD GATE: $GateLabel")) {

  $insertAfter = $clientLine.LineNumber
  if ($orgLine.LineNumber -gt $insertAfter) { $insertAfter = $orgLine.LineNumber }

  $gateBlock = @(
    ''
    "    // HARD GATE: $GateLabel is premium-only (active subscription OR active trial)"
    "    const gate = await requireActiveOrTrial($clientVar as any, $orgVar)"
    '    if (!gate.ok) {'
    "      return $jsonFn("
    '        { ok: false, error: "Upgrade required", reason: gate.reason, org: gate.org ?? null },'
    '        { status: 403 }'
    '      )'
    '    }'
    ''
  )

  $lines = Insert-AfterLine $lines $insertAfter $gateBlock
}

Set-Content -Path $RoutePath -Value $lines -Encoding UTF8
"OK patched: $RoutePath"

Select-String -Path $RoutePath -Pattern 'from "@/lib/billingGate"',"HARD GATE:\s*$([regex]::Escape($GateLabel))",'requireActiveOrTrial\(' -Context 0,2

