$ErrorActionPreference = 'Stop'
$dir = 'D:\Veltria\vm\iso'
$part = Join-Path $dir 'ubuntu-24.04.5-live-server-amd64.iso.part'
$expected = '97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8'
if (-not (Test-Path -LiteralPath $part)) { throw "ISO download is missing: $part" }
$actual = (Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Ubuntu ISO SHA-256 mismatch: $actual" }
[pscustomobject]@{ Iso = $part; Sha256 = $actual; Verified = $true; Bytes = (Get-Item -LiteralPath $part).Length } | ConvertTo-Json
