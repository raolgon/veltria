param([ValidateSet('Deploy','Start','Stop','Status','CrashExtraction','CrashDependencies')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$labRoot = 'D:\Veltria\lab\windows-native-20261110'
$projectRoot = Split-Path $PSScriptRoot -Parent
$data = Join-Path $labRoot 'data'
$descriptorPath = Join-Path $data '.service-lock\instance.json'
if ((Test-Path -LiteralPath $labRoot) -and ((Get-Item -LiteralPath $labRoot).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Refusing a redirected lab root' }
if ($Action -eq 'Deploy') {
  if (Test-Path -LiteralPath $descriptorPath) { throw 'Stop the lab service before replacing its package' }
  foreach ($folder in @('app\resources\service','data\models\checkpoints','temp','profile\AppData\Roaming','profile\AppData\Local','reports','cache\HF_HOME','cache\TORCH_HOME','cache\CUDA_CACHE_PATH')) { $null=New-Item -ItemType Directory -Path (Join-Path $labRoot $folder) -Force }
  Copy-Item -LiteralPath (Join-Path $projectRoot 'build\browser\0.10.0\veltria-web.exe') -Destination (Join-Path $labRoot 'app\veltria-web.exe') -Force
  Copy-Item -LiteralPath (Join-Path $projectRoot 'build\service\veltria-service.exe') -Destination (Join-Path $labRoot 'app\resources\service\veltria-service.exe') -Force
  # Copy contents so repeated deploys never nest dist/ui directories.
  Get-ChildItem -LiteralPath (Join-Path $projectRoot 'apps\ui\dist') | Copy-Item -Destination (Join-Path $labRoot 'app\resources\ui') -Recurse -Force
  Write-Output 'Windows lab package deployed; existing models and results preserved.'
  exit
}
if ($Action -eq 'Start') {
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=Join-Path $labRoot 'app\veltria-web.exe'; $info.WorkingDirectory=$labRoot
  $info.UseShellExecute=$false; $info.CreateNoWindow=$true; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
  $info.EnvironmentVariables['VELTRIA_DATA_DIR']=$data
  $info.EnvironmentVariables['USERPROFILE']=Join-Path $labRoot 'profile'
  $info.EnvironmentVariables['APPDATA']=Join-Path $labRoot 'profile\AppData\Roaming'
  $info.EnvironmentVariables['LOCALAPPDATA']=Join-Path $labRoot 'profile\AppData\Local'
  foreach($name in @('TEMP','TMP')) { $info.EnvironmentVariables[$name]=Join-Path $labRoot 'temp' }
  foreach($name in @('HF_HOME','TORCH_HOME','CUDA_CACHE_PATH')) { $info.EnvironmentVariables[$name]=Join-Path $labRoot ('cache\'+$name) }
  $process=[Diagnostics.Process]::Start($info)
  $lines=@()
  for($i=0;$i -lt 3;$i++) { $line=$process.StandardOutput.ReadLineAsync(); if(-not $line.Wait(20000)) { throw 'Lab launcher timeout' }; $lines+=$line.Result }
  $lines | Set-Content -Encoding UTF8 (Join-Path $labRoot 'reports\launch.log')
  $lines | Write-Output
  exit
}
$descriptor=Get-Content -Raw -LiteralPath $descriptorPath | ConvertFrom-Json
if($descriptor.origin -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Invalid lab service origin' }
if($Action -eq 'Stop') {
  $null=Invoke-WebRequest -UseBasicParsing -Uri ($descriptor.origin+'/api/v1/control/shutdown') -Method POST -ContentType 'application/json' -Headers @{'x-veltria-control'=$descriptor.controlToken} -Body '{}'
  $stopDeadline=(Get-Date).AddSeconds(25)
  while(Test-Path -LiteralPath $descriptorPath) {
    if((Get-Date) -ge $stopDeadline) { throw 'Lab service did not finish its controlled shutdown' }
    Start-Sleep -Milliseconds 100
  }
  Write-Output 'Windows lab service stopped; data preserved.'
  exit
}
$launch=Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/control/launch') -Method POST -ContentType 'application/json' -Headers @{'x-veltria-control'=$descriptor.controlToken} -Body '{}'
$auth=Invoke-WebRequest -UseBasicParsing -Uri ($descriptor.origin+'/api/v1/session') -Method POST -ContentType 'application/json' -Headers @{Origin=$descriptor.origin} -Body (@{nonce=$launch.nonce}|ConvertTo-Json) -SessionVariable session
if ($Action -in @('CrashExtraction','CrashDependencies')) {
  $phase = if ($Action -eq 'CrashExtraction') { 'Preparando los archivos' } else { 'Instalando los componentes' }
  $deadline = (Get-Date).AddMinutes(10)
  do {
    $state = Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/setup/managed') -WebSession $session
    if ($state.status -eq 'error') { throw $state.message }
    if ($state.status -eq 'installing' -and $state.message.StartsWith($phase)) {
      $process = Get-CimInstance Win32_Process -Filter ('ProcessId='+$descriptor.pid)
      $expected = Join-Path $labRoot 'app\resources\service\veltria-service.exe'
      if (-not $process -or -not [string]::Equals($process.ExecutablePath,$expected,[StringComparison]::OrdinalIgnoreCase) -or $process.CommandLine.IndexOf($data,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Refusing to terminate an unexpected process' }
      $null = & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $descriptor.pid /T /F
      if ($LASTEXITCODE -ne 0) { throw 'Could not terminate the isolated lab process tree' }
      @{phase=$Action;state=$state;pid=$descriptor.pid;at=(Get-Date).ToUniversalTime().ToString('O')} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $labRoot ('reports\'+$Action+'.json'))
      Write-Output ('Forced process-tree termination during '+$phase)
      exit
    }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)
  throw 'Requested crash phase was not reached'
}
$managed=Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/setup/managed') -WebSession $session
$creation=Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/creation') -WebSession $session
$jobs=Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/jobs') -WebSession $session
@{managed=$managed;preparation=$creation.preparation;canCreate=$creation.canCreate;jobCount=$jobs.total} | ConvertTo-Json -Depth 6 -Compress
