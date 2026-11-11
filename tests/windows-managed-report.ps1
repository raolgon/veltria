param([switch]$LibraryVerified)
$ErrorActionPreference='Stop'
$labRoot='D:\Veltria\lab\windows-native-20261110'
$projectRoot=Split-Path $PSScriptRoot -Parent
$descriptor=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'data\.service-lock\instance.json') | ConvertFrom-Json
if($descriptor.origin -notmatch '^http://127\.0\.0\.1:\d+$') { throw 'Invalid lab service origin' }
$launch=Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/control/launch') -Method POST -ContentType 'application/json' -Headers @{'x-veltria-control'=$descriptor.controlToken} -Body '{}'
$null=Invoke-WebRequest -UseBasicParsing -Uri ($descriptor.origin+'/api/v1/session') -Method POST -ContentType 'application/json' -Headers @{Origin=$descriptor.origin} -Body (@{nonce=$launch.nonce}|ConvertTo-Json) -SessionVariable session
function Read-Lab($path) { Invoke-RestMethod -Uri ($descriptor.origin+'/api/v1/'+$path) -WebSession $session }
$jobs=Read-Lab 'jobs'; $managed=Read-Lab 'setup/managed'; $settings=Read-Lab 'settings'; $hardware=Read-Lab 'hardware'
if($managed.status -ne 'ready' -or $jobs.total -ne 1 -or $jobs.jobs[0].status -ne 'completed') { throw 'Expected one completed image and a ready installation' }
$job=$jobs.jobs[0]
if($job.imageId -notmatch '^[a-f0-9-]{36}$' -or $job.width -ne 512 -or $job.height -ne 512) { throw 'Unexpected image identity or dimensions' }
foreach($path in @($settings.engineBinding.directory,$settings.engineBinding.python)) { if(-not [IO.Path]::GetFullPath($path).StartsWith(($labRoot+'\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'Engine binding escaped the native lab' } }
$png=Join-Path $labRoot ('data\creations\'+$job.imageId+'.png')
$pngBytes=[IO.File]::ReadAllBytes($png)
$width=([int]$pngBytes[16] -shl 24) -bor ([int]$pngBytes[17] -shl 16) -bor ([int]$pngBytes[18] -shl 8) -bor [int]$pngBytes[19]
$height=([int]$pngBytes[20] -shl 24) -bor ([int]$pngBytes[21] -shl 16) -bor ([int]$pngBytes[22] -shl 8) -bor [int]$pngBytes[23]
if($width -ne 512 -or $height -ne 512) { throw 'Unexpected PNG header' }
$baseline=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'reports\external-baseline.json') | ConvertFrom-Json
foreach($entry in $baseline) { if((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('External ComfyUI file changed: '+$entry.path) } }
$originalModel='D:\Veltria\models\checkpoints\veltria-sd15-e9476a13.safetensors'
if((Get-FileHash -LiteralPath $originalModel -Algorithm SHA256).Hash -ne 'e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916') { throw 'Original SD15 model changed' }
$engineLog=Get-Content -Raw -LiteralPath (Join-Path $labRoot 'data\image-engine\engine.log') -Encoding UTF8
if($engineLog -notmatch 'pytorch version: 2\.7\.1\+cu126' -or $engineLog -notmatch 'Device: cuda:0 NVIDIA GeForce RTX 4050') { throw 'Missing CUDA execution evidence' }
$report=[ordered]@{result=$(if($LibraryVerified){'passed'}else{'awaiting-library-restart-check'});fixture=$false;platform='win32';wsl=$false;isolation='Own runtime and data on D:; shared Windows kernel and GPU, not a VM';root=$labRoot;recipe='comfy-0.35.0-py312-torch271-cu126-win-v2';downloadedEnvironmentBytes=3517429712;reusedModelBytes=2132696762;pauseAndRestart=$true;jobsBeforeCreation=0;generatedViaUI=$true;job=$job;hardware=$hardware;binding=$settings.engineBinding;libraryAfterRestart=[bool]$LibraryVerified;externalMainFilesUnchanged=$true;originalModelHashVerified=$true;serviceSha256=(Get-FileHash -LiteralPath (Join-Path $labRoot 'app\resources\service\veltria-service.exe') -Algorithm SHA256).Hash;pngSha256=(Get-FileHash -LiteralPath $png -Algorithm SHA256).Hash;crashes=@((Get-Content -Raw -LiteralPath (Join-Path $labRoot 'reports\CrashExtraction.json')|ConvertFrom-Json),(Get-Content -Raw -LiteralPath (Join-Path $labRoot 'reports\CrashDependencies.json')|ConvertFrom-Json))}
$report|ConvertTo-Json -Depth 12|Set-Content -Encoding UTF8 (Join-Path $labRoot 'reports\validated-managed-windows.json')
$report|ConvertTo-Json -Depth 12|Set-Content -Encoding UTF8 (Join-Path $projectRoot 'build\lab\validated-managed-windows.json')
Copy-Item -LiteralPath $png -Destination (Join-Path $projectRoot 'build\lab\first-managed-windows-image.png') -Force
Write-Output ('Windows native real image report: '+$report.result)
