param([string]$Root='',[Parameter(Mandatory=$true)][string]$ModelsDirectory)
$ErrorActionPreference='Stop'
if(-not $Root){$Root=Split-Path $PSScriptRoot -Parent}
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=Join-Path $Root 'build\validation\prepare-sdxl.exe'
$info.Arguments='"'+$ModelsDirectory+'" --authorize-sdxl'
$info.UseShellExecute=$false;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$p=[Diagnostics.Process]::Start($info)
$errors=$p.StandardError.ReadToEndAsync()
while(-not $p.StandardOutput.EndOfStream){$line=$p.StandardOutput.ReadLine();if($line){Write-Output $line}}
$p.WaitForExit();if($errors.Result){Write-Output $errors.Result};exit $p.ExitCode
