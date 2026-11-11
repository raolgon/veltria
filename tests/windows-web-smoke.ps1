param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$BrowseCompatible)
$ErrorActionPreference = 'Stop'
$data = Join-Path ([IO.Path]::GetTempPath()) ('Veltria native browser launcher with spaces ' + [guid]::NewGuid())
$p = $null
$descriptor = $null
try {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $Root ('build\browser\'+(Get-Content -Raw (Join-Path $Root 'package.json') | ConvertFrom-Json).version+'\veltria-web.exe')
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.EnvironmentVariables['VELTRIA_DATA_DIR'] = $data
  $p = [Diagnostics.Process]::Start($info)
  $first = $p.StandardOutput.ReadLineAsync()
  if (-not $first.Wait(15000)) { throw 'Timeout del lanzador' }
  $second = $p.StandardOutput.ReadLineAsync()
  if (-not $second.Wait(5000)) { throw 'No se imprimio el enlace' }
  $url = $second.Result
  if ($url -notmatch '^(http://127\.0\.0\.1:\d+)/#launch=([a-f0-9]{64})$') { throw 'Enlace no valido' }
  $origin = $Matches[1]
  $nonce = $Matches[2]
  $response = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$nonce} | ConvertTo-Json) -SessionVariable localSession
  if (-not ($response.Content | ConvertFrom-Json).csrf) { throw 'No se autorizo la sesion' }
  if ((Invoke-WebRequest -UseBasicParsing -Uri $origin).Content -notmatch '<title>Veltria</title>') { throw 'No se sirvio la UI' }
  $resources = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/resources" -WebSession $localSession).Content | ConvertFrom-Json
  if ($resources.platform -ne 'win32' -or $resources.ram.total -le 0 -or $resources.disk.available -le 0) { throw 'Lectura de recursos Windows no valida' }
  Write-Output ('WINDOWS RESOURCES: ' + ($resources | ConvertTo-Json -Depth 5 -Compress))
  if ($BrowseCompatible) {
    $csrf = ($response.Content | ConvertFrom-Json).csrf
    $browse = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/catalog/browse" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin;'x-veltria-csrf'=$csrf} -WebSession $localSession -Body '{"kind":"all"}' -TimeoutSec 40).Content | ConvertFrom-Json
    if ($browse.hardwareReason) { throw $browse.hardwareReason }
    $previousDownloads = [double]::PositiveInfinity
    foreach ($entry in $browse.results) {
      if (-not $entry.supported -or $entry.family -ne 'SD 1.5') { throw 'Resultado incompatible en exploracion del equipo' }
      if ($null -ne $entry.downloads) { if ($entry.downloads -gt $previousDownloads) { throw 'Orden de popularidad incorrecto' }; $previousDownloads = $entry.downloads }
    }
    Write-Output ('WINDOWS REAL BROWSE: ' + (@{count=@($browse.results).Count;hasMore=[bool]$browse.nextCursor;partial=$browse.partial;downloads=@($browse.results | ForEach-Object {$_.downloads})} | ConvertTo-Json -Compress))
  }
  $descriptor = Get-Content -Raw (Join-Path $data '.service-lock\instance.json') | ConvertFrom-Json
  $null = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken}
  if (-not $p.WaitForExit(10000)) { throw 'El lanzador no detecto la salida del auxiliar' }
  if (Test-Path (Join-Path $data '.service-lock')) { throw 'No se libero el directorio de datos' }
  Write-Output 'WINDOWS WEB LAUNCHER PASS: standalone launcher and helper, local UI, one-use authorization, data path with spaces and child-exit detection. Ctrl+C in an interactive terminal remains manual.'
} finally {
  if ($p -and -not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  if (Test-Path $data) { Remove-Item -LiteralPath $data -Recurse -Force }
}
