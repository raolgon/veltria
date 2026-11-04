# Veltria 0.2 · primera imagen real

Implementado el 4 de noviembre de 2026. Este incremento completa el recorrido descrito en [first-image-flow.md](first-image-flow.md) sobre un ComfyUI existente: propuesta para el equipo, plan de preparación, descarga verificable, generación y biblioteca. No instala un segundo motor ni completa la instalación administrada general del hito 3.

## Funciona

- Crear propone **Imagen inicial**, un perfil acotado de Stable Diffusion 1.5 FP16, con motivos según hardware y sus límites visibles. Las reglas iniciales necesitan NVIDIA con al menos 4 GB nominales de VRAM y 8 GB nominales de RAM; distinguen memoria total/disponible, WSL y datos desconocidos. No equivalen a certificar cualquier equipo.
- El plan muestra archivo de destino, descarga pendiente, espacio disponible y margen de 512 MiB, fuente, licencia y cambios. No inicia la descarga sin aceptar ese plan. Se guarda una aceptación por revisión en SQLite. Cambiar modelo, ubicación o vínculo invalida la revisión anterior.
- Descarga por streaming a `.part`, bytes reales, pausa, continuación con HTTP Range cuando el origen lo admite y reinicio seguro si devuelve el archivo completo. Se comprueban tamaño y SHA-256 antes de promover el archivo. Un archivo preexistente diferente se conserva.
- El modelo y los resultados están fuera de la instalación externa. Veltria crea su propio YAML de rutas y directorios de usuario/entrada/salida/temporales. Reutiliza el Python y `main.py` ya instalados; no ejecuta pip, actualizadores, gestores ni nodos personalizados.
- El motor se abre al preparar o al crear si aún está detenido. Tiene puerto loopback asignado por el SO y supervisión propia. Cerrar una instancia externa no es una acción de Veltria. En Windows se cierra únicamente el árbol del proceso Python iniciado por Veltria; el intérprete también vigila la vida de su propietario Bun mediante un wrapper propio, sin modificar ComfyUI.
- «Crear imagen» es una acción separada. Cola local acotada, identificadores persistidos antes del envío, idempotencia por solicitud y progreso real mediante WebSocket/SSE. No se reenvía una generación por perder su respuesta o reiniciar.
- Cancelación por ID con `/api/jobs/{id}/cancel` de ComfyUI; no se usa la interrupción global. El vínculo exige la capacidad de cancelación atómica de la versión comprobada. Con motores anteriores que no la ofrezcan se explica la incompatibilidad, sin actualizarlos.
- PNG y metadatos quedan en la biblioteca del servicio. Guardar descarga por ID autorizado; escritorio abre el diálogo nativo de guardado. Reutilizar descripción conserva formato y genera una nueva solicitud. Los trabajos interrumpidos permiten consultar/recuperar un resultado existente, sin volver a generarlo.
- SQLite conserva apariencia, vínculo, ubicación, preparaciones, autorizaciones, trabajos y evidencia. Migración de esquema 1 a 2 conservando preferencias. Contrato de proceso/API **protocolo 2**; se rechaza adjuntar una interfaz antigua o abrir datos de un servicio de otro SO.

## Perfil y procedencia

Archivo: `v1-5-pruned-emaonly-fp16.safetensors`, archivo público de Comfy-Org:

- [Repositorio y limitaciones](https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive).
- Revisión fijada: `9cfd069101959ca3828bf9c04a4419870832b74f`.
- Tamaño exacto: **2 132 696 762 bytes** (2,13 GB decimales, aproximadamente 1,99 GiB).
- SHA-256: `e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916`.
- [Licencia CreativeML OpenRAIL-M](https://huggingface.co/spaces/CompVis/stable-diffusion-license/blob/main/license), con condiciones de uso.
- Perfil: `sd15-starter`, receta `sd15-fp16-euler-20-v1`, Euler/normal, 20 pasos, CFG 7, una imagen por trabajo, semilla registrada y negativo vacío. Nodo de checkpoint, codificación de texto, latente, muestreo, VAE y guardado; sin extensiones.

Es un modelo clásico de 2022, elegido como primer conjunto sencillo verificable. No se presenta como la mejor calidad disponible actualmente. Interpreta mejor inglés; texto, caras y detalles pueden fallar. El catálogo más amplio, otros modelos y recomendaciones comparativas siguen pendientes. No se añadió un LLM ni traducción remota.

El usuario autorizó explícitamente la descarga y prueba después de revisar tamaño, margen, destino `D:\Veltria\models` y licencia. El archivo final está en `D:\Veltria\models\checkpoints\veltria-sd15-e9476a13.safetensors`. Los enlaces y modelos anteriores de Pinokio no se tocaron.

## Prueba real Windows

Motor reutilizado: `D:\pinokio\api\minimax-h3-pinokio.git\app`; Python existente `env\Scripts\python.exe`. ComfyUI 0.35.0, Python 3.10.20, PyTorch 2.10.0+cu130, NVIDIA RTX 4050 Laptop de 6 GB, controlador 617.42, Windows build 26200.

Se ejecutó el **auxiliar compilado Windows**, con sesión local, revisión del plan, preparación y generación mediante su API; no una llamada de generación independiente que evitase el servicio.

Primera prueba aislada, completada a las 12:45 del 4 de noviembre (Ciudad de México):

- Trabajo `f61bdc0c-9e93-428a-a03b-52a340077e36`, semilla `3288765879`, 512 × 512, 20 pasos.
- Descripción: «A monumental sandstone arch in a quiet desert at sunrise, warm golden light, cinematic composition, detailed landscape, no people».
- Descarga completa y hash correcto; motor iniciado con rutas propias y archivo reconocido.
- PNG real de 512 × 512 recibido, validado y servido por `/api/v1/artifacts/{id}`. Se revisó visualmente el arco de piedra en el desierto; no es la ilustración de bienvenida.
- ComfyUI registró 11,56 segundos para esa ejecución concreta; el trabajo completo incluyó comprobación del archivo. No se convierte en una estimación universal de tiempo.
- Datos de prueba preservados en `%LOCALAPPDATA%\Veltria\first-image-validation`. Después se cerró únicamente su motor supervisado; la instancia externa en 8188 siguió disponible.

La versión 0.2 se abrió después con los datos habituales de Windows, preservando la apariencia oscura. Se respaldó la base anterior en `%LOCALAPPDATA%\Veltria\backups\settings-before-0.2-20261104-130714.sqlite`, se migró a esquema 2 y se vinculó el mismo motor y el modelo ya descargado. La preparación informó **0 bytes pendientes**, volvió a comprobar el archivo y abrió su motor automáticamente. La prueba del paquete final quedó registrada en la biblioteca habitual: trabajo `04238c83-0334-428c-bdba-d830f36c4ccd`, semilla `232348304`, 512 × 512, 20 pasos, completado a las 13:11:47 del 4 de noviembre (Ciudad de México). El PNG se recuperó por la API y el estado volvió a `ready`, con `canCreate=true`. Esto comprueba también el arranque real mediante el wrapper propio del paquete; no se repitió la descarga.

## Comprobaciones automatizadas

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
xvfb-run -a bun run test:ui
node scripts/smoke-dev.mjs
bun scripts/smoke-launcher.ts
```

- `tsc` y `vue-tsc`: correcto. Build Vite y auxiliares Bun Linux/Windows x64 baseline: correcto.
- Vitest: 5 pruebas de contratos/dominio. bun:test: 8 pruebas, incluidas SQLite y 7 de preparación/creación.
- Integración HTTP fuente y compilado: 57 comprobaciones de autorización, entradas, estáticos, eventos, almacenamiento, hardware y fallos controlados.
- Nuevos casos con fixture explícita, sin GPU: Range/pausa, SHA incorrecto, origen que no admite reanudación, falta de espacio antes de contactar el origen, preservación de archivos existentes, solicitud duplicada, cancelación por ID, fallo de motor y recuperación tras reinicio sin repetir trabajo.
- Playwright: 5 recorridos, también sobre el paquete Linux. Preparar/revisar licencia, pausa/continuación, crear, guardar y reutilizar desde biblioteca. Responsive 320/390 px, tableta, escritorio y horizontal; temas claros/oscuros, prompt conservado y diálogo desplazable. Las imágenes de fixture son cuadros de prueba identificados como tal, no evidencia de generación GPU.
- Detector mecánico de cambios UI: sin hallazgos. Se inspeccionaron capturas de estudio, resultado y plan móvil.
- Windows nativo: ventana del paquete, API autorizada, ajustes y cierre de su auxiliar con datos en rutas con espacios. Los mensajes Chromium `GPU state invalid after WaitForGetOffsetInRange` al cerrar siguen registrados; requieren revisión visual física adicional, aunque no impidieron estas comprobaciones.

Para repetir los smoke nativos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-smoke.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-web-smoke.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-desktop-smoke.ps1
```

## Abrir la versión actual

No separar los ejecutables de sus recursos. Las carpetas publicadas anteriormente se conservaron; usar las de **0.2.0** para este flujo.

Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\release\0.2.0\win-unpacked\Veltria.exe
# Para navegador, desde otra terminal o sin el escritorio:
.\build\browser\0.2.0\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.2.0/linux-unpacked/veltria
# Para navegador:
./build/browser/0.2.0/veltria-web
```

El lanzador web imprime el enlace autorizado, válido una vez durante 60 segundos. Escritorio y navegador comparten el servicio y datos de su SO. Cerrar el propietario interrumpe el trabajo activo con estado persistente; cerrar un cliente adjunto no cierra el servicio.

Para desarrollo siguen disponibles `bun run start:web`, `bun run start:desktop` y `bun run dev` (Vite 43120 y Bun 43121), con Bun 1.4.4 y Node 24.13.0. Una instancia de protocolo 1 debe cerrarse antes de abrir la versión nueva. No compartir una base activa entre Windows y WSL.

## Pendiente y límites prácticos

- Generación GPU real en Linux fuera de WSL, otros controladores/GPU y macOS. macOS, AMD, Intel y CPU no se ofrecen como compatibles con este perfil inicial.
- Instalador NSIS: la configuración existe, pero el host carece de Wine; no se vuelve a presentar un `.exe` parcial como instalador. Windows desempaquetado y AppImage Linux sí se generan. FUSE/AppImage directo fuera de WSL permanece pendiente.
- Firma, iconos finales de distribución, escalado/contraste alto, lectores de pantalla y pruebas físicas móviles. Guardado mediante el diálogo nativo de Windows requiere comprobación manual adicional.
- Otras resoluciones y perfiles requieren su propia evidencia. La primera ejecución GPU comprobada es 512 × 512; los formatos horizontal/vertical de la UI reducen el número de píxeles y siguen pendientes de una prueba GPU específica.
- La instalación vinculada debe incluir las capacidades comprobadas. No se reparan ni actualizan sus dependencias automáticamente. Preparar un motor nuevo desde cero continúa siendo un incremento posterior.
- No hay importación de workflows arbitrarios, instalación de extensiones, LoRA seleccionables, video/audio, nube, LAN ni autoactualizaciones.
- No se ha realizado aún una prueba de usabilidad con otra persona principiante. Esta entrega demuestra ejecución y recuperación observadas, no una certificación de todos los equipos.
