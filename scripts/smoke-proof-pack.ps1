param(
  [string]$OrgId = "fc59c51a-cf64-4c23-99eb-81527171a661",
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

$url = "$BaseUrl/api/proof-pack?org_id=$OrgId"

Write-Host "Calling: $url"
$pp = Invoke-RestMethod $url -Method GET

if (-not $pp.ok) { throw "Expected ok=true but got ok=false" }

$insCount  = ($pp.pack.insurance_policies | Measure-Object).Count
$subCount  = ($pp.pack.subcontractors | Measure-Object).Count
$subDocCnt = ($pp.pack.subcontractor_documents | Measure-Object).Count

Write-Host "Insurance policies: $insCount"
Write-Host "Subcontractors:     $subCount"
Write-Host "Sub docs:           $subDocCnt"

if ($pp.pack.summary.total_insurance_policies -ne $insCount) {
  throw "Mismatch: summary.total_insurance_policies != insurance_policies.length"
}

if ($pp.pack.summary.total_subcontractors -ne $subCount) {
  throw "Mismatch: summary.total_subcontractors != subcontractors.length"
}

if ($pp.pack.summary.total_subcontractor_documents -ne $subDocCnt) {
  throw "Mismatch: summary.total_subcontractor_documents != subcontractor_documents.length"
}

# Signed URL expectations:
# - insurance doc url should be present if bucket+path are present
$firstIns = $pp.pack.insurance_policies | Select-Object -First 1
if ($firstIns) {
  if ($firstIns.document_bucket -and $firstIns.document_path -and (-not $firstIns.document_signed_url)) {
    throw "Expected insurance document_signed_url but it was null"
  }
}

# - subcontractor doc signed_url should be present if storage_bucket+storage_path are present
$docWithStorage = $pp.pack.subcontractor_documents | Where-Object { $_.storage_bucket -and $_.storage_path } | Select-Object -First 1
if ($docWithStorage -and (-not $docWithStorage.signed_url)) {
  throw "Expected subcontractor signed_url but it was null"
}

Write-Host "SMOKE TEST PASS ✅"
