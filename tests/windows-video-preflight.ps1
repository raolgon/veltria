param([string]$Root = '', [Parameter(Mandatory=$true)][string]$EngineDirectory, [Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = Split-Path $PSScriptRoot -Parent }
$data = Join-Path $env:LOCALAPPDATA ('Veltria\video-validation-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$launcher = $null
$descriptor = $null
try {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $Root 'build\browser\0.4.0\veltria-web.exe'
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.EnvironmentVariables['VELTRIA_DATA_DIR'] = $data
  $launcher = [Diagnostics.Process]::Start($info)
  $null = $launcher.StandardOutput.ReadLine()
  $url = $launcher.StandardOutput.ReadLine()
  if ($url -notmatch '^(http://127\.0\.0\.1:\d+)/#launch=([a-f0-9]{64})$') { throw 'Invalid launcher URL' }
  $origin = $Matches[1]; $nonce = $Matches[2]
  $auth = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$nonce}|ConvertTo-Json) -SessionVariable localSession
  $csrf = ($auth.Content|ConvertFrom-Json).csrf
  $headers = @{Origin=$origin;'x-veltria-csrf'=$csrf}
  $descriptor = Get-Content -Raw (Join-Path $data '.service-lock\instance.json') | ConvertFrom-Json
  $settings = @{engineBinding=@{directory=$EngineDirectory;python=$Python};locale='en'}|ConvertTo-Json
  $null = Invoke-RestMethod -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body $settings
  $plan = Invoke-RestMethod -Uri "$origin/api/v1/video/plan" -WebSession $localSession
  Write-Output ('NATIVE VIDEO PLAN: '+($plan|ConvertTo-Json -Depth 6 -Compress))
  if (-not $plan.canPrepare -or @($plan.components|Where-Object {$_.status -ne 'present'}).Count -ne 0) { throw 'Existing video components not ready' }
  $null = Invoke-RestMethod -Uri "$origin/api/v1/video/prepare" -Method POST -ContentType 'application/json' -Headers $headers -WebSession $localSession -Body (@{revision=$plan.revision;acceptLicense=$true;acceptExperimental=$true}|ConvertTo-Json)
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Milliseconds 500
    $state = Invoke-RestMethod -Uri "$origin/api/v1/video" -WebSession $localSession
    if ($state.preparation.status -eq 'error') { throw $state.preparation.message }
  } while (-not $state.canCreate -and (Get-Date) -lt $deadline)
  if (-not $state.canCreate) { throw 'Video preparation timed out' }
  Write-Output ('NATIVE VIDEO PREPARATION: '+($state|ConvertTo-Json -Depth 5 -Compress))
  # Verify the native MP4 node API and PyAV adapter with a synthetic, non-AI clip.
  $log = Get-Content -Raw (Join-Path $data 'video-engine\engine.log')
  $ports = [regex]::Matches($log,'http://127\.0\.0\.1:\d+')
  if (-not $ports.Count) { throw 'Own engine URL missing' }
  $comfy = $ports[$ports.Count-1].Value
  $stats = Invoke-RestMethod -Uri "$comfy/system_stats"
  if (($stats.system.argv -join ' ') -notlike "*$data*") { throw 'Refusing an engine outside this test' }
  # Validate the full curated H3 graph without queuing it: its only output is
  # deliberately missing a required string. The native validator checks all
  # upstream links first and must report only this exact output omission.
  $graphPath = Join-Path $Root 'build\test-tools\h3-preview-api.json'
  if (Test-Path $graphPath) {
    $graph = Get-Content -Raw $graphPath | ConvertFrom-Json
    if (@($graph.PSObject.Properties).Count -ne 15 -or @($graph.PSObject.Properties|Where-Object {$_.Value.class_type -eq 'SaveVideo'}).Count -ne 1 -or $graph.'15'.class_type -ne 'SaveVideo') { throw 'Unexpected diagnostic graph' }
    $schema = Invoke-RestMethod -Uri "$comfy/object_info/SaveVideo"
    if (-not ($schema.SaveVideo.input.required.PSObject.Properties.Name -contains 'filename_prefix')) { throw 'Missing safe validation guard' }
    $graph.'15'.inputs.PSObject.Properties.Remove('filename_prefix')
    try {
      $null = Invoke-WebRequest -UseBasicParsing -Uri "$comfy/prompt" -Method POST -ContentType 'application/json' -Body (@{prompt_id=[guid]::NewGuid().ToString();prompt=$graph}|ConvertTo-Json -Depth 16)
      throw 'The diagnostic graph was unexpectedly accepted'
    } catch {
      if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 400) { throw }
      $details = $_.ErrorDetails.Message | ConvertFrom-Json
      $errors = @($details.node_errors.PSObject.Properties)
      if ($errors.Count -ne 1 -or $errors[0].Name -ne '15' -or $details.node_errors.'15'.errors[0].type -ne 'required_input_missing' -or $details.node_errors.'15'.errors[0].extra_info.input_name -ne 'filename_prefix') { throw ('H3 graph validation failed: '+$_.ErrorDetails.Message) }
      Write-Output 'NATIVE H3 GRAPH VALIDATION PASS: all upstream schemas/links validated; required output omission rejected submission, no inference queued.'
    }
  }
  $id = [guid]::NewGuid().ToString()
  $workflow = @{
    '1'=@{class_type='EmptyImage';inputs=@{width=448;height=256;batch_size=22;color=2367773}}
    '2'=@{class_type='CreateVideo';inputs=@{images=@('1',0);fps=24;bit_depth=8;color_space='sRGB'}}
    '3'=@{class_type='SaveVideo';inputs=@{video=@('2',0);filename_prefix=('veltria_native_transport_fixture_'+$id);format='mp4';'format.codec'='h264';'format.codec.encoding'='auto'}}
  }
  $null = Invoke-RestMethod -Uri "$comfy/prompt" -Method POST -ContentType 'application/json' -Body (@{prompt_id=$id;prompt=$workflow}|ConvertTo-Json -Depth 12)
  $result = $null
  for($index=0;$index -lt 60;$index++) {
    Start-Sleep -Milliseconds 500
    $history = Invoke-RestMethod -Uri "$comfy/history/$id"
    $entry = $history.$id
    if($entry.status.status_str -eq 'error') { throw ($entry.status|ConvertTo-Json -Depth 8) }
    if($entry.outputs.'3'.images) { $result=$entry.outputs.'3'.images[0]; break }
  }
  if(-not $result -or -not $result.filename.StartsWith('veltria_native_transport_fixture_'+$id)) { throw 'Native MP4 fixture not returned' }
  $file = Join-Path $data 'native-transport-fixture-not-AI.mp4'
  $null = Invoke-WebRequest -UseBasicParsing -Uri ($comfy+'/view?filename='+[uri]::EscapeDataString($result.filename)+'&subfolder='+[uri]::EscapeDataString($result.subfolder)+'&type=output') -OutFile $file
  $probeInfo = New-Object Diagnostics.ProcessStartInfo
  $probeInfo.FileName = Join-Path $Root 'build\test-tools\video-probe.exe'
  $probeInfo.Arguments = '"'+$file+'" "'+$Python+'"'
  $probeInfo.UseShellExecute=$false; $probeInfo.RedirectStandardOutput=$true; $probeInfo.RedirectStandardError=$true
  $probe = [Diagnostics.Process]::Start($probeInfo)
  $output=$probe.StandardOutput.ReadToEnd(); $errorOutput=$probe.StandardError.ReadToEnd(); $probe.WaitForExit()
  if($probe.ExitCode -ne 0) { throw $errorOutput }
  $metadata=$output|ConvertFrom-Json
  if($metadata.width -ne 448 -or $metadata.height -ne 256 -or $metadata.frames -ne 22 -or $metadata.codec -ne 'h264') { throw 'Native MP4 metadata mismatch' }
  Write-Output ('NATIVE MP4 TRANSPORT (NOT H3 INFERENCE): '+$output)
  Write-Output ('VALIDATION DATA: '+$data)
} finally {
  if($descriptor) { try { $null=Invoke-WebRequest -UseBasicParsing -Uri "$($descriptor.origin)/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken} } catch {} }
  if($launcher -and -not $launcher.HasExited) { if(-not $launcher.WaitForExit(15000)) { $launcher.Kill(); $launcher.WaitForExit() } }
}
