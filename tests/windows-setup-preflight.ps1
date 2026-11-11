# Native first-run validation: discover ComfyUI without engine/Python paths.
param([string]$Root = '', [Parameter(Mandatory=$true)][string]$ModelsDirectory)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path $PSScriptRoot -Parent }
$data = Join-Path $env:LOCALAPPDATA ('Veltria\setup-validation-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$launcher = $null; $descriptor = $null
try {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $Root ('build\browser\'+(Get-Content -Raw (Join-Path $Root 'package.json') | ConvertFrom-Json).version+'\veltria-web.exe')
  $info.UseShellExecute = $false; $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
  $info.EnvironmentVariables['VELTRIA_DATA_DIR'] = $data
  $launcher = [Diagnostics.Process]::Start($info)
  $first = $launcher.StandardOutput.ReadLineAsync()
  if (-not $first.Wait(15000)) { throw 'Launcher timeout' }
  $second = $launcher.StandardOutput.ReadLineAsync()
  if (-not $second.Wait(5000) -or $second.Result -notmatch '^(http://127\.0\.0\.1:\d+)/#launch=([a-f0-9]{64})$') { throw 'Invalid launcher URL' }
  $origin = $Matches[1]; $nonce = $Matches[2]
  $auth = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$nonce}|ConvertTo-Json) -SessionVariable localSession
  $headers = @{Origin=$origin; 'x-veltria-csrf'=($auth.Content|ConvertFrom-Json).csrf}
  $descriptor = Get-Content -Raw (Join-Path $data '.service-lock\instance.json') | ConvertFrom-Json
  # Only select the already authorized managed weight location; no installation hints.
  $null = Invoke-RestMethod -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{modelsDirectory=$ModelsDirectory;locale='en'}|ConvertTo-Json)
  $null = Invoke-RestMethod -Uri "$origin/api/v1/setup/scan" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body '{}'
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 300
    $scan = Invoke-RestMethod -Uri "$origin/api/v1/setup" -WebSession $localSession
    if ($scan.status -eq 'error') { throw $scan.message }
  } while ($scan.status -ne 'complete' -and (Get-Date) -lt $deadline)
  $installation = $scan.installations | Where-Object {$_.available} | Select-Object -First 1
  if (-not $installation) { throw ('No usable automatic candidate: '+($scan|ConvertTo-Json -Depth 6)) }
  $plan = Invoke-RestMethod -Uri "$origin/api/v1/setup/plan" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{scanId=$scan.scanId;installationId=$installation.id}|ConvertTo-Json)
  $settings = Invoke-RestMethod -Uri "$origin/api/v1/settings" -WebSession $localSession
  if ($settings.engineBinding) { throw 'Search or proposal changed settings without consent' }
  if ($plan.preparation.remainingBytes -ne 0) { throw 'Refusing to download weights during validation' }
  if (-not $plan.preparation.canPrepare) { throw ($plan.preparation.blockers -join ' ') }
  $null = Invoke-RestMethod -Uri "$origin/api/v1/setup/prepare" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{revision=$plan.revision;acceptLicense=$true;acceptReuse=$true}|ConvertTo-Json)
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Milliseconds 500
    $state = Invoke-RestMethod -Uri "$origin/api/v1/creation" -WebSession $localSession
    if ($state.preparation.status -eq 'error') { throw $state.preparation.message }
  } while (-not $state.canCreate -and (Get-Date) -lt $deadline)
  if (-not $state.canCreate) { throw 'Preparation timed out' }
  $library = Invoke-RestMethod -Uri "$origin/api/v1/jobs" -WebSession $localSession
  if ($library.total -ne 0) { throw 'Preparation generated an image without an explicit request' }
  $job = Invoke-RestMethod -Uri "$origin/api/v1/jobs" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{requestId=[guid]::NewGuid().ToString();prompt='A single amber stone arch in a quiet desert at sunrise, soft natural light';format='square'}|ConvertTo-Json)
  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep -Milliseconds 500
    $job = Invoke-RestMethod -Uri "$origin/api/v1/jobs/$($job.id)" -WebSession $localSession
    if ($job.status -in @('failed','interrupted','cancelled')) { throw $job.message }
  } while ($job.status -ne 'completed' -and (Get-Date) -lt $deadline)
  if ($job.status -ne 'completed' -or $job.width -ne 512 -or $job.height -ne 512) { throw 'Real generation did not finish as expected' }
  $record = @{installation=$installation;job=$job;scanNotes=$scan.notes}
  $record | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $data 'validated-setup.json')
  Write-Output 'WINDOWS AUTOMATIC SETUP PASS: search without engine/Python paths; proposal read-only; approved reuse; existing SD15 SHA verified; real image generated only on explicit request; no weight downloaded.'
  Write-Output ('DETECTED ENGINE: '+$installation.directory)
  Write-Output ('DETECTED PYTHON: '+$installation.python)
  Write-Output ('VALIDATION IMAGE: '+(Join-Path $data ('creations\'+$job.id+'.png')))
  Write-Output ('VALIDATION DATA: '+$data)
} finally {
  if ($descriptor) { try { $null=Invoke-WebRequest -UseBasicParsing -Uri "$($descriptor.origin)/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken} } catch {} }
  if ($launcher -and -not $launcher.HasExited) { if (-not $launcher.WaitForExit(15000)) { $launcher.Kill(); $launcher.WaitForExit() } }
}
if ($descriptor -and (Test-Path (Join-Path $data '.service-lock'))) { throw 'Validation helper did not release its lock' }
Write-Output 'VALIDATION CLEANUP PASS: owned helper and engine closed.'
