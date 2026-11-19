# Hito 4 · recomendaciones verificables y recuperación guiada

Revisión del 19 de noviembre de 2026, desarrollo 0.10.0. **Estado: avanzado (parcial).** Comparación documental y de código; no constituye una nueva prueba GPU ni certifica equipos adicionales.

El alcance combina «recomendaciones verificables y recuperación guiada» con [PHILOSOPHY.md](../PHILOSOPHY.md), los límites de [modelos](models.md) y [calidad](image-quality.md). No incorpora un LLM, entrenamiento ni soporte de modelos arbitrarios.

## Requisitos frente a la implementación

| Criterio | Qué tenemos | Estado y falta concreta |
| --- | --- | --- |
| Recomendar según el equipo real | `recommendImage` usa plataforma, NVIDIA, VRAM y RAM; distingue recomendado, limitado, desconocido y no admitido. SDXL tiene otra regla. | Parcial: ampliar casos de hardware admitidos y memoria disponible; hoy son umbrales conservadores por familia, no un presupuesto de memoria por ajuste. AMD, Intel, CPU y macOS no tienen recorrido de inferencia validado. |
| Ofrecer un inicio comprensible | Bienvenida principal (`WelcomeSetup.vue`) con modelo, alternativa, motivo y otros modelos; preparación integrada y editor bloqueado hasta contar con vínculo y al menos un modelo preparado. | Implementado para el catálogo actual. Pendiente prueba de usabilidad documentada con una persona nueva. |
| Ayudar según la tarea creativa | Catálogo con búsqueda por texto e intención (fotografía, ilustración, anime, personajes), especialidades acotadas y exploración compatible. No altera el prompt. | Parcial: las categorías ayudan a buscar; no son un recomendador completo que derive una receta/ajustes por tarea. La bienvenida aún ordena sólo por nivel de compatibilidad. |
| Distinguir estimación, disponibilidad y comprobación | Catálogo separa archivos ausentes, parciales, descargados y preparados; evidencia de generación ligada a equipo, configuración y dimensiones. Crear contrasta dimensiones, pasos y CFG. | Implementado en el alcance actual. Ampliar la matriz de equipos/ajustes y verificar consistencia de etiquetas entre bienvenida, catálogo y Crear. |
| Priorizar opciones útiles sin afirmar calidad universal | `localPriority` en `catalog-guidance.ts` prioriza ejecución comprobada y archivos preparados/descargados; popularidad es una ordenación aparte. | Implementado en el catálogo; pendiente compartir ese mismo criterio con `WelcomeSetup.vue`. |
| Proponer ajustes viables y explicar sus límites | Resolución inicial por familia, opciones de tamaño/esfuerzo, ajustes manuales validados, aviso al superar el punto de partida y reducción propuesta tras OOM (`reduceImageQuality`). | Parcial: no hay presupuesto preventivo de memoria por resolución antes de ejecutar. Más pasos no equivalen a más calidad. |
| Recuperar un fallo de memoria dentro de la app | `classifyJobFailure` clasifica `memory`, `incompatible`, `engine-unavailable` y `execution` conservando nodo y traza consultable; `reduceImageQuality` propone ajustes reducidos revisables en `CreationStudio.vue` sin reenviar automáticamente, y ofrece cambiar modelo o revisar el motor según causa. | Implementado y cubierto por pruebas unitarias (`tests/image-quality.test.ts`), integración (`tests/creation.bun.ts`) y E2E con recarga (`tests/creation.e2e.ts`). Pendiente validación de usabilidad con una persona nueva. |
| Evitar duplicados al recuperar | Identificador persistido antes del envío; estado incierto se reconcilia y no se reenvía automáticamente. El nuevo intento exige acción explícita y tiene identidad propia. | Implementado. |

## Evidencia y fuentes

- Reglas, clasificación de fallos y reducción de ajustes: `packages/core/src/image-profile.ts`, `packages/core/src/model-catalog.ts`.
- Ordenación, bienvenida y recuperación en UI: `apps/ui/src/catalog-guidance.ts`, `ModelCatalog.vue`, `WelcomeSetup.vue`, `ImageQualityControls.vue`, `CreationStudio.vue`.
- Evidencia, idempotencia, persistencia de `failure` y reconciliación: `apps/local-service/src/creation.ts`, `creation-store.ts`.
- Cobertura automatizada: `tests/catalog-guidance.test.ts`, `tests/sdxl.test.ts`, `tests/image-quality.test.ts`, `tests/discovery.test.ts`, `tests/creation.bun.ts`, `tests/creation.e2e.ts`, `tests/setup.e2e.ts` y `tests/progress.e2e.ts`. Ver [validación](validation.md) para distinguir fixtures e inferencia real.
- Inferencia real registrada: SD 1.5, DreamShaper y LoRA SD 1.5 en Windows; SDXL a 768 y 1024 px en Windows; SD 1.5 con entorno propio en Windows nativo aislado y WSL. No es una comparación de calidad entre modelos.

## Trabajo pendiente para cerrarlo

1. Compartir las reglas de prioridad (`localPriority`) entre bienvenida y catálogo: compatibilidad, evidencia aplicable y disponibilidad local, explicando la opción principal y la alternativa sin confundir especialidad, popularidad y calidad.
2. Comprobar coherencia de etiquetas de estimación, disponibilidad y comprobación entre bienvenida, catálogo y Crear al cambiar modelo, formato o configuración.
3. Ampliar la matriz de casos de recursos y ajustes (recursos mínimos, poca memoria disponible, hardware desconocido, SDXL fuera de mínimos y modelos ya preparados), registrando incertidumbre cuando falte información.
4. Comprobar el recorrido con una persona nueva: entender la recomendación, elegir otra opción, recuperarse de un fallo confirmado y volver a crear expresamente, sin terminal.

Los pendientes de Linux nativo, otros equipos/condiciones de almacenamiento y usabilidad del hito 3, así como la prueba física del hito 3B (LAN), siguen abiertos en [estado](status.md). Video y audio conservan su hito independiente.
