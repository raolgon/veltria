# Estado e hitos

Revisado el 7 de noviembre de 2026 contra el código de `development`. Versión del producto **0.9.0**, protocolo **8**, SQLite de trabajos **4**. [Abrir y desarrollar](../README.md).

## Funciona

UI Vue compartida entre navegador y Electron; servicio Bun/Fastify; sesiones locales, SQLite, hardware y monitor de recursos; temas y español/inglés. Modelos, configuraciones y trabajos proceden del servicio, sin datos ficticios de producción.

Imagen: SD 1.5, DreamShaper 8 y SDXL Base; preparación con ComfyUI existente; descarga/verificación, búsqueda compatible, LoRA SD 1.5 admitidos, gestión de archivos, calidad por imagen y biblioteca persistente. SDXL tiene generación GPU Windows comprobada a 768 y 1024 px. Las opciones superiores no quedan certificadas por ello.

## Hitos

| Hito | Estado | Qué falta |
| --- | --- | --- |
| 1. UI, servicio y equipo real | Implementado y comprobado en Windows/WSL | Validación ampliada en Linux nativo y macOS. |
| 2. Primera imagen y biblioteca | Cumplido en Windows | Más equipos y pruebas GPU en Linux nativo. |
| 3. Preparación administrada | Parcial: reutilización del motor y modelos preparados desde la app | Instalar/configurar un entorno propio cuando no exista ComfyUI; recuperación de esa instalación. |
| 3B. Uso por LAN | Pendiente | Listener explícito, emparejamiento, permisos y prueba desde otro dispositivo. |
| 4. Recomendación por tarea/equipo | Parcial: reglas, filtros, propuestas y evidencia | Más cobertura y recuperación por falta de memoria; experiencia desde cero. |
| 5. Video, audio y distribución ampliada | Video experimental; paquetes Windows/Linux disponibles | Generación H3 real viable, audio, instalador firmado y pruebas de otras plataformas. |

Hay partes de los hitos 4 y 5 adelantadas, pero eso no cierra el hito 3. La aplicación todavía no está lista para una persona que no tenga un motor utilizable.

## Siguiente prioridad

Cerrar el hito 3: detectar recursos, proponer un modelo de imágenes, buscar y reutilizar ComfyUI si sirve y ofrecer instalación aislada si falta. Una autorización del plan completo, progreso y recuperación dentro de la app. No añadir un LLM para esa selección.

El caso sin motor se prueba en **Veltria-Lab**, con disco en D y datos separados. La instalación habitual de ComfyUI en D se reutiliza, no se reemplaza. [Tarea siguiente](../FIRST-TASK.md), [recorrido](setup.md), [laboratorio](linux-lab.md).

## Límites actuales

- Linux se ha probado en WSL/Xvfb y WSLg; no equivale a Linux nativo. macOS está pendiente.
- H3 detectado no equivale a video generado. Su conjunto grande no está verificado en la GPU de 6 GB.
- SDXL comunitario arbitrario, LoRA SDXL, varios LoRA, refiner, escalado y otras familias siguen fuera del soporte actual.
- Sin instalación automática del motor, LAN, audio, entrenamiento, importación de workflows, cuentas, nube o autoactualizaciones.

Pruebas y alcance exacto en [validation.md](validation.md). El historial de cambios está en Git, no en una cadena de guías por versión.
