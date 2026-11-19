# Próxima tarea propuesta — unificación de recomendaciones del hito 4

El hito 4 ya cuenta con reglas por hardware, filtros por intención, evidencia por ajustes, bienvenida con alternativas y recuperación guiada con clasificación de errores del motor (`memory`, `incompatible`, `engine-unavailable`, `execution`). Lo pendiente en código para cerrar el hito está detallado en [docs/milestone-4.md](docs/milestone-4.md).

Leer [PROJECT.md](PROJECT.md), [PHILOSOPHY.md](PHILOSOPHY.md), [ARCHITECTURE.md](ARCHITECTURE.md) y [docs/status.md](docs/status.md). Trabajar en `development`, sin subagentes; conservar motores, datos y cambios. No descargar pesos ni instalar entornos nuevos sin un plan autorizado.

## Siguiente incremento funcional

1. Compartir la prioridad de recomendaciones (`localPriority` en `apps/ui/src/catalog-guidance.ts`) entre el catálogo y la bienvenida (`apps/ui/src/WelcomeSetup.vue`), de modo que ambos prioricen compatibilidad, evidencia aplicable y disponibilidad local sin confundir especialidad, popularidad y calidad.
2. Verificar coherencia de etiquetas de estimación, disponibilidad y comprobación entre bienvenida, catálogo y Crear al cambiar de modelo, formato o configuración.
3. Ampliar la matriz de pruebas de recursos y ajustes (recursos mínimos, poca memoria disponible, hardware desconocido, SDXL fuera de mínimos, modelos ya preparados y recuperación tras recargar), manteniendo separadas las fixtures de cualquier prueba GPU autorizada.

Mantener el alcance actual de modelos admitidos; los filtros por intención no acreditan un recomendador completo por tarea.

## Validación física pendiente de hitos 3, 3B y 4

El instalador administrado, la bienvenida principal, el uso en red local (LAN) y la recuperación guiada están implementados en 0.10.0. [Instalación administrada](docs/managed-setup.md), [red local](LOCAL-NETWORK.md), [evidencia](docs/validation.md). Continúan abiertos:

1. Probar el acceso LAN desde un segundo dispositivo físico real en la misma red privada y con corte de Internet.
2. Probar el recorrido administrado y los paquetes en Linux nativo (WSL no certifica Linux nativo) y en otros equipos/SO limpios si se desea ampliar el alcance certificado.
3. Probar con una persona nueva que completa preparación, primera imagen y recuperación ante fallo sin terminal, registrando decisiones y dificultades.

Reutilizar contratos, manifiestos fijados y UI Obsidian. Mantener la creación como acción explícita posterior; no añadir LLM, video, audio, workflows arbitrarios ni actualizaciones automáticas a este trabajo.
