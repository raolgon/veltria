> Entrega actual: [Veltria 0.8, SDXL local y prueba real en Windows](sdxl-validation.md).

# Gestionar lo descargado · 0.7.0

## Uso

Abrir **Modelos → Gestionar descargas**. La vista muestra archivos reconocidos del catálogo de imagen/LoRA en la ubicación de modelos elegida: tamaño, descargas parciales, ubicación, perfiles que los usan y acciones para usar, continuar o revisar una retirada. El tamaño total suma cada ruta una sola vez, aunque varios perfiles o intensidades LoRA compartan el mismo archivo. Son tamaños lógicos de entradas reconocidas, no un escaneo del uso total del disco.

**Continuar preparación** conserva la configuración seleccionada cuando el archivo pertenece al perfil actual; los demás perfiles abren una configuración inicial y el plan de preparación habitual. No empieza una generación automáticamente. La lista se actualiza mientras está visible y puede actualizarse manualmente; al salir se detiene su temporizador.

**Revisar retirada** muestra el archivo exacto, ruta, tamaño y perfiles afectados. Cancelar conserva el archivo. Retirar un LoRA no retira su base. Retirar una base u otro archivo compartido exige reconocer expresamente los perfiles afectados. Las relaciones mostradas pertenecen al catálogo; no se inspeccionan workflows ni aplicaciones externas para descubrir dependencias adicionales.

La retirada elimina sólo el archivo revisado. Conserva modelos restantes, creaciones, trabajos, configuraciones importadas, selección y entradas del catálogo. Los perfiles afectados pierden su estado de preparación para impedir crear con componentes ausentes; pueden prepararse de nuevo. La evidencia histórica de generaciones se conserva como historial, sin convertirla en disponibilidad de pesos. No se borran carpetas recursivamente ni se hace limpieza de dependencias en cascada.

## Alcance y protección de archivos

La gestión incluye rutas exactas de checkpoints/LoRA y sus `.part`, calculadas por el servicio a partir del catálogo y los ajustes. No escanea ni elimina archivos ajenos por nombre aproximado. Las copias preexistentes también pueden revisarse, pero los archivos completos deben tener el tamaño y SHA-256 exactos del catálogo antes de retirarse. Archivos distintos se conservan. Los parciales se identifican por su ruta temporal reservada y requieren la misma revisión explícita de ubicación/archivo.

Se conservan enlaces simbólicos, directorios, enlaces duros y rutas redirigidas por enlaces. También se protegen los archivos dentro de la instalación externa de ComfyUI vinculada. Una ubicación compartida fuera de esa instalación se gestiona sólo con la revisión explícita indicada; no se afirma detectar quién más puede usarla. Los componentes externos de video y los archivos no pertenecientes al catálogo permanecen fuera de esta gestión.

Cada revisión incluye una huella de archivo, ubicación, instalación vinculada y perfiles asociados. Si cambian antes de confirmar, se exige revisar de nuevo. Para archivos completos se calcula SHA-256 por streaming y se vuelve a comprobar la huella antes de retirar. La operación se bloquea durante preparaciones/creaciones; tampoco detiene un motor propio con una creación interrumpida aún sin confirmar. Se conserva el registro de ese trabajo para comprobar su resultado. Sólo se cierra el motor de imagen propio, sin detener instancias ajenas.

API autorizada mediante sesión/origen/CSRF:

- `GET /api/v1/catalog/storage`
- `POST /api/v1/catalog/storage/plan` con `id`
- `POST /api/v1/catalog/storage/remove` con `id`, `revision` y `acceptShared`

El cliente no aporta rutas para borrar. La retirada requiere el id y la revisión del plan actual; `acceptShared` es obligatorio cuando afecta a varios perfiles. Los errores dejan una acción de actualización/revisión, sin sustituir un archivo distinto para poder borrarlo.

## Validación

- Tipos y builds de Linux y Windows.
- **28 pruebas Vitest**, **23 pruebas Bun** y **83 comprobaciones HTTP**; comprobación adicional del grupo de creación después de bloquear retiradas con trabajos sin confirmar. Casos: archivos compartidos, base conservada al retirar LoRA, biblioteca intacta, SHA incorrecto, plan caducado, archivos ajenos, enlaces duros/simbólicos y directorios enlazados.
- **19 recorridos de interfaz** sobre Linux/WSL con Xvfb, incluyendo revisión, cancelación, retirada física de un checkpoint de fixture, biblioteca conservada, español/inglés y escritorio/móvil. Las fixtures no son pesos reales ni inferencia GPU.
- **Sistema de archivos real en Linux y Windows nativo**, con el mismo módulo del servicio y Bun 1.4.4. Se usaron exclusivamente archivos pequeños en directorios temporales nuevos: consentimiento de compartidos, retirada exacta, SHA, plan caducado, protección de la carpeta del motor, enlaces duros, parciales y archivo ajeno conservado. El ejecutor elimina sólo su directorio temporal al terminar. Ningún modelo personal se usó como objetivo de retirada.
- Arranque/cierre del paquete Electron y lanzador web en Windows nativo, con auxiliar, sesión y SQLite separados de los habituales. La revisión visual se hizo sobre la interfaz compartida en Linux/WSL; no se presenta como inspección visual nativa completa de Windows.

Repetir la comprobación de archivos:

```bash
bun scripts/validate-model-storage.ts
bun build --compile --target=bun-windows-x64-baseline scripts/validate-model-storage.ts --outfile build/validation/storage-check.exe
```

```powershell
.\tests\windows-storage-smoke.ps1
```

Pendiente: validación macOS; papelera/deshacer, mover modelos, retirada por lotes y gestión de componentes de video. Las pruebas GPU previas siguen documentadas; no se repitió inferencia para esta entrega.

## Abrir

Cerrar antes la versión anterior. Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.7.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace que imprime
.\build\browser\0.7.0\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.7.0/linux-unpacked/veltria
./build/browser/0.7.0/veltria-web
```

Protocolo 6 y SQLite 4, sin tablas ni migraciones nuevas. Se conservan paquetes y datos anteriores.
