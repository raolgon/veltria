> Búsqueda externa y adaptaciones en [Veltria 0.6](model-discovery.md).

> Registro de la entrega 0.4. La comprobación posterior de DreamShaper y las configuraciones se documenta en [validación real del catálogo 0.5.1](catalog-real-validation.md).

# Catálogo local · Veltria 0.4

La navegación **Modelos → elegir configuración → revisar descarga → preparar → Crear** funciona en la misma UI de navegador y Electron. El servicio Bun/Fastify es la autoridad: catálogo incluido para consulta offline, SQLite para selección/configuraciones/recibos y archivos de pesos fuera de SQLite. No se instala otro ComfyUI.

## Qué se puede utilizar

- **SD 1.5 FP16**, archivo de 2.132.696.762 bytes. Se conserva su receta anterior y el peso que ya descargó la persona. Configuraciones de 20, 12 y 30 pasos.
- **DreamShaper 8 FP16**, archivo de 2.132.625.894 bytes, basado en SD 1.5. Configuraciones de 25, 12 y 30 pasos. No se ha descargado ni generado con él durante este desarrollo. La estimación de memoria y la compatibilidad de familia no se presentan como una ejecución real comprobada.
- **MiniMax H3 existente**: enlace al recorrido de video anterior. La descarga de su conjunto de componentes desde el catálogo sigue pendiente; no se anuncia una descarga de cero bytes como si instalara un modelo ausente.

Cada modelo muestra si falta, está parcialmente descargado, está descargado pendiente de comprobar o está preparado. Los mínimos iniciales son NVIDIA de 4 GB y RAM de 8 GB nominales en Windows/Linux para los dos perfiles de imagen; la preparación explica recursos desconocidos o insuficientes. Una generación terminada es la evidencia de ejecución. Cambiar pasos o CFG invalida esa evidencia para la otra configuración sin borrar imágenes anteriores.

La preparación muestra archivo de destino, descarga restante, espacio y margen, fuente, licencia y cambios. Requiere autorización antes de descargar, transmite a `.part`, admite Range cuando el proveedor lo permite, verifica tamaño y SHA-256 y comprueba el motor local. Se puede pausar y reanudar. Cambiar de modelo conserva el recibo y el archivo parcial de cada uno. No cambia los modelos de la instalación externa.

No hay nuevas descargas grandes silenciosas. Elegir/importar una configuración no descarga los pesos. Un archivo existente del tamaño esperado se muestra como **descargado**, no como íntegro o preparado: falta comprobarlo.

## Fuentes fijadas

- [SD 1.5, Comfy-Org](https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/tree/9cfd069101959ca3828bf9c04a4419870832b74f): `v1-5-pruned-emaonly-fp16.safetensors`, SHA-256 `e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916`, CreativeML OpenRAIL-M.
- [DreamShaper, repositorio oficial del autor](https://huggingface.co/Lykon/DreamShaper/tree/228d79cb20811466f5c5710aa91f05dabd0b8a14): `DreamShaper_8_pruned.safetensors`, SHA-256 `879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd`. Este repositorio declara licencia **other** y su README remite al autor; la app expone esa información para revisión, sin etiquetar el checkpoint como CreativeML por asociación con otros repositorios.

Tamaños, revisiones y hashes se contrastaron con los metadatos LFS del proveedor. Las URL de descarga contienen commits inmutables. No se promete que cualquier archivo llamado DreamShaper sea este perfil.

## Configuraciones portables

**Guardar configuración** descarga un JSON pequeño mediante el servicio autorizado. Electron ofrece el diálogo nativo de JSON; navegador utiliza su descarga habitual. **Elegir archivo JSON → Importar configuración** valida y guarda el archivo en SQLite. Aparece en el selector del modelo correspondiente y **Usar en Crear** aplica su formato inicial. La selección se comparte por SSE entre ventanas y se conserva al reabrir. Las configuraciones incluidas ya están disponibles offline: no se simula descargarlas de Internet.

Formato admitido:

```json
{
  "kind": "veltria-image-configuration",
  "version": 1,
  "name": "Mi configuración",
  "description": "Borrador horizontal",
  "modelId": "sd15-starter",
  "recipe": "sd15-text-to-image-v1",
  "parameters": {
    "steps": 12,
    "cfg": 7,
    "sampler": "euler",
    "scheduler": "normal",
    "format": "landscape"
  }
}
```

Sólo se admiten modelos del catálogo, esa receta, Euler/normal, pasos enteros de 8 a 40, CFG de 1 a 12 y los tres formatos existentes de 512 píxeles. Máximo 32 KiB por archivo y 100 configuraciones importadas; importaciones idénticas se deduplican. Nombres/descripciones son datos, no instrucciones. Se rechazan nodos, scripts, URL de dependencias y campos ajenos al contrato. No se ejecutan metadatos. El JSON no incluye prompts ni resultados ni pesos.

Cada trabajo guarda la identidad y nombre de la configuración, su receta/ajustes, pasos, CFG y formato realmente enviados al motor. Las generaciones anteriores conservan sus datos sin inventar qué configuración usaron. Cambiar de modelo/configuración durante una preparación o creación activa se rechaza también desde otro cliente.

API nueva, protegida por la misma sesión/origen/CSRF:

- `GET /api/v1/catalog`
- `POST /api/v1/catalog/select` con `configurationId`
- `POST /api/v1/catalog/configurations` con el JSON portable
- `GET /api/v1/catalog/configurations/:id` para exportar

## Datos y apertura

Protocolo **5**, esquema SQLite **4**. Copia de la base existente anterior a la migración en `backups/before-catalog-*.sqlite`. No se inicia otro servicio sobre una base abierta por una versión anterior: cerrar esa versión primero. Las carpetas anteriores de distribución se conservan.

Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.4.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime
.\build\browser\0.4.0\veltria-web.exe
```

Linux / WSL con pantalla, desde este checkout:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.4.0/linux-unpacked/veltria
./build/browser/0.4.0/veltria-web
```

No abrir SQLite simultáneamente desde Windows y Linux. El catálogo no modifica el entorno de ComfyUI ni sus pesos externos. Los modelos administrados siguen en la ubicación elegida, por ejemplo `D:\Veltria\models\checkpoints`.

## Validación

Comprobaciones de la entrega:

- `bun install --frozen-lockfile --ignore-scripts` y `bun run typecheck`: correctos.
- `bun run test`: **17 pruebas Vitest, 15 pruebas Bun (143 aserciones) y 75 comprobaciones HTTP** de servicio fuente/compilado. Incluyen dos modelos de fixture, descarga/pausa/Range, SHA incorrecto, falta de espacio, conservación de parciales al cambiar de modelo, parámetros realmente enviados al motor, importaciones inválidas, JSON exportado, deduplicación, reapertura de selección y trabajos previos. Las fixtures no son modelos ni inferencia GPU.
- Playwright sobre el paquete Electron de Linux con Xvfb: **12 recorridos**, incluyendo catálogo real con dos entradas en escritorio/móvil de 320 px, ambos temas/idiomas, revisión del plan, descarga JSON, importación rechazada/aceptada, selección, formato tras recargar, uso en Crear y parámetros en biblioteca. Incluye la regresión de imagen/video, recursos y aislamiento/lifecycle de Electron.
- `tests/windows-smoke.ps1`: auxiliar nativo, HTTP/sesión/CSRF/SSE/SQLite, exportación/importación/selección/reapertura del catálogo y rechazo de receta desconocida, sin descargar pesos.
- `tests/windows-web-smoke.ps1`: lanzador autónomo nativo, UI y lecturas reales de recursos, autorización de una vez y salida del auxiliar.
- `tests/windows-desktop-smoke.ps1` contra `release/0.4.0/win-unpacked/Veltria.exe`: ventana nativa, auxiliar fuera de ASAR, preferencias/idioma, cierre WM_CLOSE y conservación de SQLite. La inspección visual completa en Windows sigue siendo manual.
- **Inferencia real en Windows**, mediante `tests/windows-catalog-preflight.ps1`: configuración JSON importada y seleccionada, SD 1.5 existente en `D:\Veltria\models`, SHA-256 comprobado sin descargar pesos, ComfyUI 0.35.0/Python existentes. Resultado **512 × 384, 12 pasos, CFG 6, Euler/normal** (semilla y trabajo exactos en `validated-job.json`). El script verifica los ajustes guardados y la evidencia de generación terminada; cierra sólo su auxiliar/motor y comprueba la liberación del bloqueo.

El resultado de la última ejecución nativa y su registro se conservan en `%LOCALAPPDATA%\Veltria\catalog-validation-20261104-161532`, imagen `creations\743305dd-0ecd-40df-9bae-c4bec7e94525.png`. El directorio de validación está separado de la biblioteca habitual. No se movieron ni duplicaron los pesos existentes.

Comandos de validación reproducibles:

```bash
bun run typecheck
bun run test
bun run build
bun scripts/build.ts --target=bun-windows-x64-baseline
bun x electron-builder --linux AppImage --dir --win --dir --x64 --publish never
VELTRIA_ELECTRON_EXECUTABLE="$PWD/release/0.4.0/linux-unpacked/veltria" xvfb-run -a bun run test:ui
```

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1 -Executable "$PWD\release\0.4.0\win-unpacked\Veltria.exe"
# Esta comprobación sí genera una imagen usando pesos ya presentes (rechaza cualquier descarga):
.\tests\windows-catalog-preflight.ps1 -EngineDirectory 'D:\pinokio\api\minimax-h3-pinokio.git\app' -Python 'D:\pinokio\api\minimax-h3-pinokio.git\app\env\Scripts\python.exe' -ModelsDirectory 'D:\Veltria\models'
```

Pendiente de validación real: descarga completa e inferencia de DreamShaper 8 en Windows y Linux; reanudar su descarga real tras un corte de red; inferencia H3 en el equipo de 6 GB; GPU NVIDIA de Linux nativo (las pruebas de Linux aquí corren en WSL/Xvfb); macOS, empaquetado/arranque y cualquier inferencia. No confundir fixtures de descarga/generación con pruebas GPU.

Pendiente de producto: modelos por URL, LoRA, workflows externos de ComfyUI, configuraciones de video portables, descarga de componentes H3, borrado/gestión de las configuraciones importadas e instalación administrada de motores.
