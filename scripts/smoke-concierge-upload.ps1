param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OrgId = "fc59c51a-cf64-4c23-99eb-81527171a661",
  [string]$UserId = "00000000-0000-0000-0000-000000000001"
)

Write-Host "== Concierge Upload Smoke Test =="

# 1) Get request_id
$uGet = "$BaseUrl/api/concierge?org_id=$OrgId&user_id=$UserId"
Write-Host "GET $uGet"
$resp = curl.exe -s $uGet | ConvertFrom-Json

if (-not $resp.request -or -not $resp.request.id) {
  Write-Host "ERROR: No concierge request found for org. Submit concierge first." -ForegroundColor Red
  exit 1
}
$requestId = $resp.request.id
Write-Host "request_id = $requestId"

# 2) Create a temp file to upload
$tmp = Join-Path $env:TEMP "concierge_test_upload.txt"
"concierge upload smoke test $(Get-Date -Format o)" | Out-File -FilePath $tmp -Encoding ascii
Write-Host "Created temp file: $tmp"

# 3) Upload via multipart form
$uPost = "$BaseUrl/api/concierge/upload"
Write-Host "`nPOST $uPost (multipart upload)"
$r2 = curl.exe -s -X POST `
  -F "org_id=$OrgId" `
  -F "user_id=$UserId" `
  -F "request_id=$requestId" `
  -F "doc_type=license" `
  -F "file=@$tmp;type=text/plain" `
  $uPost

$r2 | Out-String | Write-Host

# 4) Verify it shows up
Write-Host "`nGET $uGet (after upload)"
$r3 = curl.exe -s $uGet
$r3 | Out-String | Write-Host

Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Host "`n== Done =="
