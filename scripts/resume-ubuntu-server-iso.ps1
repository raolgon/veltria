$ErrorActionPreference = 'Stop'
$displayName = 'Veltria Ubuntu Server 24.04.5 ISO'
Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $displayName } | Remove-BitsTransfer -ErrorAction SilentlyContinue
$iso = 'D:\Veltria\vm\iso\ubuntu-24.04.5-live-server-amd64.iso.part'
$log = 'D:\Veltria\vm\iso\ubuntu-24.04.5-live-server-amd64.download.log'
$existing = Get-CimInstance Win32_Process -Filter "Name='curl.exe'" | Where-Object { $_.CommandLine -like "*$iso*" }
if ($existing) { $existing | Select-Object ProcessId,CommandLine | ConvertTo-Json; exit 0 }
$process = Start-Process -FilePath 'C:\Windows\System32\curl.exe' -ArgumentList @('--fail','--location','--continue-at','-','--retry','5','--retry-all-errors','--output',$iso,'https://releases.ubuntu.com/24.04/ubuntu-24.04.5-live-server-amd64.iso') -WindowStyle Hidden -RedirectStandardError $log -PassThru
[pscustomobject]@{ ProcessId = $process.Id; Iso = $iso; Log = $log } | ConvertTo-Json
