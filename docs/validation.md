> Entrega actual: [Veltria 0.5.1, catálogo y validación real](catalog-real-validation.md). [Preparación automática de 0.5](automatic-setup.md). [Catálogo de 0.4](model-catalog.md). [Video experimental de 0.3](video-validation.md). Se conservan debajo las comprobaciones históricas del hito 1.

# Validación del hito 1

> Registro histórico del hito 1. La versión actual 0.2 incorpora primera imagen, preparación y biblioteca: consultar [estado y validación actuales](first-image-validation.md).


Fecha: 4 de noviembre de 2026. Comprobar los resultados de esta entrega; las validaciones históricas del prototipo siguen separadas en UI-PREVIEW.md.

## Entorno y versiones fijadas

Host de desarrollo: Ubuntu 24.04 en WSL2, Linux x64, kernel 6.18.33.2-microsoft-standard-WSL2. Windows accesible de forma nativa por PowerShell 5.1, build 26200. Node 24.13.0, Bun 1.4.4. Vue 3.5.44, Vite 8.3.5, plugin Vue 6.0.10, TypeScript 6.0.3, vue-tsc 3.3.14. Fastify 5.12.8, cookie 11.1.5, static 10.1.9, Zod 4.6.7. Electron 45.2.2, electron-builder 26.18.0, Vitest 5.1.0 y Playwright 1.64.1. Dependencias exactas y transitivas en `bun.lock`.

Sólo se autorizaron los scripts de instalación de Electron y esbuild; el script de electron-winstaller permaneció bloqueado por Bun. Se usa NSIS, no Squirrel. `scripts/ensure-electron.mjs` comprueba que se haya descargado el Electron de desarrollo.

## Comandos de comprobación

Desde la raíz, con Bun y Node fijados en PATH:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
bun x playwright install chromium
xvfb-run -a bun run test:ui
node scripts/smoke-dev.mjs
bun scripts/smoke-launcher.ts
```

En Linux con pantalla se puede ejecutar `bun run test:ui` directamente. Las pruebas Electron piden `chromiumSandbox:true`; no utilizan `--no-sandbox`. El preload confirma en el renderer `sandboxed:true`, `contextIsolated:true` y ausencia de `window.require`.

`bun run test` combina Vitest para contratos/dominio, bun:test para SQLite y `scripts/smoke-service.ts` para HTTP **real**, tanto desde fuente Bun como desde el ejecutable compilado. No se usa `inject` como sustituto de red. El test de almacenamiento se puede repetir con:

```bash
./build/service/veltria-service --check-storage
```

Este diagnóstico crea una base temporal propia y comprueba migración, commit, rollback y reapertura; no altera la base del usuario.

## Resultados observados

- Typecheck `tsc` de servicio, adaptadores, contratos, main/preload, scripts y pruebas; `vue-tsc` de los SFC: correcto.
- Modo desarrollo Vite en 43120 con proxy explícito a Bun fuente en 43121: UI, nonce/sesión, mutación con CSRF, preferencia persistente y cierre correctos mediante `node scripts/smoke-dev.mjs`. No utiliza el 5173 ocupado por otra aplicación y sólo imprime el enlace después de la disponibilidad del hijo Vite.
- Build de Vue/Vite y compilación Bun Linux x64 `baseline`: correcto. No se exige AVX2 al elegir este target.
- Vitest: 4 casos de contratos/dominio. bun:test: 1 caso de almacenamiento con SQLite real.
- Integración HTTP fuente/compilado: **57 comprobaciones**. Incluye autorización ausente, nonce consumido, Host/origen externos, cookie, CSRF ausente, entradas y JSON malformados, tamaño máximo, estáticos/CSP, hardware, SSE/evento de cambio/desconexión, cierre con SSE abierto, segunda sesión/instancia, reapertura y persistencia. También recuperación después de matar el hijo y error de ejecutable inexistente.
- ComfyUI controlado por fixture local: API válida/modelos, respuesta de otra aplicación, HTTP 503, redirección, timeout y puerto cerrado. **No equivale a ComfyUI real ni prueba GPU**. En la comprobación inicial no había un motor escuchando en el puerto local de referencia 8188. Posteriormente se arrancó y comprobó una instalación existente en D: ver [conexión real](comfy-existing.md).
- Playwright: 4 recorridos aprobados. Navegador en 320×568, 390×844, 768×1024, 1363×900 y 740×360, temas claro/oscuro, Crear/Mi equipo/Ajustes sin desbordamiento horizontal, borrador conservado, tema Sistema respondiendo al esquema del SO, persistencia tras recargar y error de sesión con apariencia temporal.
- Electron bajo Xvfb/WSL: apertura de la misma UI, preferencia compartida con navegador y actualización por SSE, `nativeTheme`, renderer aislado, cierre del cliente que se adjunta sin cerrar el servicio externo y arranque/cierre de un servicio propio con datos en ruta con espacios.
- Detector mecánico de UI: sin hallazgos en los cambios. Se revisaron capturas de escritorio y 320 px en ambos temas. Esto no certifica accesibilidad completa ni pantallas físicas.
- Lanzador web Windows compilado: arranque del auxiliar, recursos locales, enlace autorizado de un solo uso y detección de salida del hijo correctos mediante `tests/windows-web-smoke.ps1`. Ctrl+C desde terminal interactiva permanece manual.
- Windows **nativo**, auxiliar Bun compilado `bun-windows-x64-baseline`: SQLite/migración/rollback/reapertura, HTTP, estáticos, sesión, rechazo CSRF, SSE/desconexión, persistencia entre reinicios, fallo de motor, cierre autenticado y rutas con espacios: correcto mediante `tests/windows-smoke.ps1`.
- Electron Windows **nativo**, paquete `release/win-unpacked/Veltria.exe`: ventana visible, auxiliar fuera de ASAR, sesión/API, ajustes, cierre de ventana mediante WM_CLOSE, salida controlada del auxiliar, SQLite conservado y ruta de datos con espacios: correcto con `tests/windows-desktop-smoke.ps1`. No es una revisión visual manual. Chromium emitió dos mensajes `GPU state invalid after WaitForGetOffsetInRange` durante el cierre; no falló el smoke, pero el comportamiento gráfico nativo requiere revisión.
- Hardware real: Ryzen 5 7535HS, 12 procesadores lógicos y NVIDIA RTX 4050 Laptop con 6 GiB de VRAM, controlador 617.42. Windows informó aproximadamente 15.3 GiB de RAM total y WSL 7.4 GiB. Los valores disponibles son instantáneos; no hay mediciones de rendimiento ni recomendaciones derivadas.

## Windows: repetir pruebas y completar validación

En PowerShell, desde la raíz, tras compilar en Windows con Bun 1.4.4:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
bun run test:ui
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-smoke.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-web-smoke.ps1
bun run package:win
# Tras obtener release/win-unpacked:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-desktop-smoke.ps1
```

La compilación cruzada del auxiliar se preparó desde Linux con:

```bash
bun build --compile --target=bun-windows-x64-baseline ./apps/local-service/src/index.ts --outfile build/service/veltria-service.exe
```

Su ejecución sí se comprobó bajo Windows, no sólo su compilación. Pendiente: repetir toda la suite con Bun/Node nativos, revisión visual de la ventana Electron en Windows, instalación y desinstalación NSIS, SmartScreen/firma, rutas de instalación con espacios, cierre por controles de ventana/Ctrl+C del lanzador, escalado 125/150/200 %, contraste alto, lector de pantalla, suspensión/reanudación y ambos temas del sistema. Verificar tras desinstalar que se conserven SQLite y futuras creaciones. No se deben instalar controladores ni motores para este hito.

## Linux: completar validación física

Pendiente: distribución Linux fuera de WSL, AppImage sin extraer con FUSE disponible, X11/Wayland físicos, sandbox del paquete en la distribución elegida, acceso de GPU/controladores nativos (NVIDIA y alternativas AMD/Intel), cierre desde el escritorio, suspensión y escalado. No solucionar un fallo de sandbox añadiendo `--no-sandbox` a producción. WSL/Xvfb demuestra el funcionamiento observado, no certifica todas las distribuciones.

Para repetir el smoke de un paquete desempaquetado:

```bash
VELTRIA_ELECTRON_EXECUTABLE="$PWD/release/linux-unpacked/veltria" xvfb-run -a bun run test:ui
```

El servicio recibe rutas absolutas a UI y datos y el paquete lleva el auxiliar fuera de ASAR. **Paquete final Linux comprobado**: los 4 recorridos pasaron usando `release/Veltria package with spaces/veltria`, una copia con enlaces duros del paquete, incluyendo arranque/cierre del auxiliar propio y preferencia compartida. El lanzador web compilado también pasó `bun scripts/smoke-launcher.ts`, ejecutado desde otro cwd con espacios, autorización y cierre del servicio.

## macOS y motor real

macOS está preparado como destino de empaquetado, pero no se ha ejecutado ni firmado. En un Mac: compilar el auxiliar para la arquitectura propia (`bun-darwin-arm64` o `bun-darwin-x64-baseline`), ejecutar las mismas pruebas, construir con electron-builder y validar firma/notarización del auxiliar, cuarentena, rutas, sesiones y cierre. GPU/memoria unificada/MPS permanecen desconocidos, sin equipararlos a VRAM dedicada.

En Windows y Linux, con una instalación ComfyUI **ya existente** abierta: Mi equipo → Avanzado → guardar dirección local → Comprobar conexión. Comparar versión, nodos, modelos y dispositivos con `/system_stats` y `/object_info`; cerrar ComfyUI y volver a comprobar. Debe mostrar no disponible sin perder la descripción ni modificar su instalación. Revisar IPv6 local si se usa. La conexión Windows a ComfyUI 0.35.0 existente se comprobó posteriormente con nodos personalizados desactivados: ver [resultados](comfy-existing.md). Quedan pendientes el arranque habitual con sus extensiones, IPv6, Linux/WSL y generación del hito 2.

También pendientes: pruebas físicas iOS/Android/Safari, teclado virtual, áreas seguras, lectores de pantalla y localización completa. No hay prueba LAN, descarga, instalación, LoRA o generación porque esas funciones aún no existen.

## Artefactos generados y límites del empaquetado

- `release/Veltria-0.1.0.AppImage` y `release/linux-unpacked/`: generados con electron-builder. El paquete desempaquetado pasó el smoke también desde una ruta con espacios. La ejecución directa de AppImage/FUSE queda pendiente.
- `release/win-unpacked/Veltria.exe`: generado y ejecutado en Windows nativo; no requiere Bun/Node instalados.
- `build/browser/veltria-web` y `veltria-web.exe` con `resources/`: generados y comprobados en Linux y Windows respectivamente.
- **NSIS no completado**: `electron-builder --win nsis --x64 --publish never` llegó a crear el contenido Windows pero falló con `spawn wine ENOENT`. El host Linux no tiene Wine. Se retiró el archivo `.exe` parcial; el `.nsis.7z` es un intermedio, no un instalador validado. Para obtener sólo la carpeta ejecutable sin Wine: `bun run package:win:dir`. Repetir `bun run package:win` en Windows con Bun/Node fijados, o en un host Linux con Wine configurado. No se instaló Wine ni se ejecutó un instalador.
- Se conserva el icono predeterminado Electron en los artefactos; incorporar iconos de distribución de marca antes de una entrega pública. No hay firma, notarización, publicación ni actualizaciones automáticas.

Referencias técnicas consultadas: [ejecutables Bun](https://bun.com/docs/bundler/executables), [cierre de Fastify](https://fastify.dev/docs/latest/Reference/Server/) y [sandbox de Electron](https://www.electronjs.org/docs/latest/tutorial/sandbox). Los resultados anteriores proceden de ejecución local, no de esas referencias.
