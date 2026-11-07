# Validación y límites

Revisión documental: 7 de noviembre de 2026. Las cifras siguientes son resultados registrados, no una nueva ejecución de pruebas durante esta limpieza. El código ejecutable no se modifica.

## Paquete vigente

Producto 0.9.0, protocolo 8, SQLite de trabajos 4. Bun 1.4.4, Node 24.13.0 para desarrollo; dependencias exactas en `package.json`/`bun.lock`. No exigir runtimes separados al usuario del paquete.

| Comprobación registrada | Resultado |
| --- | --- |
| TypeScript y Vue | Correctos. |
| Vitest | 31 pruebas aprobadas. |
| Bun | 25 pruebas, 216 aserciones aprobadas. |
| HTTP real fuente y ejecutable compilado | 83 comprobaciones aprobadas. |
| Playwright navegador/Electron en Linux/WSL | 20 recorridos aprobados; temas, idiomas, móvil, preparación, calidad, catálogo y biblioteca. |
| Builds/paquetes | Windows y Linux unpacked, lanzadores web y AppImage construidos. |
| Windows nativo | API, SQLite, autorización, recursos, apertura/cierre de escritorio y lanzador web aprobados. |
| Tras mover el repositorio | Lanzador web nativo Windows y diagnóstico SQLite correctos desde Documents/ChatGPT/Veltria. |
| Laboratorio Linux nuevo | Web y Electron en WSLg, ausencia de motor, GPU visible, persistencia y sandbox comprobados. |

Las fixtures comprueban contratos, errores, transferencias, flujo y persistencia, **no inferencia**. Las pruebas GPU de abajo tienen registros propios y no se repiten por cada build. No convertir una ejecución en certificación de todas las opciones.

## Imagen real en Windows

Equipo de prueba: Ryzen 5 7535HS, RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM; ComfyUI existente. Se usaron datos aislados, sin certificar artificialmente la biblioteca habitual.

| Recorrido | Resultado observado |
| --- | --- |
| SD 1.5 y DreamShaper 8 | Seis imágenes de 512 × 512: equilibrada, borrador y más pasos de cada modelo; PNG y parámetros comprobados; biblioteca conservada tras reiniciar. |
| Descarga DreamShaper | Reanudación pública del tramo final sobre un prefijo copiado localmente; HTTP 206 y SHA-256 completo correctos. No se presenta como descarga íntegra nueva ni como corte real del ISP. |
| LoRA SD 1.5 | Búsqueda por UI, descarga real de unos 38 MB, base local, intensidad 0,7 y generación de 512 × 512; persistencia tras reiniciar. |
| SDXL inicial | Checkpoint oficial completo de 6,94 GB verificado; UI preparó/reutilizó el archivo y generó 768 × 768, 20 pasos, CFG 7; `LOW_VRAM` confirmado. La transferencia íntegra se hizo con el auxiliar autorizado, no desde la UI. |
| Calidad SDXL | Elección desde UI de 1024 × 1024, 24 pasos y CFG 6,5; PNG guardado, inspección visual y biblioteca persistente; sin nuevas descargas de pesos. |

No se midió pico de VRAM ni se establecen tiempos garantizados. SDXL 1536 px, los extremos de pasos/CFG y todos los formatos no tienen inferencia certificada. El conjunto H3 detectado no tiene una generación real validada.

Registros conservados bajo `%LOCALAPPDATA%\Veltria`:

- `catalog-real-2026-11-05T20-29-35-646Z-9c469e6f\validated-catalog.json`.
- `discovery-real-1793915199787-a5b2543a\validated-discovery.json`.
- `sdxl-real-1793991687474-91a2236a\validated-sdxl.json`.
- `image-quality-real-1793995271429-fe666a30\validated-sdxl.json`.

Los cuatro registros se comprobaron disponibles con `result: passed` durante esta revisión documental. Conservan la procedencia exacta de sus pruebas; no son archivos del repositorio ni nuevos benchmarks.

## Repetir comprobaciones

Desde la raíz del proyecto, con las herramientas fijadas en PATH:

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

`package:linux` se ejecuta en Linux; `package:win:dir` selecciona explícitamente el target Windows del auxiliar. `package:win` configura NSIS, pero construir una carpeta Windows no certifica instalador ni firma. macOS necesita build y pruebas reales en un Mac. Ninguno de estos comandos publica.

PowerShell, desde el checkout actual:

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1
```

Prueba GPU optativa con checkpoint SDXL ya preparado; consume GPU y crea otra imagen. Confirmar que no hay trabajos activos:

```powershell
.\tests\windows-sdxl-real.ps1 -ModelsDirectory 'D:\Veltria\models' -CustomQuality
```

Los ejecutores de descarga real o catálogo pueden transferir pesos y usar GPU; no forman parte de `bun run test`. Revisar su alcance antes de ejecutarlos y autorizar nuevas descargas cuando correspondan. El auxiliar de descarga SDXL exige `--authorize-sdxl` y verifica SHA-256; no se necesita repetir una descarga ya íntegra.

## Plataformas y pendientes

**Windows:** ampliar GPU/formatos, presión de memoria, cancelación de imágenes grandes, escalado, accesibilidad, usabilidad con principiantes, Ctrl+C interactivo e instalador firmado.

**Linux:** pruebas disponibles en WSL/Xvfb y WSLg. El laboratorio ve NVIDIA y unos 7,4 GiB de RAM, pero aún no ejecuta inferencia ni tiene ComfyUI. Falta GPU en Linux nativo y ejecución del AppImage en una distribución con pantalla/FUSE. Una build o ventana WSLg no sustituye esas pruebas.

**macOS:** build, arranque, hardware e inferencia pendientes. No hay perfil Apple Silicon certificado.

**Producto:** falta la instalación administrada desde cero, recuperación de ese entorno, LAN, audio y un video viable comprobado. La prueba de usabilidad completa con una persona nueva no se ha realizado.

El laboratorio conserva `D:\Veltria\lab\reports\validation.json` con `passed` y una captura real. [Guía del entorno](linux-lab.md). [Estado de hitos](status.md), [arquitectura](../ARCHITECTURE.md) y [apertura](../README.md).
