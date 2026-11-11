$ErrorActionPreference = 'Stop'
$target = 'D:\Veltria\lab\linux'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
[pscustomobject]@{
  LinuxEnvironmentExists = Test-Path -LiteralPath $target
  VeltriaLabRegistered = ((& wsl.exe -l -q) -join "`n") -match '(?m)^Veltria-Lab\s*$'
  PreservedModels = Test-Path -LiteralPath 'D:\Veltria\models'
} | ConvertTo-Json
