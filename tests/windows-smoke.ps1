param(
  [string]$Root = (Split-Path $PSScriptRoot -Parent)
)
$ErrorActionPreference = 'Stop'
$exe = Join-Path $Root 'build\service\veltria-service.exe'
$ui = Join-Path $Root 'apps\ui\dist'
$data = Join-Path ([IO.Path]::GetTempPath()) ('Veltria native Windows with spaces ' + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path $data
$p = $null
$control = -join (1..64 | ForEach-Object { '0123456789abcdef'[(Get-Random -Maximum 16)] })
function Start-Veltria {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $exe
  $info.Arguments = '--ui-dir "' + $ui + '" --data-dir "' + $data + '"'
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $script:p = [Diagnostics.Process]::Start($info)
  $p.StandardInput.WriteLine((@{controlToken=$control} | ConvertTo-Json -Compress))
  $p.StandardInput.Close()
  $read = $p.StandardOutput.ReadLineAsync()
  if (-not $read.Wait(15000)) { throw 'Timeout de arranque Windows' }
  if (-not $read.Result) { throw ('No hubo respuesta: ' + $p.StandardError.ReadToEnd()) }
  $script:ready = $read.Result | ConvertFrom-Json
  if ($ready.name -ne 'veltria' -or $ready.protocol -ne 6 -or $ready.origin -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Identidad incorrecta' }
  $script:origin = $ready.origin
  $response = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/session" -Method POST -ContentType 'application/json' -Headers @{Origin=$origin} -Body (@{nonce=$ready.nonce} | ConvertTo-Json) -SessionVariable localSession
  $script:session = $localSession
  $script:csrf = ($response.Content | ConvertFrom-Json).csrf
}
function Get-Api([string]$path) {
  return (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/$path" -WebSession $session).Content | ConvertFrom-Json
}
function Patch-Settings($body) {
  return (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -WebSession $session -Headers @{Origin=$origin; 'x-veltria-csrf'=$csrf} -Body ($body | ConvertTo-Json)).Content | ConvertFrom-Json
}
function Stop-Veltria {
  $null = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/control/shutdown" -Method POST -ContentType 'application/json' -Body '{}' -Headers @{'x-veltria-control'=$control}
  if (-not $p.WaitForExit(8000)) { throw 'El auxiliar no cerro por HTTP en Windows' }
  if ($p.ExitCode -ne 0) { throw 'Salida de error del auxiliar' }
}
try {
  $checkInfo = New-Object System.Diagnostics.ProcessStartInfo
  $checkInfo.FileName = $exe
  $checkInfo.Arguments = '--check-storage'
  $checkInfo.UseShellExecute = $false
  $checkInfo.RedirectStandardOutput = $true
  $checkInfo.RedirectStandardError = $true
  $check = [Diagnostics.Process]::Start($checkInfo)
  $checkOutput = $check.StandardOutput.ReadToEnd()
  $check.WaitForExit()
  if ($check.ExitCode -ne 0) { throw $check.StandardError.ReadToEnd() }
  $storage = $checkOutput | ConvertFrom-Json
  if (-not ($storage.migration -and $storage.transaction -and $storage.rollback -and $storage.reopen)) { throw 'SQLite diagnostico fallo' }
  Start-Veltria
  $health = Get-Api 'health'
  if (-not $health.capabilities.generation -or $health.runtime -notmatch '^Bun ') { throw 'Capacidades/runtime incorrectos' }
  $catalog = Get-Api 'catalog'
  if ($catalog.models.Count -ne 2 -or $catalog.configurations.Count -ne 6) { throw 'Catalogo incompleto' }
  $configResponse = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/catalog/configurations/$($catalog.selectedConfigurationId)" -WebSession $session
  if ($configResponse.Headers['Content-Disposition'] -notmatch 'attachment') { throw 'Configuracion sin descarga JSON' }
  $configuration = $configResponse.Content | ConvertFrom-Json
  $configuration.name = 'Windows native configuration'
  $configuration.parameters.steps = 12
  $configuration.parameters.cfg = 6
  $configuration.parameters.format = 'portrait'
  $headers = @{Origin=$origin; 'x-veltria-csrf'=$csrf}
  $entry = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/catalog/configurations" -Method POST -ContentType 'application/json' -WebSession $session -Headers $headers -Body ($configuration | ConvertTo-Json -Depth 6)).Content | ConvertFrom-Json
  $selected = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/catalog/select" -Method POST -ContentType 'application/json' -WebSession $session -Headers $headers -Body (@{configurationId=$entry.id} | ConvertTo-Json)).Content | ConvertFrom-Json
  if ($selected.configuration.steps -ne 12 -or $selected.configuration.cfg -ne 6 -or $selected.canCreate) { throw 'Seleccion no aplicada o descarga fingida' }
  $expectedConfigurationId = $entry.id
  $configuration.recipe = 'unreviewed-graph'
  try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/catalog/configurations" -Method POST -ContentType 'application/json' -WebSession $session -Headers $headers -Body ($configuration | ConvertTo-Json -Depth 6)
    throw 'Configuracion arbitraria aceptada'
  } catch [System.Net.WebException] { if ([int]$_.Exception.Response.StatusCode -ne 400) { throw } }
  $hardware = Get-Api 'hardware'
  if ($hardware.platform -ne 'win32' -or $hardware.wsl -or $hardware.cpu.logicalCores -lt 1 -or $hardware.ram.total -le 0) { throw 'Hardware Windows incorrecto' }
  if ((Invoke-WebRequest -UseBasicParsing -Uri $origin).Content -notmatch '<title>Veltria</title>') { throw 'UI no disponible' }
  $null = Patch-Settings @{theme='dark'; engineUrl='http://127.0.0.1:1'}
  $motor = (Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/engine/check" -Method POST -ContentType 'application/json' -Body '{}' -WebSession $session -Headers @{Origin=$origin; 'x-veltria-csrf'=$csrf}).Content | ConvertFrom-Json
  if ($motor.status -ne 'unavailable') { throw 'Fallo de motor no identificado' }
  try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "$origin/api/v1/settings" -Method PATCH -ContentType 'application/json' -Body '{"theme":"light"}' -WebSession $session -Headers @{Origin=$origin; 'x-veltria-csrf'='invalid'}
    throw 'CSRF aceptado incorrectamente'
  } catch [System.Net.WebException] { if ([int]$_.Exception.Response.StatusCode -ne 403) { throw } }
  # Real SSE HTTP stream, then disconnect before controlled shutdown.
  $request = [Net.HttpWebRequest]::Create("$origin/api/v1/events")
  $request.CookieContainer = $session.Cookies
  $request.Timeout = 5000
  $response = $request.GetResponse()
  $reader = New-Object IO.StreamReader($response.GetResponseStream())
  $first = $reader.ReadLine(); $second = $reader.ReadLine()
  if ($second -notmatch 'connected') { throw 'SSE sin evento inicial' }
  $reader.Dispose(); $response.Dispose(); $request.Abort()
  Stop-Veltria
  Start-Veltria
  if ((Get-Api 'catalog').selectedConfigurationId -ne $expectedConfigurationId) { throw 'Configuracion no persistio en SQLite' }
  if ((Get-Api 'settings').theme -ne 'dark') { throw 'Preferencia no persistio' }
  Stop-Veltria
  Write-Output 'WINDOWS NATIVE PASS: HTTP, static UI, session, CSRF, SSE/disconnect, SQLite migration/rollback/reopen, persistence, catalog JSON export/import/selection/reopen, invalid recipe rejection, engine failure, shutdown and paths with spaces.'
  Write-Output ($hardware | ConvertTo-Json -Depth 6 -Compress)
} finally {
  if ($p -and -not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  Remove-Item -LiteralPath $data -Recurse -Force
}
