param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OrgId = "fc59c51a-cf64-4c23-99eb-81527171a661"
)

Write-Host "== Concierge Smoke Test =="

# 1) GET (should return request:null first time)
$u1 = "$BaseUrl/api/concierge?org_id=$OrgId"
Write-Host "GET $u1"
$r1 = curl.exe -s $u1
$r1 | Out-String | Write-Host

# 2) POST (create/submit) - Windows-safe JSON via temp file
$u2 = "$BaseUrl/api/concierge"
$payloadObj = @{
  org_id = $OrgId
  status = "submitted"
  notes  = "smoke test submit"
}
$json = $payloadObj | ConvertTo-Json -Compress

$tmp = Join-Path $env:TEMP "concierge_payload.json"
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false))) # UTF-8 no BOM

Write-Host "`nPOST $u2"
Write-Host "Payload: $json"
$r2 = curl.exe -s -X POST $u2 -H "Content-Type: application/json" --data-binary "@$tmp"
$r2 | Out-String | Write-Host

# 3) GET again (should return a request)
Write-Host "`nGET $u1 (after submit)"
$r3 = curl.exe -s $u1
$r3 | Out-String | Write-Host

Remove-Item $tmp -Force -ErrorAction SilentlyContinue

Write-Host "`n== Done =="
