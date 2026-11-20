# Validación y límites

Actualizado el 20 de noviembre de 2026 contra `development` (0.10.0). Las pruebas automatizadas con fixtures verifican contratos, persistencia, seguridad y flujos de UI; no sustituyen inferencia GPU ni certifican hardware no probado.

## Pruebas automatizadas vigentes

Comprobadas con **Bun 1.4.4** y **Node 24.13.0** (`bun run typecheck`, `vitest run` y `bun test`):

| Suite | Cobertura principal | Comando |
| --- | --- | --- |
| **Typecheck** | `tsconfig.json` + `apps/ui/tsconfig.json` (`tsc` y `vue-tsc`) | `bun run typecheck` |
| **Vitest** (11 archivos, 49 pruebas) | Contratos Zod, catálogo y prioridad, descubrimiento, calidad de imagen, clasificación de fallos y reducción de ajustes, SDXL, gestión de archivos, recetas administradas, avisos de almacenamiento, recursos, video e i18n | `bun x vitest run` |
| **Integración Bun** (6 archivos) | SQLite/migraciones (`service.bun.ts`), creación/LoRA/SDXL/fallos (`creation.bun.ts`), video (`video.bun.ts`), descubrimiento de motor (`setup.bun.ts`), instalación administrada y errores de disco/permisos (`managed.bun.ts`), red local LAN + QR + permisos `lan` y revocación SSE (`lan.bun.ts`) | `bun run test` |
| **Humo del servicio** | Binario compilado y fuente: HTTP loopback, sesión/CSRF, SSE, bloqueo de instancia, estáticos y recuperación tras `SIGKILL` | `bun scripts/smoke-service.ts` (incluido en `bun run test`) |
| **Playwright E2E** (4 archivos) | Navegador y Electron (`app.e2e.ts`), creación/video/calidad/gestión de descargas/recuperación guiada tras recarga (`creation.e2e.ts`), progreso real de bytes (`progress.e2e.ts`), bienvenida, avisos de almacenamiento y selector nativo (`setup.e2e.ts`) en escritorios y móviles (hasta 320 px) | `bun run test:ui` (o `xvfb-run -a bun run test:ui` en Linux sin pantalla) |
| **Humo Windows nativo** | Servicio compilado, lanzador web y paquete Electron `Kobocraft.exe` con rutas con espacios y cierre limpio | `.\tests\windows-smoke.ps1`, `.\tests\windows-web-smoke.ps1`, `.\tests\windows-desktop-smoke.ps1` |

## Validaciones con hardware real registradas

Equipo de referencia comprobado: Ryzen 5 7535HS, RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM.

- **Imagen con ComfyUI existente (Windows):**
  - SD 1.5 y DreamShaper 8 (512 × 512 en configuraciones equilibrada, borrador y más pasos), descarga reanudada por HTTP 206 con verificación SHA-256, LoRA SD 1.5 descargado y aplicado con intensidad 0,7 y biblioteca persistente tras reiniciar.
  - SDXL Base oficial (6,94 GB verificados) con `--lowvram` a **768 × 768** (20 pasos, CFG 7) y **1024 × 1024** (24 pasos, CFG 6,5), PNG validados y biblioteca conservada sin redescargar pesos.
- **Instalación administrada (Windows nativo aislado y WSL Ubuntu 24.04):**
  - Descarga verificada del entorno fijado (receta Windows CUDA v2 `+cu126`, 3,52 GB; receta Linux, 3,88 GB) y SD 1.5, pausa/reapertura, recuperación tras cierres forzados durante extracción e instalación de dependencias, instalación offline, verificación CUDA, generación explícita de PNG real (512 × 512, 20 pasos, CFG 7) y conservación en Biblioteca tras reiniciar.
  - Comprobación real de denegación/restauración ACL en Windows nativo sobre una carpeta desechable (`permission-denied` y preservación de archivos existentes).
- **Red local (LAN), paquetes Windows y marca Kobocraft:**
  - Integración completa de detección IPv4 privada, QR SVG local, emparejamiento, aprobación/rechazo, rol `lan` con `403 FORBIDDEN` en rutas administrativas y revocación inmediata en `tests/lan.bun.ts`.
  - Validación física real en Windows nativo (`Kobocraft.exe` sobre Wi-Fi privada `192.168.3.62`, 20 de noviembre de 2026): emparejamiento desde un segundo dispositivo físico y aprobación en el equipo principal, creación y consulta de imágenes con rol `lan`, funcionamiento sin salida a Internet en la misma Wi-Fi local y revocación inmediata del dispositivo desde la PC principal.
  - Paquetes nativos Windows `0.10.0` recompilados tras el cierre de código del hito 4 y comprobados en equipo real con `windows-smoke.ps1`, `windows-web-smoke.ps1` y `windows-desktop-smoke.ps1`.
  - Título `Kobocraft`, logotipos adaptativos claro/oscuro y acción *Quitar del lienzo*.

No se midió pico de VRAM ni se establecen tiempos garantizados. SDXL a 1536 px, extremos de pasos/CFG y el conjunto de video H3 no tienen generación GPU certificada.

## Repetir comprobaciones

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
# Con Chromium de Playwright instalado y pantalla, o Xvfb:
xvfb-run -a bun run test:ui
```

Paquetes:

```bash
bun run package:linux
bun run package:win:dir
```

PowerShell (Windows nativo, desde la raíz del proyecto):

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1
```

## Plataformas y pendientes

- **Windows:** ampliar casos de GPU/formatos, escalado, accesibilidad, usabilidad con principiantes e instalador firmado.
- **Linux:** comprobado en WSL/Xvfb y WSLg; falta ejecución y GPU en Linux nativo (incluido AppImage).
- **macOS:** build, arranque, hardware e inferencia pendientes.
- **Producto:** audio, video H3 viable y prueba de usabilidad con una persona nueva (hitos 3 y 4).
