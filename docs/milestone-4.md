# Hito 4 · recomendaciones verificables y recuperación guiada

Revisión del 19 de noviembre de 2026, desarrollo 0.10.0. **Estado: avanzado (parcial).** Comparación documental y de código; no constituye una nueva prueba GPU ni certifica equipos adicionales.

El alcance combina «recomendaciones verificables y recuperación guiada» con [PHILOSOPHY.md](../PHILOSOPHY.md), los límites de [modelos](models.md) y [calidad](image-quality.md). No incorpora un LLM, entrenamiento ni soporte de modelos arbitrarios.

## Requisitos frente a la implementación

| Criterio | Qué tenemos | Estado y falta concreta |
| --- | --- | --- |
| Recomendar según el equipo real | `recommendImage` usa plataforma, NVIDIA, VRAM y RAM; distingue recomendado, limitado (poca memoria libre, RAM libre sin leer o SDXL con sus variantes de memoria libre sin confirmar / limitada), desconocido (sin GPU NVIDIA, VRAM o RAM total sin confirmar) y no admitido. El plan de video (`video.ts`) y el monitor de recursos (`ResourceMonitor.vue`) también distinguen RAM/VRAM sin lectura frente a hardware insuficiente. | Parcial: hoy son umbrales conservadores por familia, no un presupuesto de memoria por ajuste. AMD, Intel, CPU y macOS no tienen recorrido de inferencia validado. |
| Ofrecer un inicio comprensible | Bienvenida principal (`WelcomeSetup.vue`) con modelo principal, alternativa, motivo, disponibilidad local y otros modelos ordenados con el mismo criterio del catálogo; preparación integrada y editor bloqueado hasta contar con vínculo y al menos un modelo preparado. | Implementado para el catálogo actual. Pendiente prueba de usabilidad documentada con una persona nueva. |
| Ayudar según la tarea creativa | Catálogo con búsqueda por texto e intención (fotografía, ilustración, anime, personajes), especialidades acotadas y exploración compatible. No altera el prompt. | Parcial: las categorías ayudan a buscar; no son un recomendador completo que derive una receta/ajustes por tarea. |
| Distinguir estimación, disponibilidad y comprobación | `catalog-guidance.ts` unifica etiquetas de disponibilidad (`Sin descargar`, `Descarga parcial`, `Descargado · falta comprobar`, `Preparación en curso`, `Preparado para crear`), estimación/incertidumbre y ejecución comprobada entre bienvenida (`WelcomeSetup.vue`), asistente y propuesta (`SetupWizard.vue`), catálogo local y resultados remotos (`ModelCatalog.vue`) y Crear (`CreationStudio.vue`) en español e inglés. | Implementado y cubierto por matriz de fixtures (`tests/catalog-guidance.test.ts`, `tests/sdxl.test.ts`, `tests/localization.test.ts`, `tests/video.bun.ts`, `tests/setup.e2e.ts`). |
| Priorizar opciones útiles sin afirmar calidad universal | `compareLocalModels`, `rankWelcomeModels` y `selectWelcomeModels` en `catalog-guidance.ts` comparten prioridad entre catálogo, bienvenida y asistente: ejecución comprobada > preparado > descargado > parcial > ausente, desempatando por compatibilidad (`recommended` > `limited` > `unknown` > `unsupported`), sin promover opciones no admitidas ni confundir popularidad con calidad. | Implementado en catálogo, bienvenida y asistente. |
| Proponer ajustes viables y explicar sus límites | Resolución inicial por familia, opciones de tamaño/esfuerzo, ajustes manuales validados, aviso al superar el punto de partida y reducción propuesta tras OOM (`reduceImageQuality`). | Parcial: no hay presupuesto preventivo de memoria por resolución antes de ejecutar. Más pasos no equivalen a más calidad. |
| Recuperar un fallo de memoria dentro de la app | `classifyJobFailure` clasifica `memory`, `incompatible`, `engine-unavailable` y `execution` conservando nodo y traza consultable; `reduceImageQuality` propone ajustes reducidos revisables en `CreationStudio.vue` sin reenviar automáticamente, y ofrece cambiar modelo o revisar el motor según causa. | Implementado y cubierto por pruebas unitarias (`tests/image-quality.test.ts`), integración (`tests/creation.bun.ts`) y E2E con recarga (`tests/creation.e2e.ts`). Pendiente validación de usabilidad con una persona nueva. |
| Evitar duplicados al recuperar | Identificador persistido antes del envío; estado incierto se reconcilia y no se reenvía automáticamente. El nuevo intento exige acción explícita y tiene identidad propia. | Implementado. |

## Evidencia y fuentes

- Reglas, incertidumbre de RAM/VRAM, clasificación de fallos y reducción de ajustes: `packages/core/src/image-profile.ts`, `packages/core/src/model-catalog.ts`, `packages/core/src/english.ts`, `apps/local-service/src/video.ts`.
- Prioridad compartida, etiquetas unificadas, bienvenida, recursos y recuperación en UI: `apps/ui/src/catalog-guidance.ts`, `ModelCatalog.vue`, `WelcomeSetup.vue`, `SetupWizard.vue`, `ImageQualityControls.vue`, `CreationStudio.vue`, `ResourceMonitor.vue`.
- Evidencia, idempotencia, persistencia de `failure` y reconciliación: `apps/local-service/src/creation.ts`, `creation-store.ts`.
- Cobertura automatizada (fixtures separadas de inferencia GPU): `tests/catalog-guidance.test.ts`, `tests/sdxl.test.ts`, `tests/localization.test.ts`, `tests/image-quality.test.ts`, `tests/discovery.test.ts`, `tests/creation.bun.ts`, `tests/video.bun.ts`, `tests/creation.e2e.ts`, `tests/setup.e2e.ts` y `tests/progress.e2e.ts`. Ver [validación](validation.md) para distinguir fixtures e inferencia real.
- Inferencia real registrada: SD 1.5, DreamShaper y LoRA SD 1.5 en Windows; SDXL a 768 y 1024 px en Windows; SD 1.5 con entorno propio en Windows nativo aislado y WSL. No es una comparación de calidad entre modelos.

## Trabajo pendiente para cerrarlo

El trabajo de código de este incremento del hito 4 (prioridad compartida entre bienvenida/asistente/catálogo, coherencia de etiquetas en ES/EN y matriz ampliada de fixtures de recursos e incertidumbre) está implementado. Queda abierto para el cierre completo:

1. Comprobar el recorrido con una persona nueva: entender la recomendación, elegir otra opción, recuperarse de un fallo confirmado y volver a crear expresamente, sin terminal.
2. Si se amplía el soporte más allá de Windows/Linux x64 con NVIDIA, validar esos equipos/plataformas reales (AMD, Intel, CPU, macOS) antes de habilitarlos.

Los pendientes de Linux nativo, otros equipos/condiciones de almacenamiento y usabilidad del hito 3 siguen abiertos en [estado](status.md); la validación física en Windows del hito 3B (LAN) quedó registrada el 20 de noviembre de 2026. Video y audio conservan su hito independiente.
