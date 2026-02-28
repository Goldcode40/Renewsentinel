$ErrorActionPreference = "Stop"

$path = ".\src\app\dashboard\page.tsx"
$src  = Get-Content $path -Raw

if ($src -match 'Doc type</label>') {
  Write-Host "Upload UI already present. Skipping." -ForegroundColor Yellow
  exit 0
}

# Insert right after the FIRST </textarea> in the concierge modal (safe enough for our case)
$idx = $src.IndexOf("</textarea>")
if ($idx -lt 0) {
  Write-Host "ERROR: Could not find </textarea> in file." -ForegroundColor Red
  exit 1
}

$insertPos = $idx + "</textarea>".Length

$ui = @"
  
<div className="mt-4 space-y-2">
  <label className="text-sm font-medium">Upload documents</label>

  <div className="flex flex-wrap items-center gap-2">
    <label className="text-xs text-gray-600">Doc type</label>
    <select
      className="h-9 rounded border px-2 text-sm"
      value={conciergeUploadType}
      onChange={(e) => setConciergeUploadType(e.target.value)}
    >
      <option value="license">License</option>
      <option value="insurance">Insurance</option>
      <option value="cert">Certification</option>
      <option value="other">Other</option>
    </select>

    <input
      className="text-sm"
      type="file"
      accept=".pdf,.png,.jpg,.jpeg,.txt"
      disabled={conciergeUploading}
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (!f) return
        uploadConciergeDoc(f)
        e.currentTarget.value = ""
      }}
    />

    <span className="text-xs text-gray-600">
      {conciergeUploading ? "Uploading..." : ""}
    </span>
  </div>

  {conciergeDocs.length > 0 ? (
    <div className="rounded border bg-gray-50 p-2">
      <div className="text-xs font-medium text-gray-700">Uploaded docs</div>
      <ul className="mt-1 space-y-1">
        {conciergeDocs.map((d: any) => (
          <li key={d.id} className="text-xs text-gray-700">
            <span className="font-mono">{d.doc_type}</span>{" "}
            — {d.original_filename || d.path}
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div className="text-xs text-gray-500">No docs uploaded yet.</div>
  )}
</div>
"@

$src2 = $src.Substring(0, $insertPos) + $ui + $src.Substring($insertPos)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path), $src2, $utf8NoBom)

Write-Host "OK: Upload UI inserted after first </textarea> in $path"
