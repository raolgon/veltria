param([Parameter(Mandatory=$true)][string]$Probe)
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path 'D:\Veltria\lab' ('storage-permissions-' + [guid]::NewGuid().ToString('N'))
$folder = Join-Path $testRoot 'denied-models'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$marker = Join-Path $folder 'preserve.txt'
Set-Content -LiteralPath $marker -Value 'existing model data' -Encoding UTF8
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$denied = $null
$aclChanged = $false
try {
  $before = (& $Probe $folder | ConvertFrom-Json)
  if (!$before.writable) { throw 'Initial write check failed' }
  & icacls.exe $folder /deny "*${sid}:(OI)(CI)(W)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Disposable ACL setup failed' }
  $aclChanged = $true
  $denied = (& $Probe $folder | ConvertFrom-Json)
  if ($denied.writable -or $denied.issue.code -ne 'permission-denied') { throw 'Expected permission-denied from the actual write probe' }
} finally {
  if ($aclChanged) {
    & icacls.exe $folder /remove:d "*$sid" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Restore disposable ACL: $folder" }
  }
}
$after = (& $Probe $folder | ConvertFrom-Json)
if (!$after.writable) { throw 'Write recovery failed' }
if ((Get-Content -LiteralPath $marker -Raw).Trim() -ne 'existing model data') { throw 'Existing data changed' }
if (@(Get-ChildItem -LiteralPath $folder -Filter '.veltria-write-check-*' -Force).Count -ne 0) { throw 'Write check leaked a file' }
$report = [ordered]@{ passed=$true; platform='Windows native'; at=(Get-Date).ToUniversalTime().ToString('o'); folder=$folder; denied=$denied; recovered=$after; existingDataPreserved=$true; aclRestored=$true }
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $testRoot 'report.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 8
