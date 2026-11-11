# Hito 4 · recomendaciones verificables y recuperación guiada

Revisión del 10 de noviembre de 2026, desarrollo 0.10.0. **Estado: parcial.** Comparación documental y de código; no constituye una nueva prueba GPU ni certifica equipos adicionales.

El alcance original es «recomendaciones verificables y recuperación guiada» (arquitectura anterior a la consolidación, commit `96828c1^`). Los criterios siguientes consolidan ese alcance con [PHILOSOPHY.md](../PHILOSOPHY.md), los límites de [modelos](models.md) y [calidad](image-quality.md). No incorporan un LLM, entrenamiento ni soporte de modelos arbitrarios.

## Requisitos frente a la implementación

| Criterio | Qué tenemos | Estado y falta concreta |
| --- | --- | --- |
| Recomendar según el equipo real | `recommendImage` usa plataforma, NVIDIA, VRAM y RAM; distingue recomendado, limitado, desconocido y no admitido. SDXL tiene otra regla. | Parcial: ampliar casos de hardware admitidos y memoria disponible; hoy son umbrales conservadores por familia, no una estimación del consumo para cada ajuste. AMD, Intel, CPU y macOS no tienen un recorrido de inferencia validado. No prometer dos opciones viables en cualquier equipo. |
| Ofrecer un inicio comprensible | Bienvenida principal con modelo, alternativa, motivo y otros modelos; preparación integrada y editor bloqueado hasta contar con vínculo y al menos un modelo preparado. | Implementado para el catálogo actual. Se comprobó en Veltria-Lab; la aprobación informal del usuario no sustituye una prueba de usabilidad documentada con una persona nueva. |
| Ayudar según la tarea creativa | Catálogo con búsqueda por texto e intención (fotografía, ilustración, anime, personajes), especialidades acotadas y exploración compatible. No altera el prompt. | Parcial: las categorías ayudan a buscar; no son un recomendador que derive de la intención una combinación de modelo, receta y ajustes respaldada por resultados. La bienvenida ordena por nivel de compatibilidad, sin reutilizar toda la prioridad del catálogo. |
| Distinguir estimación, disponibilidad y comprobación | Catálogo separa archivos ausentes, parciales, descargados y preparados; evidencia de generación ligada al equipo/configuración y dimensiones. Crear contrasta dimensiones, pasos y CFG. | Implementado en el alcance actual. Ampliar la matriz de equipos/ajustes y comprobar la consistencia de estas etiquetas entre bienvenida, catálogo y Crear. Un PNG de prueba o una descarga no certifican inferencia. |
| Priorizar opciones útiles sin afirmar calidad universal | `localPriority` prioriza ejecución comprobada y archivos preparados/descargados; popularidad es otra ordenación. Se muestran ajustes iniciales. | Implementado en el catálogo; pendiente compartir ese criterio con la bienvenida. Las especialidades comunitarias no se deducen del nombre del modelo. |
| Proponer ajustes viables y explicar sus límites | Resolución inicial por familia, opciones de tamaño/esfuerzo, ajustes manuales validados y aviso al superar el punto de partida. | Parcial: no hay presupuesto de memoria por resolución ni una propuesta correctiva calculada después de un fallo. Más pasos no equivalen a más calidad. |
| Recuperar un fallo de memoria dentro de la app | Descripción y ajustes conservados, controles manuales, restablecer ajustes y selección de otro modelo. El trabajo guarda sus parámetros reales. | Pendiente la recuperación guiada: clasificar el fallo real y ofrecer acciones concretas, como volver al tamaño inicial o elegir una opción menos exigente. Hoy cualquier error de ejecución del historial termina en un mensaje general de revisar memoria. |
| Evitar duplicados al recuperar | Identificador persistido antes del envío; estado incierto se reconcilia y no se reenvía automáticamente. | Implementado. Toda propuesta de recuperación debe conservar esa garantía y exigir una nueva acción explícita para generar. |

## Evidencia y fuentes

- Reglas y límites: `packages/core/src/image-profile.ts`, `packages/core/src/model-catalog.ts`.
- Ordenación y etiquetas: `apps/ui/src/catalog-guidance.ts`, `ModelCatalog.vue`, `WelcomeSetup.vue`, `ImageQualityControls.vue`, `CreationStudio.vue`.
- Evidencia, idempotencia y tratamiento actual del error: `apps/local-service/src/creation.ts`, `creation-store.ts`.
- Cobertura existente: `tests/catalog-guidance.test.ts`, `sdxl.test.ts`, `image-quality.test.ts`, `discovery.test.ts`, `creation.bun.ts` y los recorridos de bienvenida/progreso. Ver [validación](validation.md) para distinguir fixtures e inferencia real.
- Inferencia registrada: SD 1.5, DreamShaper y LoRA SD 1.5 en Windows; SDXL a 768 y 1024 px en Windows; SD 1.5 con entorno propio en Veltria-Lab/WSL. No es una comparación de calidad entre modelos.

## Trabajo para cerrarlo

1. Clasificar errores de ejecución con información del motor: memoria agotada, incompatibilidad, motor no disponible y otros fallos. Conservar el diagnóstico técnico consultable; no llamar OOM a todos los errores.
2. Añadir recuperación con acciones concretas y parámetros revisables. Conservar la descripción y los datos del trabajo fallido; no reducir ajustes ni reenviar silenciosamente. Ante envío incierto, reconciliar primero.
3. Compartir reglas de propuesta entre bienvenida y catálogo: compatibilidad, evidencia aplicable y disponibilidad local. Explicar la opción principal y la alternativa sin confundir especialidad, popularidad y calidad.
4. Ampliar casos de recursos y ajustes, con resultados por equipo/plataforma. Registrar incertidumbre cuando falte información; no habilitar otra familia o plataforma sólo por añadirla al catálogo.
5. Comprobar el recorrido con una persona nueva: entender la recomendación, elegir otra opción, recuperarse de un fallo confirmado y volver a crear expresamente, sin terminal.

## Aceptación pendiente

- Un fallo confirmado de memoria ofrece una reducción concreta y muestra los nuevos valores antes de crear. El usuario puede conservar sus ajustes o elegir otro modelo.
- Un fallo ajeno a memoria no recibe una explicación de OOM. Un envío incierto ofrece reconciliación y no una repetición automática.
- Descripción, semilla y parámetros del trabajo original permanecen consultables; el nuevo intento tiene identidad propia.
- Cambiar modelo, formato o configuración revalida límites y evidencia; los datos desconocidos no aparecen como comprobados.
- Las pruebas incluyen recursos mínimos, poca memoria disponible, hardware desconocido, SDXL fuera de mínimos, modelos ya preparados y recuperación tras recargar; los casos GPU reales requieren autorización concreta.

Los pendientes de Linux nativo, otros equipos/condiciones de almacenamiento y usabilidad del hito 3 siguen abiertos en [estado](status.md). El recorrido completo y la recuperación abrupta ya pasaron en WSL y Windows nativo con entorno/datos separados; eso no certifica una VM o un SO limpio. LAN y video/audio conservan sus hitos independientes.
