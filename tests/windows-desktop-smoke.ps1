param([string]$Root = (Split-Path $PSScriptRoot -Parent), [string]$Executable = '')
$ErrorActionPreference = 'Stop'
$data = Join-Path ([IO.Path]::GetTempPath()) ('Veltria desktop native with spaces ' + [guid]::NewGuid())
$p = $null
$descriptor = $null
try {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = if ($Executable) { $Executable } else { Join-Path $Root 'release\0.5.0\win-unpacked\Veltria.exe' }
  $info.UseShellExecute = $false
  $info.EnvironmentVariables['VELTRIA_DATA_DIR'] = $data
  $p = [Diagnostics.Process]::Start($info)
  $path = Join-Path $data '.service-lock\instance.json'
  for ($i=0; $i -lt 200; $i++) {
    Start-Sleep -Milliseconds 100
    if ($p.HasExited) { throw 'Electron termino antes de abrir' }
    if (Test-Path $path) {
      try { $descriptor = Get-Content -Raw $path | ConvertFrom-Json } catch { continue }
      if ($descriptor.origin) { break }
    }
  }
  if (-not $descriptor.origin) { throw 'No aparecio el auxiliar' }
  $origin = $descriptor.origin
  $launch = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/control/launch" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken}).Content | ConvertFrom-Json
  $auth = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$launch.nonce} | ConvertTo-Json) -SessionVariable localSession
  $csrf = ($auth.Content | ConvertFrom-Json).csrf
  $health = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/health" -WebSession $localSession).Content | ConvertFrom-Json
  if ($health.name -ne 'veltria' -or -not $health.capabilities.generation) { throw 'Capacidades incorrectas' }
  if ($Executable) {
    $resources = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/resources" -WebSession $localSession).Content | ConvertFrom-Json
    if ($resources.platform -ne 'win32' -or $resources.ram.total -le 0) { throw 'El paquete no expone recursos Windows reales' }
  }
  for ($i=0; $i -lt 100; $i++) {
    $p.Refresh()
    if ($p.MainWindowHandle -ne 0 -and $p.MainWindowTitle -eq 'Veltria') { break }
    Start-Sleep -Milliseconds 100
  }
  if ($p.MainWindowHandle -eq 0) { throw 'Electron no mostro ventana nativa' }
  $patch = if ($Executable) { '{"theme":"dark","locale":"en"}' } else { '{"theme":"dark"}' }
  $saved = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -WebSession $localSession -Headers @{Origin=$origin; 'x-veltria-csrf'=$csrf} -Body $patch).Content | ConvertFrom-Json
  if ($Executable -and $saved.locale -ne 'en') { throw 'No se guardo el idioma en Windows' }
  if (-not $p.CloseMainWindow()) { throw 'No se pudo solicitar cierre de ventana' }
  if (-not $p.WaitForExit(15000)) { throw 'Electron no cerro en Windows' }
  if (Test-Path $path) { throw 'Electron dejo el bloqueo del auxiliar propio' }
  if (-not (Test-Path (Join-Path $data 'settings.sqlite'))) { throw 'No se conservaron los ajustes' }
  Write-Output 'WINDOWS DESKTOP PASS: native packaged Electron window, Bun helper outside ASAR, authorized API, settings, close through WM_CLOSE, SQLite preserved and paths with spaces. Visual review remains manual.'
} finally {
  if ($p -and -not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  if ($descriptor -and (Test-Path (Join-Path $data '.service-lock\instance.json'))) {
    try { $null = Invoke-WebRequest -UseBasicParsing -Uri "$($descriptor.origin)/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$descriptor.controlToken} } catch {}
  }
  if (Test-Path $data) { Remove-Item -LiteralPath $data -Recurse -Force }
}
