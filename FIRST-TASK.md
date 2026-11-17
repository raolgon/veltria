# Próxima tarea propuesta — recuperación guiada del hito 4

El hito 4 cuenta con reglas por hardware, filtros por intención, evidencia por ajustes y bienvenida con alternativas, pero aún falta la recuperación guiada ante falta de memoria (el error de ejecución actual es genérico). La comparación completa y los criterios están en [docs/milestone-4.md](docs/milestone-4.md).

Leer [PROJECT.md](PROJECT.md), [PHILOSOPHY.md](PHILOSOPHY.md), [ARCHITECTURE.md](ARCHITECTURE.md) y [docs/status.md](docs/status.md). Trabajar en `development`, sin subagentes; conservar motores, datos y cambios. No descargar pesos ni instalar entornos nuevos sin un plan autorizado.

## Siguiente incremento funcional

1. Clasificar los errores reales del motor y conservar el diagnóstico consultable. No atribuir todos los fallos a memoria.
2. Ofrecer una acción concreta para reducir recursos y revisar los nuevos valores, preservando descripción y parámetros originales. Generar de nuevo requiere acción explícita; un envío incierto se reconcilia primero.
3. Probar el recorrido con fallos de memoria y de otra causa, persistencia al recargar y ausencia de reenvíos automáticos. Separar fixtures de pruebas GPU autorizadas.

Después: compartir la prioridad de recomendaciones entre bienvenida y catálogo y ampliar la matriz de equipos/ajustes. Mantener el alcance de modelos admitidos; los filtros por intención no acreditan un recomendador completo por tarea.

## Validación pendiente de los hitos 3 y 3B

El instalador administrado, la bienvenida principal y el uso en red local (LAN) están implementados en 0.10.0. [Instalación administrada](docs/managed-setup.md), [red local](LOCAL-NETWORK.md), [evidencia](docs/validation.md). Continúan abiertos:

1. Probar el acceso LAN desde un segundo dispositivo físico real en la misma red privada y con corte de Internet.
2. Ampliar Windows a otros equipos o a un SO limpio si se quiere certificar ese alcance. La instalación propia completa ya pasó en Windows nativo con entorno/datos separados en D: ([docs/windows-lab.md](docs/windows-lab.md)).
3. Probar el recorrido administrado en Linux nativo y en otros sistemas de archivos. WSL no certifica Linux nativo ([docs/linux-lab.md](docs/linux-lab.md)).
4. Probar con una persona nueva que completa preparación y primera imagen sin terminal, registrando decisiones y dificultades.

Reutilizar contratos, manifiestos fijados y UI Obsidian. Mantener la creación como acción explícita posterior; no añadir LLM, video, audio, workflows arbitrarios ni actualizaciones automáticas a este trabajo.
