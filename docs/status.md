# Estado e hitos

Revisado el 17 de noviembre de 2026 contra el código de `development`. Versión de desarrollo **0.10.0**, protocolo **9**, SQLite de trabajos **4**. [Abrir y desarrollar](../README.md).

## Funciona

UI Vue compartida entre navegador, Electron y red local; servicio Bun/Fastify; sesiones locales (`owner`) y remotas (`lan`), SQLite, hardware y monitor de recursos; temas claro/oscuro/sistema con logotipos Kobocraft adaptativos y español/inglés. Modelos, configuraciones y trabajos proceden del servicio, sin datos ficticios de producción.

Imagen: SD 1.5, DreamShaper 8 y SDXL Base; preparación con ComfyUI existente o entorno propio fijado; descarga/verificación, búsqueda compatible, LoRA SD 1.5 admitidos, gestión de archivos, calidad por imagen, limpieza del lienzo y biblioteca persistente. SDXL tiene generación GPU Windows comprobada a 768 y 1024 px. Las opciones superiores no quedan certificadas por ello.

Red local (LAN): listener dedicado opcional por interfaz IPv4 privada, código de 6 dígitos y QR SVG generado localmente, aprobación explícita en el equipo principal, rol `lan` con rutas restringidas y revocación inmediata de dispositivos y flujos SSE.

## Hitos

| Hito | Estado | Qué falta |
| --- | --- | --- |
| 1. UI, servicio y equipo real | Implementado y comprobado en Windows/WSL | Validación ampliada en Linux nativo y macOS. |
| 2. Primera imagen y biblioteca | Cumplido en Windows | Más equipos y pruebas GPU en Linux nativo. |
| 3. Preparación administrada | Instalación propia, imagen real/biblioteca y recuperación de cierres forzados en WSL/Windows; avisos de disco, cuota, sólo lectura y permisos con recuperación; ACL Windows real comprobada | Linux nativo; usabilidad con una persona nueva; ampliar equipos y sistemas de archivos. |
| 3B. Uso por LAN | Implementado y cubierto por pruebas de integración (`tests/lan.bun.ts`) | Validación desde un segundo dispositivo físico en la misma red local y con corte de Internet. |
| 4. Recomendaciones verificables y recuperación guiada | Parcial: reglas por equipo, filtros por intención, evidencia y bienvenida con alternativas | Clasificar fallos, ofrecer recuperación concreta de memoria, unificar la propuesta bienvenida/catálogo y ampliar validación. [Comparación y aceptación](milestone-4.md). |
| 5. Video, audio y distribución ampliada | Video experimental; paquetes Windows/Linux disponibles | Generación H3 real viable, audio, instalador firmado y pruebas de otras plataformas. |

## Siguiente prioridad

El siguiente incremento funcional propuesto del hito 4 es clasificar errores y ofrecer recuperación guiada por memoria, conservando descripción, ajustes e identidad de los trabajos. Después, compartir la prioridad de recomendaciones entre bienvenida y catálogo y ampliar evidencia. [Requisitos y faltantes](milestone-4.md).

La validación pendiente del hito 3 permanece abierta en Linux nativo y usabilidad, y la del hito 3B requiere prueba con un segundo dispositivo físico real. El recorrido administrado completo ya pasó en Veltria-Lab/WSL y en [Windows nativo con entorno y datos separados en D:](windows-lab.md), con imagen CUDA y biblioteca tras reiniciar, pausa y cierres forzados en extracción/dependencias. [Implementación y evidencia](managed-setup.md).

El caso sin motor se prueba en **Veltria-Lab** o en el entorno Windows separado de D:. La instalación habitual de ComfyUI en D se reutiliza, no se reemplaza. [Tarea siguiente](../FIRST-TASK.md), [recorrido](setup.md), [laboratorio Linux](linux-lab.md).

## Límites actuales

- Linux se ha probado en WSL/Xvfb y WSLg; no equivale a Linux nativo. macOS está pendiente.
- LAN escucha por HTTP en la interfaz privada elegida; en WSL2 advierte que conectar desde otro dispositivo físico sin reenvío de puertos requiere iniciar Kobocraft en Windows.
- H3 detectado no equivale a video generado. Su conjunto grande no está verificado en la GPU de 6 GB.
- SDXL comunitario arbitrario, LoRA SDXL, varios LoRA, refiner, escalado y otras familias siguen fuera del soporte actual.
- Instalación administrada limitada a Windows/Linux x64 con NVIDIA y recetas fijadas. Sin audio, entrenamiento, importación de workflows, cuentas, nube o autoactualizaciones.

Pruebas y alcance exacto en [validation.md](validation.md). El historial de cambios está en Git.
