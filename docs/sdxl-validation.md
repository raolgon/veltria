# Veltria 0.8 · SDXL local

Fecha: 6 de noviembre de 2026. Rama `development`. Sin subagentes.

## Qué funciona

El catálogo incluye SD 1.5, DreamShaper 8 y **SDXL Base 1.0**, con tres configuraciones por modelo. SDXL reutiliza el plan de preparación, consentimiento, descarga con progreso/reanudación y SHA-256, gestión de archivos, creación y biblioteca existentes. No instala otro ComfyUI ni paquetes o nodos personalizados. La UI compartida conserva español/inglés, temas y recursos en vivo.

La opción SDXL propone 768 × 768, 20 pasos, CFG 7, Euler/normal y arranque de ComfyUI con `--lowvram`. Los formatos horizontal y vertical usan 768 × 576 y 576 × 768. Borrador usa 12 pasos y más pasos usa 30. No utiliza refiner. Es un perfil conservador frente a los 1024 px habituales de SDXL; no se promete calidad, tiempo ni consumo máximo.

La recomendación requiere NVIDIA con unos 6 GB de VRAM y 16 GB de RAM nominales. Sigue marcada con ajustes de memoria y ejecución por comprobar hasta una prueba de esa configuración en ese equipo. Una prueba no certifica otras dimensiones o variantes. La compatibilidad del catálogo se calcula por modelo, sin ocultar SD 1.5 por haber seleccionado SDXL. Los LoRA SD 1.5 no pueden usar SDXL como base.

## Fuente y consentimiento

Checkpoint oficial de [Stability AI](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0), fijado al commit `462165984030d82259a11f4367a4eed129e94a7b`:

- Archivo de origen: `sd_xl_base_1.0.safetensors`.
- Tamaño: **6.938.078.334 bytes** (6,94 GB decimales).
- SHA-256: `31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b`.
- [Licencia CreativeML Open RAIL++-M](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/462165984030d82259a11f4367a4eed129e94a7b/LICENSE.md).
- Destino autorizado y conservado: `D:\Veltria\models\checkpoints\veltria-sdxl-base-31e35c80.safetensors`.

El usuario autorizó expresamente la descarga y una generación real. La transferencia completa se hizo con `scripts/prepare-sdxl-checkpoint.ts`, auxiliar optativo que exige `--authorize-sdxl` y usa los adaptadores de descarga/verificación de producción. La UI reutilizó después ese archivo y volvió a comprobarlo durante su preparación. **La transferencia completa de 6,94 GB no se presenta como una prueba de descarga desde la UI.** El progreso y la gestión por UI tienen cobertura automatizada y validaciones históricas del catálogo.

La búsqueda reconoce el SDXL oficial fijado; no admite por ello todos los checkpoints SDXL de la comunidad. La exploración general por popularidad sigue centrada en SD 1.5. SDXL es una ampliación respecto a SD 1.5, no una afirmación de que sea la familia más reciente disponible.

## Prueba GPU real en Windows

RTX 4050 Laptop de 6 GB, Ryzen 5 7535HS, 16 GB de RAM nominales, Windows build 26200, controlador NVIDIA 617.42. Se reutilizó ComfyUI 0.35.0 existente con PyTorch 2.10.0+cu130, sin instalar otro motor. Se comprobó que la sesión principal no tenía preparación ni trabajos antes de iniciar la prueba aislada.

Desde la UI nativa se seleccionó SDXL, se preparó el equipo, se generó una ilustración de una casa junto a un río y se guardó el PNG. Resultado real: **768 × 768, 20 pasos, CFG 7, Euler/normal**. El log confirmó `LOW_VRAM`. La imagen se inspeccionó visualmente y permaneció en la biblioteca aislada tras reiniciar el servicio, sin reenviar el trabajo.

El log de ComfyUI registró 33,85 segundos para ejecutar el prompt en esta prueba. El intervalo de la petición UI a la finalización fue aproximadamente 41,62 segundos. Son observaciones de una ejecución, no un benchmark ni una estimación para otras imágenes. No se midió el pico de VRAM.

Evidencia local (no publicada con datos del usuario):

```text
C:\Users\rafao\AppData\Local\Veltria\sdxl-real-1793991687474-91a2236a\validated-sdxl.json
C:\Users\rafao\AppData\Local\Veltria\sdxl-real-1793991687474-91a2236a\sdxl-real.png
C:\Users\rafao\AppData\Local\Veltria\sdxl-real-1793991687474-91a2236a\sdxl-real-ui.png
C:\Users\rafao\AppData\Local\Veltria\sdxl-real-1793991687474-91a2236a\image-engine\engine.log
```

El registro confirma `passed`, `lowVramConfirmed`, `ownedServiceClosed` y `checkpointRetained`. Sólo se cerraron los procesos de la prueba. No se insertó una certificación ni una creación ficticia en la biblioteca habitual; el modelo aprobado permanece disponible en D. La imagen de ejemplo de SDXL incluida en el catálogo procede de este resultado real.

## Comprobaciones

- TypeScript y Vue: correctos.
- Vitest: 30 pruebas; Bun: 24 pruebas y 203 aserciones; HTTP real fuente/compilado: 83 comprobaciones.
- Playwright en Linux/WSL con Xvfb: 19 recorridos, incluidos catálogo, gestión, idiomas, móvil y Electron. Inspección de las capturas finales en escritorio y 320 px.
- Builds de servicio/UI/escritorio y paquetes Windows/Linux, incluido AppImage: correctos.
- Windows nativo: HTTP, escritorio y lanzador web correctos con protocolo 7 y catálogo de 3 modelos/9 configuraciones.
- Descarga íntegra con SHA-256 y generación GPU real de SDXL en Windows: correctas. Las otras dimensiones y cantidades de pasos se comprobaron con fixtures, sin una segunda generación real.

Comandos de comprobación desde la raíz con Bun 1.4.4 y Node 24.13.0:

```bash
bun run typecheck
bun run test
xvfb-run -a bun run test:ui
```

Para repetir la prueba real, con el checkpoint ya preparado y sin trabajos activos (vuelve a usar GPU):

```powershell
.\tests\windows-sdxl-real.ps1 -ModelsDirectory 'D:\Veltria\models'
```

El harness usa Edge headless con perfil aislado y el Node interno de Electron como controlador. En la ejecución registrada se suministró `-Runtime` con el Electron existente en `release\0.7.0\win-unpacked\Veltria.exe`; la UI, el servicio y el lanzador probados eran **0.8.0**. El valor predeterminado ya usa el paquete 0.8.0. No requiere instalar otro Node al usuario final.

## Abrir

Cerrar primero versiones anteriores. Conservar cada ejecutable con sus recursos.

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio:
.\release\0.8.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime.
.\build\browser\0.8.0\veltria-web.exe
```

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.8.0/linux-unpacked/veltria
# Navegador:
./build/browser/0.8.0/veltria-web
```

Protocolo **7**, SQLite de trabajos **4** sin una nueva migración. Las configuraciones antiguas SD 1.5 siguen aceptadas; las nuevas recetas SDXL requieren 0.8. No se garantiza una vuelta a una versión anterior con esos datos. No compartir una base activa entre Windows y Linux. Pesos, resultados y datos personales no se suben a GitHub.

## Pendiente por plataforma y alcance

**Windows:** ampliar las pruebas reales a formatos horizontal/vertical, variantes de pasos, presión de memoria, cancelación durante SDXL y otros equipos. Quedan manuales Ctrl+C interactivo del lanzador, instalador/firma y una prueba de usabilidad con alguien sin experiencia.

**Linux:** hay build, AppImage y comprobaciones de servicio/UI/Electron en WSL/Xvfb. Falta generación SDXL con GPU en Linux nativo, prueba del AppImage en una distribución con pantalla/FUSE y validación de permisos/rutas del motor existente allí. WSL no certifica esas condiciones.

**macOS:** build y ejecución reales, GPU/Metal y compatibilidad del perfil pendientes; el mínimo NVIDIA de este perfil no supone soporte en Apple Silicon.

Fuera de este incremento: finetunes y LoRA SDXL arbitrarios, refiner, 1024 px, motores nuevos, otras familias modernas y validación GPU del video H3. No se descargaron sus componentes.
