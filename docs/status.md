# Estado e hitos

Revisado el 20 de noviembre de 2026 contra el código de `development`. Versión de desarrollo **0.10.0**, protocolo **9**, SQLite de trabajos **4**. [Abrir y desarrollar](../README.md).

## Funciona

UI Vue compartida entre navegador, Electron y red local; servicio Bun/Fastify; sesiones locales (`owner`) y remotas (`lan`), SQLite, hardware y monitor de recursos; temas claro/oscuro/sistema con logotipos Kobocraft adaptativos y español/inglés. Modelos, configuraciones y trabajos proceden del servicio, sin datos ficticios de producción.

Imagen: SD 1.5, DreamShaper 8 y SDXL Base; preparación con ComfyUI existente o entorno propio fijado; descarga/verificación, búsqueda compatible, LoRA SD 1.5 admitidos, gestión de archivos, calidad por imagen, limpieza del lienzo, recuperación guiada ante fallos clasificados del motor y biblioteca persistente. SDXL tiene generación GPU Windows comprobada a 768 y 1024 px. Las opciones superiores no quedan certificadas por ello.

Red local (LAN): listener dedicado opcional por interfaz IPv4 privada, código de 6 dígitos y QR SVG generado localmente, aprobación explícita en el equipo principal, rol `lan` con rutas restringidas y revocación inmediata de dispositivos y flujos SSE.

## Hitos

| Hito | Estado | Qué falta |
| --- | --- | --- |
| 1. UI, servicio y equipo real | Implementado y comprobado en Windows/WSL | Validación ampliada en Linux nativo y macOS. |
| 2. Primera imagen y biblioteca | Cumplido en Windows | Más equipos y pruebas GPU en Linux nativo. |
| 3. Preparación administrada | Implementado y validado en Windows aislado y WSL; avisos de espacio, cuota, sólo lectura y permisos con recuperación | Linux nativo; usabilidad con una persona nueva; ampliar equipos y sistemas de archivos. |
| 3B. Uso por LAN | Cumplido en Windows (red privada local) | Ampliar comprobación a Linux nativo/macOS si se desea; el acceso sigue siendo HTTP en red privada. |
| 4. Recomendaciones verificables y recuperación guiada | Código implementado en el alcance actual: reglas por equipo e incertidumbre de RAM, prioridad y etiquetas unificadas entre bienvenida, asistente, catálogo y Crear, clasificación de errores y recuperación guiada por memoria | Validación de usabilidad con una persona nueva y ampliación a otros equipos/plataformas si se desea. [Comparación y aceptación](milestone-4.md). |
| 5. Video, audio y distribución ampliada | Video experimental; paquetes Windows/Linux disponibles | Generación H3 real viable, audio, instalador firmado y pruebas de otras plataformas. |

## Siguiente prioridad

El código del hito 4 (prioridad compartida entre bienvenida/asistente/catálogo, etiquetas coherentes de estimación/disponibilidad/comprobación y matriz ampliada de pruebas con fixtures) quedó implementado. [Requisitos y detalle](milestone-4.md), [tarea siguiente](../FIRST-TASK.md).

La validación física del hito 3B (LAN desde segundo dispositivo físico en Wi-Fi privada, con emparejamiento, creación/consulta bajo rol `lan`, corte de Internet y revocación) quedó comprobada en Windows el 20 de noviembre de 2026. Permanecen abiertas la validación en Linux nativo y la prueba de usabilidad con una persona nueva. El recorrido administrado completo ya pasó en Windows nativo con entorno/datos separados y en WSL, incluida generación CUDA, recuperación tras cierres forzados y comprobación ACL real en Windows. [Implementación y evidencia](managed-setup.md), [validación](validation.md).

## Límites actuales

- Linux se ha probado en WSL/Xvfb y WSLg; no equivale a Linux nativo. macOS está pendiente.
- LAN escucha por HTTP en la interfaz privada elegida; en WSL2 advierte que conectar desde otro dispositivo físico sin reenvío de puertos requiere iniciar Kobocraft en Windows.
- H3 detectado no equivale a video generado. Su conjunto grande no está verificado en la GPU de 6 GB.
- SDXL comunitario arbitrario, LoRA SDXL, varios LoRA, refiner, escalado y otras familias siguen fuera del soporte actual.
- Instalación administrada limitada a Windows/Linux x64 con NVIDIA y recetas fijadas. Sin audio, entrenamiento, importación de workflows, cuentas, nube o autoactualizaciones.

Pruebas y alcance exacto en [validation.md](validation.md). El historial de cambios está en Git.
