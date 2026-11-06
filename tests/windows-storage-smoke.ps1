param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
$test = Join-Path $Root 'build\validation\storage-check.exe'
if (-not (Test-Path -LiteralPath $test)) { throw 'Compile scripts/validate-model-storage.ts for bun-windows-x64-baseline first.' }
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = $test
$info.UseShellExecute = $false
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$process = [Diagnostics.Process]::Start($info)
$output = $process.StandardOutput.ReadToEndAsync()
$errors = $process.StandardError.ReadToEndAsync()
$process.WaitForExit()
Write-Output $output.Result
if ($errors.Result) { Write-Output $errors.Result }
if ($process.ExitCode -ne 0) { exit $process.ExitCode }
if ($output.Result -notmatch 'STORAGE FILESYSTEM PASS: win32') { throw 'No se obtuvo un resultado de validacion nativa.' }
