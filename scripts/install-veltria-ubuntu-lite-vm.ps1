$ErrorActionPreference = 'Stop'
$vbox = 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe'
$name = 'Veltria-Ubuntu-Lite'
$iso = 'D:\Veltria\vm\iso\ubuntu-24.04.5-live-server-amd64.iso.part'
$credentialFile = 'D:\Veltria\vm\Veltria-Ubuntu-Lite\unattended-password.txt'
if (-not (Test-Path -LiteralPath $iso)) { throw "Verified installation ISO is missing: $iso" }
$state = (& $vbox showvminfo $name --machinereadable | Select-String '^VMState=').ToString()
if ($state -notmatch 'poweroff') { throw "VM must be powered off: $state" }
$alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%'
$password = -join (1..24 | ForEach-Object { $alphabet[(Get-Random -Maximum $alphabet.Length)] })
Set-Content -LiteralPath $credentialFile -Value $password -NoNewline -Encoding ASCII
try {
  & $vbox unattended install $name "--iso=$iso" --user=veltria "--user-password-file=$credentialFile" --full-user-name=Veltria --locale=es_MX --country=MX --time-zone=America/Mexico_City --hostname=veltria-ubuntu-lite.local --package-selection-adjustment=minimal --no-install-additions --start-vm=headless
  if ($LASTEXITCODE -ne 0) { throw "VirtualBox unattended install exited with $LASTEXITCODE" }
} finally { Remove-Item -LiteralPath $credentialFile -Force -ErrorAction SilentlyContinue }
[pscustomobject]@{ Name=$name; User='veltria'; Password=$password; Iso=$iso; Status='installer started headless' } | ConvertTo-Json
