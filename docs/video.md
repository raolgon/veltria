# Video experimental

Crear → Video reutiliza MiniMax H3 y componentes existentes en el ComfyUI vinculado. El plan muestra archivos, recursos, espacio, licencia y límites; exige aceptar el perfil experimental. No descarga pesos H3 ni instala otro motor. Preparar comprueba el entorno/nodos; crear es una acción posterior.

| Ajuste | Resolución | Fotogramas | FPS | Duración aproximada |
| --- | --- | --- | --- | --- |
| Vista previa | 448 × 256 | 22 | 24 | 0,92 s |
| Clip corto | 448 × 256 | 124 | 24 | 5,17 s |

El clip corto requiere una vista previa terminada con el mismo entorno/receta/componentes. La vista previa no representa calidad final. La receta incluida usa nodos estándar H3, decodificación de video/audio y `CreateVideo`/`SaveVideo` a H.264/MP4; no importa ni ejecuta workflows externos. Componentes y receta concretos en `packages/core/src/video-profile.ts`.

El servicio ejecuta un proceso propio con nodos personalizados desactivados, controla el progreso y conserva IDs para reconciliar envíos inciertos. Imagen y video no se ejecutan simultáneamente. Cancelación por trabajo propio, sin interrupción global del motor externo.

Los MP4 se transfieren a temporales, tienen límite de 256 MiB y se validan mediante PyAV existente: codec, dimensiones, duración, FPS y fotogramas. Se conservan fuera del motor con SHA-256 del resultado y metadatos en SQLite. La biblioteca permite reproducir, guardar y reutilizar descripciones; el servicio admite rangos HTTP. Navegador descarga y Electron prepara el diálogo nativo.

## Estado real

En esta PC se detectaron cuatro componentes existentes del perfil grande, aproximadamente 42,47 GB. Se comprobaron cabeceras/tamaños y el esquema real de nodos, **no una generación H3 completa ni el hash íntegro de todos esos pesos**. La RTX 4050 de 6 GB y 16 GB de RAM no tiene ejecución H3 certificada.

La configuración de referencia para 6 GB encontrada en D pide variantes distintas que no están presentes. Su nombre no demuestra compatibilidad; no se sustituyen ni descargan automáticamente esos archivos.

Las pruebas de MP4 y recorridos con fixtures comprueban integración, no inferencia H3. Quedan pendientes una receta de video viable y comprobada para este equipo, descarga administrada de sus componentes, imagen a video, otros modelos y macOS. [Validación](validation.md), [estado de hitos](status.md).
