# Estado e hitos

Revisado el 10 de noviembre de 2026 contra el código de `development`. Versión de desarrollo **0.10.0**, protocolo **9**, SQLite de trabajos **4**. [Abrir y desarrollar](../README.md).

## Funciona

UI Vue compartida entre navegador y Electron; servicio Bun/Fastify; sesiones locales, SQLite, hardware y monitor de recursos; temas y español/inglés. Modelos, configuraciones y trabajos proceden del servicio, sin datos ficticios de producción.

Imagen: SD 1.5, DreamShaper 8 y SDXL Base; preparación con ComfyUI existente o entorno propio fijado; descarga/verificación, búsqueda compatible, LoRA SD 1.5 admitidos, gestión de archivos, calidad por imagen y biblioteca persistente. SDXL tiene generación GPU Windows comprobada a 768 y 1024 px. Las opciones superiores no quedan certificadas por ello.

## Hitos

| Hito | Estado | Qué falta |
| --- | --- | --- |
| 1. UI, servicio y equipo real | Implementado y comprobado en Windows/WSL | Validación ampliada en Linux nativo y macOS. |
| 2. Primera imagen y biblioteca | Cumplido en Windows | Más equipos y pruebas GPU en Linux nativo. |
| 3. Preparación administrada | Instalación propia, imagen real/biblioteca y recuperación de cierres forzados en WSL/Windows; avisos de disco, cuota, sólo lectura y permisos con recuperación; ACL Windows real comprobada | Linux nativo; usabilidad con una persona nueva; ampliar equipos y sistemas de archivos. |
| 3B. Uso por LAN | Pendiente | Listener explícito, emparejamiento, permisos y prueba desde otro dispositivo. |
| 4. Recomendaciones verificables y recuperación guiada | Parcial: reglas por equipo, filtros por intención, evidencia y bienvenida con alternativas | Clasificar fallos, ofrecer recuperación concreta de memoria, unificar la propuesta bienvenida/catálogo y ampliar validación. [Comparación y aceptación](milestone-4.md). |
| 5. Video, audio y distribución ampliada | Video experimental; paquetes Windows/Linux disponibles | Generación H3 real viable, audio, instalador firmado y pruebas de otras plataformas. |

Hay partes de los hitos 4 y 5 adelantadas. El recorrido sin motor ya tiene instalación real comprobada en el laboratorio; eso no certifica todas las plataformas ni sustituye una prueba de usabilidad.

## Siguiente prioridad

El siguiente incremento funcional propuesto del hito 4 es clasificar errores y ofrecer recuperación guiada por memoria, conservando descripción, ajustes e identidad de los trabajos. Después, compartir la prioridad de recomendaciones entre bienvenida y catálogo y ampliar evidencia. [Requisitos y faltantes](milestone-4.md).

La validación pendiente del hito 3 permanece abierta en Linux nativo y usabilidad. El recorrido completo ya pasó en Veltria-Lab/WSL y en [Windows nativo con entorno y datos separados en D:](windows-lab.md), con imagen CUDA y biblioteca tras reiniciar, pausa y cierres forzados en extracción/dependencias. La prueba Windows comparte SO/GPU con el host; no certifica una VM o un Windows limpio. Espacio/permisos tienen cobertura acotada. [Implementación y evidencia](managed-setup.md). No añadir un LLM para la selección ni declarar cerrado el hito 3 para todas las plataformas por estos avances.

El caso sin motor se prueba en **Veltria-Lab**, con disco en D y datos separados. La instalación habitual de ComfyUI en D se reutiliza, no se reemplaza. [Tarea siguiente](../FIRST-TASK.md), [recorrido](setup.md), [laboratorio](linux-lab.md).

## Límites actuales

- Linux se ha probado en WSL/Xvfb y WSLg; no equivale a Linux nativo. macOS está pendiente.
- H3 detectado no equivale a video generado. Su conjunto grande no está verificado en la GPU de 6 GB.
- SDXL comunitario arbitrario, LoRA SDXL, varios LoRA, refiner, escalado y otras familias siguen fuera del soporte actual.
- Instalación administrada limitada a Windows/Linux x64 con NVIDIA y recetas fijadas. Sin LAN, audio, entrenamiento, importación de workflows, cuentas, nube o autoactualizaciones.

Pruebas y alcance exacto en [validation.md](validation.md). El historial de cambios está en Git, no en una cadena de guías por versión.
