# Explicit native integration check: reuses an existing weight, never downloads one.
param([string]$Root = '', [Parameter(Mandatory=$true)][string]$EngineDirectory, [Parameter(Mandatory=$true)][string]$Python, [Parameter(Mandatory=$true)][string]$ModelsDirectory)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path $PSScriptRoot -Parent }
$data = Join-Path $env:LOCALAPPDATA ('Veltria\catalog-validation-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$launcher = $null; $descriptor = $null
try {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $Root 'build\browser\0.4.0\veltria-web.exe'
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
  $info.EnvironmentVariables['VELTRIA_DATA_DIR'] = $data
  $launcher = [Diagnostics.Process]::Start($info)
  $first = $launcher.StandardOutput.ReadLineAsync()
  if (-not $first.Wait(15000)) { throw 'Launcher timeout' }
  $second = $launcher.StandardOutput.ReadLineAsync()
  if (-not $second.Wait(5000) -or $second.Result -notmatch '^(http://127\.0\.0\.1:\d+)/#launch=([a-f0-9]{64})$') { throw 'Invalid launcher URL' }
  $origin = $Matches[1]; $nonce = $Matches[2]
  $auth = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$nonce}|ConvertTo-Json) -SessionVariable localSession
  $headers = @{Origin=$origin;'x-veltria-csrf'=($auth.Content|ConvertFrom-Json).csrf}
  $descriptor = Get-Content -Raw (Join-Path $data '.service-lock\instance.json') | ConvertFrom-Json
  $settings = @{engineBinding=@{directory=$EngineDirectory;python=$Python};modelsDirectory=$ModelsDirectory;locale='en'}|ConvertTo-Json
  $null = Invoke-RestMethod -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body $settings
  $catalog = Invoke-RestMethod -Uri "$origin/api/v1/catalog" -WebSession $localSession
  $configuration = Invoke-RestMethod -Uri "$origin/api/v1/catalog/configurations/$($catalog.selectedConfigurationId)" -WebSession $localSession
  $configuration.name = 'Native draft landscape'
  $configuration.parameters.steps=12; $configuration.parameters.cfg=6; $configuration.parameters.format='landscape'
  $entry = Invoke-RestMethod -Uri "$origin/api/v1/catalog/configurations" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body ($configuration|ConvertTo-Json -Depth 8)
  $null = Invoke-RestMethod -Uri "$origin/api/v1/catalog/select" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{configurationId=$entry.id}|ConvertTo-Json)
  $plan = Invoke-RestMethod -Uri "$origin/api/v1/creation/plan" -WebSession $localSession
  if ($plan.remainingBytes -ne 0) { throw 'Refusing to download weights in this validation' }
  if (-not $plan.canPrepare) { throw ($plan.blockers -join ' ') }
  $null = Invoke-RestMethod -Uri "$origin/api/v1/creation/prepare" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{revision=$plan.revision;acceptLicense=$true}|ConvertTo-Json)
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Milliseconds 500
    $state = Invoke-RestMethod -Uri "$origin/api/v1/creation" -WebSession $localSession
    if ($state.preparation.status -eq 'error') { throw $state.preparation.message }
  } while (-not $state.canCreate -and (Get-Date) -lt $deadline)
  if (-not $state.canCreate) { throw 'Preparation timed out' }
  $job = Invoke-RestMethod -Uri "$origin/api/v1/jobs" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{requestId=[guid]::NewGuid().ToString();prompt='A quiet desert at dawn, a single amber stone arch, soft natural light, wide landscape';format=$state.configuration.format}|ConvertTo-Json)
  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep -Milliseconds 500
    $job = Invoke-RestMethod -Uri "$origin/api/v1/jobs/$($job.id)" -WebSession $localSession
    if ($job.status -in @('failed','interrupted','cancelled')) { throw $job.message }
  } while ($job.status -ne 'completed' -and (Get-Date) -lt $deadline)
  if ($job.status -ne 'completed' -or $job.steps -ne 12 -or $job.cfg -ne 6 -or $job.width -ne 512 -or $job.height -ne 384 -or $job.configurationId -ne $entry.id) { throw 'Generation or saved configuration mismatch' }
  $state = Invoke-RestMethod -Uri "$origin/api/v1/creation" -WebSession $localSession
  if (-not $state.recommendation.verified) { throw 'Completed configuration evidence missing' }
  $image = Join-Path $data ('creations\'+$job.id+'.png')
  if (-not (Test-Path $image)) { throw 'Library image missing' }
  $job | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $data 'validated-job.json')
  Write-Output ('WINDOWS REAL SD15 CONFIGURATION PASS: 12 steps, CFG 6, 512x384, existing checkpoint SHA-256 verified; imported selection used by native ComfyUI '+$job.engineVersion+'. No weight downloaded.')
  Write-Output ('VALIDATION IMAGE: '+$image)
  Write-Output ('VALIDATION DATA: '+$data)
} finally {
  if ($descriptor) { try { $null=Invoke-WebRequest -UseBasicParsing -Uri "$($descriptor.origin)/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken} } catch {} }
  if ($launcher -and -not $launcher.HasExited) { if (-not $launcher.WaitForExit(15000)) { $launcher.Kill(); $launcher.WaitForExit() } }
}

if ($descriptor -and (Test-Path (Join-Path $data '.service-lock'))) { throw 'Validation helper did not release its lock' }
Write-Output 'VALIDATION CLEANUP PASS: owned service and engine closed.'
