# Próxima tarea propuesta — recuperación guiada del hito 4

La revisión del hito 4 confirma reglas, filtros, evidencia y bienvenida con alternativas, pero no recuperación guiada ante falta de memoria. El error de ejecución actual es genérico. La comparación completa y los criterios están en [docs/milestone-4.md](docs/milestone-4.md). Esta revisión documental no implementó esas funciones.

Leer PROJECT.md, PHILOSOPHY.md, ARCHITECTURE.md y docs/status.md. Trabajar en `development`, sin subagentes; conservar motores, datos y cambios. No descargar pesos ni instalar entornos nuevos sin un plan autorizado.

## Siguiente incremento funcional

1. Clasificar los errores reales del motor y conservar el diagnóstico consultable. No atribuir todos los fallos a memoria.
2. Ofrecer una acción concreta para reducir recursos y revisar los nuevos valores, preservando descripción y parámetros originales. Generar de nuevo requiere acción explícita; un envío incierto se reconcilia primero.
3. Probar el recorrido con fallos de memoria y de otra causa, persistencia al recargar y ausencia de reenvíos automáticos. Separar fixtures de pruebas GPU autorizadas.

Después: compartir la prioridad de recomendaciones entre bienvenida y catálogo y ampliar la matriz de equipos/ajustes. Mantener el alcance de modelos admitidos; los filtros por intención no acreditan un recomendador completo por tarea.

## Validación pendiente del hito 3

El instalador administrado y la bienvenida principal están implementados en 0.10.0. La instalación desde cero, pausa/reapertura, inferencia SD 1.5 y biblioteca persistente pasaron en Veltria-Lab/WSL. [Implementación](docs/managed-setup.md), [evidencia](docs/validation.md). Continúan abiertos:

1. Ampliar Windows a otros equipos o a un SO limpio si se quiere certificar ese alcance. La instalación propia completa ya pasó en Windows nativo con entorno/datos separados en D:, alcance elegido por el usuario, incluyendo CUDA, cierres forzados y biblioteca tras reiniciar. No se modificaron los motores habituales. [Prueba y límites](docs/windows-lab.md).
2. Probar el recorrido en Linux nativo. WSL no certifica esa plataforma.
3. Ampliar recuperación en Linux nativo y otros sistemas de archivos. Ya pasaron cierres forzados reales en WSL/Windows, continuación e imagen GPU con biblioteca tras reiniciar. Almacenamiento distingue aviso preventivo y bloqueo, cuota, sólo lectura y permisos; hay prueba ACL real Windows, denegación real WSL y recuperación tras cambiar carpeta sin reutilizar consentimiento. No se agotó el disco del usuario; cuotas y sólo lectura se inyectaron. [Evidencia y límites](docs/validation.md).
4. Probar con una persona nueva que completa preparación y primera imagen sin terminal, registrando decisiones y dificultades.

Reutilizar contratos, manifiestos fijados y UI Obsidian. Mantener la creación como acción explícita posterior; no añadir LLM, video, audio, LAN, workflows arbitrarios ni actualizaciones automáticas a este trabajo.

Veltria-Lab conserva los entornos y resultados. El 10 de noviembre se retiraron sus dos copias anteriores de pesos por solicitud del usuario; después, la aceptación autorizada descargó SD 1.5 en `/home/veltria/lab/acceptance-hito3-20261110`, separado de la prueba manual `/home/veltria/lab/welcome3-20261109/manual-data`. La copia 0.9 es histórica. No volver a descargar pesos sin un plan autorizado ni presentar fixtures como inferencia.
