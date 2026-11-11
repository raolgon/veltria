$ErrorActionPreference = 'Stop'
$isoDir = 'D:\Veltria\vm\iso'
$destination = Join-Path $isoDir 'ubuntu-24.04.5-live-server-amd64.iso.download'
New-Item -ItemType Directory -Path $isoDir -Force | Out-Null
$existing = Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'Veltria Ubuntu Server 24.04.5 ISO' }
if ($existing) { $existing | Select-Object Id,DisplayName,JobState,BytesTransferred,BytesTotal | ConvertTo-Json; exit 0 }
$job = Start-BitsTransfer -Source 'https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso' -Destination $destination -DisplayName 'Veltria Ubuntu Server 24.04.5 ISO' -Asynchronous
$job | Select-Object Id,DisplayName,JobState,BytesTransferred,BytesTotal | ConvertTo-Json
