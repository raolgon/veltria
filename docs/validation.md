# Validación y límites

## Red local (LAN), marca Kobocraft y limpieza de lienzo · 13 noviembre 2026

- **Red local (`tests/lan.bun.ts`):** pruebas de integración del controlador y servidor LAN. Verifican detección de IPv4 privadas (`10/8`, `172.16/12`, `192.168/16`), generación local de QR SVG, estado inicial desactivado, activación en interfaz autorizada, bloqueo (`401 LAN_SESSION`) sin sesión remota, flujo completo de solicitud (`POST /api/v1/lan/pair`), espera mientras está `pending`, aprobación del propietario (`POST /api/v1/lan/decision`), reclamación de cookie y CSRF con rol `lan`, creación de trabajo desde cliente LAN, bloqueo (`403 FORBIDDEN`) de rutas administrativas (`/api/v1/settings`, `/api/v1/lan/disable`, `/api/v1/control/shutdown`) y revocación inmediata de sesión y stream SSE al revocar el dispositivo o desactivar la LAN. Falta prueba manual con un segundo dispositivo físico real.
- **Marca Kobocraft y lienzo:** la aplicación, ventana Electron, lanzadores y pruebas de humo verifican el título `Kobocraft` y los logotipos adaptativos claro/oscuro (`kobocraft-light`, `kobocraft-dark`). El estudio incluye acción para limpiar el lienzo cuando hay resultado o vista previa activa.

## Almacenamiento y permisos ampliados · 10 noviembre 2026

La preparación distingue errores de espacio (`ENOSPC` y `SQLITE_FULL`), cuota (`EDQUOT`), sólo lectura (`EROFS`) y permisos (`EACCES`/`EPERM`). Cada aviso identifica la carpeta y si corresponde al entorno, modelos o datos. El plan comprueba permisos sin escribir, reserva el presupuesto conjunto cuando entorno/modelos comparten unidad y bloquea si no alcanza o no se puede comprobar. Si queda menos de 256 MiB o el 10 % del presupuesto requerido, el mayor de ambos, muestra una advertencia que permite continuar con consentimiento. Se reservan además 16 MiB para metadatos del entorno administrado; no es una garantía frente a cambios posteriores del disco.

Después de autorizar se prueba crear, escribir, sincronizar y retirar un archivo temporal propio antes de descargar en cada carpeta. Los fallos posteriores conservan los archivos recuperables y requieren revisión para continuar. Cambiar la carpeta de modelos o entorno invalida el consentimiento. No se elevan privilegios ni se cambian permisos del usuario desde la app. Un fallo al persistir el error en SQLite queda visible en memoria y el estado activo anterior se recupera como pausa tras reiniciar.

Pruebas: **41 Vitest**, **14 casos de instalación administrada y 18 de creación/búsqueda**, **4 recorridos Playwright** (incluyen advertencia, bloqueo, cambio de carpeta, consentimiento y ancho de 320 px), typecheck y compilación Linux/Windows. Los casos de cuota y sólo lectura se inyectan; Linux/WSL usa denegación real con `chmod` y `/dev/full`. No se llenó una unidad del usuario.

**ACL real en Windows nativo: aprobado.** `tests/windows-storage-permissions.ps1` usa el comprobador compilado de la app en una carpeta desechable de D:, deniega escritura al usuario actual, comprueba `permission-denied`, restaura su ACL y verifica recuperación, conservación de un archivo existente y ausencia de temporales del comprobador. Informe: `D:\Veltria\lab\storage-permissions-2d87660789c841f298c7491461bfe502\report.json`.

## Windows nativo con entorno y datos separados · 10 noviembre 2026

**Aprobado** en `D:\Veltria\lab\windows-native-20261110`, con Python, ComfyUI, modelos, cachés, temporales y datos propios, compartiendo Windows 11 Home y la RTX 4050 del host (no es una VM ni instalación limpia del SO). Se descargaron **3.517.429.712 bytes** de entorno CUDA (receta v2 con wheels `+cu126`) y se verificó una copia local de SD 1.5.

Pasaron la elección explícita de entorno separado, consentimiento, pausa durante descarga y reapertura, cierre forzado del árbol de procesos durante extracción y durante dependencias, revisión/continuación, instalación offline y comprobación CUDA. Desde la UI web de producción se creó expresamente un PNG real de **512 × 512, 20 pasos, CFG 7** (`pytorch version: 2.7.1+cu126`, `cuda:0 NVIDIA GeForce RTX 4050 Laptop GPU`). Tras cerrar y reabrir el servicio, Biblioteca mostró el mismo trabajo y PNG, sin duplicarlos.

Evidencia: `build/lab/validated-managed-windows.json` (`passed`, `fixture: false`), `build/lab/first-managed-windows-image.png` y registros en `D:\Veltria\lab\windows-native-20261110\reports`. [Detalle y repetición](windows-lab.md).

## Aceptación en Veltria-Lab/WSL y bienvenida principal · 9–10 noviembre 2026

- **Recorrido administrado desde cero (`/home/veltria/lab/hito3-20261109`):** descarga real del entorno Linux (3.879.334.071 bytes) y SD 1.5 (2.132.696.762 bytes), SHA-256, pausa/reapertura, instalación offline con PyTorch eager (sin exigir compilador C para Triton), imagen GPU de 512 × 512 (20 pasos, CFG 7) y biblioteca conservada tras reiniciar. Evidencia: `build/lab/validated-managed.json` y `build/lab/first-managed-image.png`.
- **Recuperación de cierres forzados desde la bienvenida (`/home/veltria/lab/acceptance-hito3-20261110`):** `SIGKILL` inyectado durante extracción y durante dependencias; en ambas reaperturas volvió en estado `paused` con el editor oculto, requirió revisar y autorizar el plan reutilizando paquetes verificados, completó CUDA y generó PNG GPU de 512 × 512 conservado en Biblioteca tras reiniciar. Evidencia: `build/lab/hito3-acceptance-20261110.json` y `build/lab/first-welcome-acceptance.png`.
- **Bienvenida y progreso por etapa (`WelcomeSetup.vue`, `PreparationProgress.vue`):** el editor y la navegación no se montan hasta tener vínculo y modelo `prepared`. Entorno y modelo muestran barras separadas con bytes y porcentajes reales. Capturas: `build/lab/welcome3-{desktop,mobile}.png` y `build/lab/model-progress-mobile.png`.

## Imagen real en Windows con motor existente

Equipo de prueba: Ryzen 5 7535HS, RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM; ComfyUI existente con datos aislados.

| Recorrido | Resultado observado |
| --- | --- |
| SD 1.5 y DreamShaper 8 | Seis imágenes de 512 × 512: equilibrada, borrador y más pasos de cada modelo; PNG y parámetros comprobados; biblioteca conservada tras reiniciar. |
| Descarga DreamShaper | Reanudación pública del tramo final sobre un prefijo copiado localmente; HTTP 206 y SHA-256 completo correctos. |
| LoRA SD 1.5 | Búsqueda por UI, descarga real de unos 38 MB, base local, intensidad 0,7 y generación de 512 × 512; persistencia tras reiniciar. |
| SDXL inicial | Checkpoint oficial completo de 6,94 GB verificado; UI preparó/reutilizó el archivo y generó 768 × 768, 20 pasos, CFG 7 con `LOW_VRAM`. |
| Calidad SDXL | Elección desde UI de 1024 × 1024, 24 pasos y CFG 6,5; PNG guardado y biblioteca persistente sin nuevas descargas de pesos. |

Registros conservados bajo `%LOCALAPPDATA%\Veltria`: `catalog-real-2026-11-05T20-29-35-646Z-9c469e6f\validated-catalog.json`, `discovery-real-1793915199787-a5b2543a\validated-discovery.json`, `sdxl-real-1793991687474-91a2236a\validated-sdxl.json` e `image-quality-real-1793995271429-fe666a30\validated-sdxl.json`.

No se midió pico de VRAM ni se establecen tiempos garantizados. SDXL 1536 px, los extremos de pasos/CFG y el conjunto de video H3 no tienen una generación GPU certificada.

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

PowerShell, desde el checkout actual:

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1
```

Prueba GPU optativa con checkpoint SDXL ya preparado (consume GPU y crea otra imagen):

```powershell
.\tests\windows-sdxl-real.ps1 -ModelsDirectory 'D:\Veltria\models' -CustomQuality
```

## Plataformas y pendientes

- **Windows:** ampliar GPU/formatos, recuperación guiada de memoria (hito 4), escalado, accesibilidad, usabilidad con principiantes e instalador firmado.
- **Linux:** pruebas disponibles en WSL/Xvfb y WSLg con inferencia SD 1.5 comprobada en Veltria-Lab. Falta GPU en Linux nativo y ejecución del AppImage en una distribución nativa.
- **macOS:** build, arranque, hardware e inferencia pendientes.
- **Producto:** probar LAN desde un segundo dispositivo físico real; completar recuperación guiada de memoria del hito 4; audio, video H3 viable y prueba de usabilidad con una persona nueva.
