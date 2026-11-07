# Próxima tarea — cerrar el hito 3

Alcance del próximo desarrollo de Veltria. Su ejecución requiere la petición de trabajo correspondiente.

Leer [PROJECT.md](PROJECT.md), [PHILOSOPHY.md](PHILOSOPHY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [estado](docs/status.md), [preparación](docs/setup.md) y [laboratorio Linux](docs/linux-lab.md). Inspeccionar el código existente y conservar datos y cambios. Trabajar en `development`, sin subagentes.

## Objetivo

Una persona sin ComfyUI puede preparar un primer modelo de imagen desde Veltria sin conocer Python, puertos, nodos o carpetas. Si ya existe ComfyUI utilizable, Veltria lo detecta y reutiliza. No instalar otro motor en esta PC por defecto.

## Trabajo pendiente

1. Detectar hardware y proponer un modelo/configuración admitidos; distinguir el equipo Linux/WSL del host Windows.
2. Mantener la búsqueda acotada y comprobación de instalaciones existentes.
3. Si falta una utilizable, construir un plan real para un entorno administrado, aislado y versionado: fuentes, integridad, dependencias, licencia, descargas, espacio y ubicación.
4. Tras autorizar ese plan, instalar y configurar desde el servicio Bun, sin shell genérica ni código de metadatos. UI compartida con progreso real.
5. Persistir la operación y recuperar interrupciones, falta de espacio y fallos sin perder modelos, configuraciones o creaciones. Un plan cambiado materialmente requiere nueva revisión.
6. Verificar disponibilidad del motor y perfil antes de habilitar Crear. La generación es una acción explícita posterior.

## Validación y límites

Usar `Veltria-Lab` en D para el caso sin motor, con datos de prueba separados. Reutilizar la instalación de D para comprobar que no se duplica ni modifica. Windows y Linux primero; no declarar soporte macOS sin probarlo.

Comprobar falta/presencia de motor, espacio insuficiente, error/reanudación, reapertura, cambio de plan, creación explícita y biblioteca persistente. Separar fixtures, transferencia real e inferencia GPU. Documentar cualquier descarga grande o permiso que necesite decisión del usuario antes de ejecutarlo.

No ampliar este trabajo a LLM, video, audio, LAN, workflows arbitrarios o actualizaciones automáticas. Conservar la UI Obsidian, idiomas, ajustes de calidad y los contratos existentes; evolucionarlos sólo cuando el instalador lo necesite.
