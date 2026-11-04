# Veltria 0.3 · video local experimental

Incremento solicitado después de imagen, monitor de recursos e idiomas. No instala otro ComfyUI, no descarga pesos y no ejecuta los workflows importados que encontró en el disco.

## Qué funciona

Crear → **Video** presenta la descripción, una vista previa inicial y MiniMax H3. Antes de usarlo, el plan muestra componentes existentes, recursos, espacio, cero descarga, fuente/licencia y límites reales. Requiere revisar los términos y aceptar el perfil experimental. Preparar comprueba el motor y sus nodos; crear es una acción posterior.

Se usa el Python y `main.py` vinculados, con carpetas propias en `video-engine/`, puerto loopback y todos los nodos personalizados desactivados. Se reconocen opciones de nodos clásicas y `COMBO` V3. La receta es API plana e incluida en el código: CLIPLoader `minimax`, modelo FL2VA INT8 ConvRot, sigma shift 12/3, acondicionamiento H3 sin imágenes de referencia, `res_multistep`/simple, 20 pasos, decodificación de video/audio y `CreateVideo` → `SaveVideo` H.264/MP4. `SaveVideo` usa sus entradas dinámicas V3 (`format.codec`), no un campo de codec incompatible.

Perfiles iniciales:

| Ajuste | Resolución | Fotogramas | FPS | Duración |
| --- | --- | --- | --- | --- |
| Vista previa | 448 × 256 | 22 | 24 | 0,92 s |
| Clip corto | 448 × 256 | 124 | 24 | 5,17 s |

El clip corto se habilita después de una vista previa terminada con el mismo hardware, controlador, instalación, revisión de receta y componentes. La vista previa está por debajo del rango de entrenamiento documentado; no se presenta como muestra de calidad final.

El servicio evita ejecutar imagen y video a la vez y cierra sólo su motor inactivo al cambiar de tarea. No detiene ComfyUI externo. Identidad de trabajo persistida antes de enviarlo, idempotencia por solicitud, progreso real por WebSocket/SSE y consulta de historial. Un envío incierto o interrumpido no se reenvía automáticamente. Cancelación únicamente por ID de trabajo, nunca interrupción global.

Los MP4 se transfieren por streaming a temporales, con límite de 256 MiB, se validan mediante PyAV ya instalado con ComfyUI y se conservan fuera del motor en `videos/`. Se comprueban H.264, dimensiones, duración, FPS y fotogramas informados. SHA-256 del **resultado**, metadatos y descripción se guardan en SQLite; un archivo existente diferente se conserva. La recuperación consulta el archivo propio o el historial, sin generar de nuevo.

Biblioteca → **Video** permite reproducir, guardar y reutilizar la descripción. El servicio protege el archivo con la misma sesión local y admite rangos HTTP simples para reproducción y búsqueda. Navegador descarga; Electron prepara el diálogo nativo para MP4. No hay reproducción automática ni solicitudes del renderer a ComfyUI. Español/inglés y Obsidian claro/oscuro se conservan.

## Lo encontrado en esta PC

Instalación vinculada: `D:\pinokio\api\minimax-h3-pinokio.git\app`, con Python existente `env\Scripts\python.exe`. Los modelos usan los enlaces de Pinokio a `D:\pinokio\drive\drives\peers\d1788559745617`.

| Componente reutilizado | Bytes |
| --- | ---: |
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | 20 970 379 616 |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | 15 687 142 551 |
| `minimax_h3_video_vae_fp16.safetensors` | 5 207 808 496 |
| `minimax_h3_audio_vae_fp32.safetensors` | 605 254 808 |

Son aproximadamente **42,47 GB de archivos** existentes. Se comprueban cabeceras safetensors acotadas, offsets, tamaños y fechas de modificación; no se afirma haber calculado el hash completo de esos pesos. El hash de la revisión cambia si cambian los archivos, instalación, versión o hardware.

El archivo `D:\MiniMax_H3_ClipProj_RTX4050_6GB.json` no equivale a un perfil preparado: referencia Qwen 4B FP8, H3 W4A8 y video VAE INT8 que no se encontraron. Su nombre de proyección tampoco coincide literalmente con el archivo `-mlp` instalado. Se conserva como referencia; no se importa ni se ejecuta. No se sustituyeron esos archivos por otros con una etiqueta de compatibilidad ficticia.

La comprobación nativa confirmó RTX 4050 Laptop, unos 6 GB de VRAM, 16 GB nominales de RAM, driver 617.42, ComfyUI 0.35.0, PyTorch 2.10.0+cu130 y PyAV 17.1.0. El perfil sigue **experimental y sin una generación H3 verificada en esta máquina**. La regla de Veltria avisa cuando la RAM nominal es inferior a 32 GB; es una precaución del perfil grande, no una afirmación de que todos los equipos con 32 GB estén certificados o los de 16 GB sean incapaces de ejecutarlo.

Referencias primarias: [pesos para ComfyUI](https://huggingface.co/Comfy-Org/MiniMax-H3), [nodo H3 y fotogramas válidos](https://github.com/Comfy-Org/docs/blob/main/built-in-nodes/MiniMaxH3ImageToVideo.mdx), [orientación de despliegue de MiniMax](https://design.minimax.io/h3). Los detalles de implementación se contrastaron con los archivos de la instalación real, sin modificarlos.

## Validación nativa y sus límites

Se ejecutó el servicio compilado de Windows con datos separados, autorización local y el vínculo real. Los cuatro componentes se detectaron como presentes. La preparación abrió su propio motor y terminó en `ready`, `canCreate=true`, `verifiedPresets=[]` y descarga de 0 bytes. Esto prueba preparación/capacidades, no inferencia.

Se validaron los enlaces y entradas del grafo H3 nativo sin encolarlo: el grafo de diagnóstico conserva todos los nodos, pero omite deliberadamente el texto obligatorio `filename_prefix` de su única salida. La validación recursiva de ComfyUI devolvió únicamente ese error esperado en el nodo 15 y rechazó la solicitud. Así se comprobó el contrato real sin cargar los pesos del modelo.

Se ejecutó después un grafo **sintético, sin IA**, `EmptyImage` → `CreateVideo` → `SaveVideo`, en ese motor supervisado. El adaptador real de PyAV del auxiliar compilado confirmó MP4 H.264, 448 × 256, 22 fotogramas, 24 FPS, 0,9167 s y sin audio. El archivo se identifica como `native-transport-fixture-not-AI.mp4`. No es evidencia de que H3 genere en la RTX 4050. Datos conservados en `%LOCALAPPDATA%\Veltria\video-validation-20261104-153218`; sólo se cerraron los procesos de ese test.

Las pruebas de servicio/interfaz usan otro MP4 sintético con el texto visible **TEST FIXTURE - NO AI**. Se comprueban permisos, consentimiento, cambio de componentes, revisión obsoleta, exclusión con imagen, idempotencia, cancelación propia, respuesta perdida, recuperación tras reinicio, archivo ajeno, rangos, biblioteca, reproducción y guardado. La UI de escritorio también reproduce el MP4 y comprueba el título inglés de guardado sin escribir archivos mediante el diálogo.

Resultado final: **17 pruebas Vitest**, **14 pruebas Bun** (103 expectativas), **69 comprobaciones HTTP** en fuente/compilado y **10 recorridos Playwright correctos**, incluidos reproducción MP4 y guardado de video en el ejecutable Electron Linux empaquetado. También pasaron los tipos, build y lockfile congelado. En Windows nativo pasaron los smoke de auxiliar, lanzador web y escritorio 0.3, además de la preparación H3 y prueba sintética de MP4 descritas arriba. Se confirmaron capturas de escritorio y teléfono; el detector mecánico de UI no registró hallazgos.

## Datos y distribución

Protocolo de proceso/API **4**. SQLite **esquema 3**, con tablas de video independientes de las de imágenes. Antes de actualizar una base anterior se guarda una instantánea consistente en `backups/before-video-*.sqlite`; no se pierden apariencia, idioma, vínculo, modelos ni imágenes. No usar ejecutables anteriores sobre estos datos actualizados. Las carpetas de las entregas anteriores se conservaron.

Windows PowerShell, después de cerrar la versión anterior:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\release\0.3.0\win-unpacked\Veltria.exe
# Navegador:
.\build\browser\0.3.0\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.3.0/linux-unpacked/veltria
# Navegador:
./build/browser/0.3.0/veltria-web
```

Comprobaciones y build:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun scripts/build.ts --target=bun-windows-x64-baseline
bun run build
bun x electron-builder --linux AppImage --dir --win --dir --x64 --publish never
VELTRIA_ELECTRON_EXECUTABLE="$PWD/release/0.3.0/linux-unpacked/veltria" xvfb-run -a bun run test:ui
```

Para repetir la comprobación nativa del modelo y MP4: generar `build/test-tools/h3-preview-api.json` con `videoWorkflow` y compilar `scripts/test-video-probe.ts` con target Windows. Después:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-video-preflight.ps1 -EngineDirectory 'D:\pinokio\api\minimax-h3-pinokio.git\app' -Python 'D:\pinokio\api\minimax-h3-pinokio.git\app\env\Scripts\python.exe'
```

## Pendiente

Generación H3 real y calidad/audio en esta GPU; una variante más ligera comprobada para 6 GB/16 GB; otros modelos; imagen a video, referencias, edición y resoluciones adicionales. El perfil experimental no promete tiempo de ejecución ni éxito con estos pesos grandes. No se ejecutó una carga de H3 sin verificar para presentar el clip de transporte como IA.

Linux se comprueba aquí en WSL/Xvfb con fixtures y el paquete; falta GPU nativa y escritorio físico fuera de WSL. Windows necesita revisión física de guardado, lectores de pantalla y escalado. macOS sigue pendiente; este perfil no se habilita allí. AppImage/FUSE fuera de WSL, NSIS, firma, iconos finales y publicación mantienen sus pendientes anteriores.
