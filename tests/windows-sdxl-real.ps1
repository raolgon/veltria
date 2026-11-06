# Explicit opt-in: existing SDXL checkpoint, native UI and one GPU image.
param([string]$Root = '', [Parameter(Mandatory=$true)][string]$ModelsDirectory, [string]$Runtime = '', [switch]$CustomQuality)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path $PSScriptRoot -Parent }
$version = (Get-Content -Raw (Join-Path $Root 'package.json') | ConvertFrom-Json).version
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = Join-Path $Root ('release\'+$version+'\win-unpacked\Veltria.exe')
if ($Runtime) { $info.FileName = $Runtime }
$info.Arguments = '"'+(Join-Path $Root 'tests\windows-sdxl-real.cjs')+'" "'+$ModelsDirectory+'"'
if ($CustomQuality) { $info.Arguments += ' --custom-quality' }
$info.WorkingDirectory = $Root
$info.UseShellExecute = $false; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
# Reuse Electron's shipped Node runtime; do not install Node or another browser.
$info.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1'
$process = [Diagnostics.Process]::Start($info)
$errors = $process.StandardError.ReadToEndAsync()
while (-not $process.StandardOutput.EndOfStream) { $line=$process.StandardOutput.ReadLine(); if($line){ Write-Output $line } }
$process.WaitForExit()
if($errors.Result){Write-Output $errors.Result}
exit $process.ExitCode
