$ErrorActionPreference = 'Stop'
$windowsEnv = 'D:\Veltria\lab\windows-native-20261110'
$linuxEnv = 'D:\Veltria\lab\linux'
foreach ($target in @($windowsEnv, $linuxEnv)) {
  if (-not (Test-Path -LiteralPath $target)) { throw "Expected environment not found: $target" }
}
$wslList = (& wsl.exe -l -q) -join "`n"
if ($wslList -match '(?m)^Veltria-Lab\s*$') {
  & wsl.exe --terminate Veltria-Lab
  & wsl.exe --unregister Veltria-Lab
  if ($LASTEXITCODE -ne 0) { throw 'Could not unregister Veltria-Lab' }
}
foreach ($target in @($windowsEnv, $linuxEnv)) {
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
[pscustomobject]@{
  WindowsEnvironmentExists = Test-Path -LiteralPath $windowsEnv
  LinuxEnvironmentExists = Test-Path -LiteralPath $linuxEnv
  VeltriaLabRegistered = ((& wsl.exe -l -q) -join "`n") -match '(?m)^Veltria-Lab\s*$'
  PreservedModels = Test-Path -LiteralPath 'D:\Veltria\models'
} | ConvertTo-Json
