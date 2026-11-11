# Prototipo de referencia

`ui-prototype/veltria.html` permite revisar el diseño sin instalar herramientas. Su fuente Vue está en `ui-prototype/src`. Se conserva como referencia; la aplicación real y sus estados están en `apps/` y `packages/`.

El prototipo contiene escenarios de hardware, modelos, compatibilidad, preparación, LoRA y progreso **ilustrativos**. Sus temporizadores, cifras y controles no acreditan descarga, instalación, generación ni acceso LAN. No distribuirlo como producto ni trasladar sus simulaciones al servicio.

La UI de producción ya dispone de hardware real, sesiones, preparación de pesos con ComfyUI existente, generación, biblioteca, modelos, calidad, temas e idiomas. Su estado vigente está en [docs/status.md](docs/status.md), no en las pantallas del prototipo.

Usar la composición y recursos de referencia cuando encajen con [DESIGN.md](DESIGN.md), [MOBILE-UI.md](MOBILE-UI.md) y [PHILOSOPHY.md](PHILOSOPHY.md). Los nombres de perfiles y parámetros del prototipo no son un catálogo aprobado. La instalación administrada se implementa en la app real, no en este prototipo; LAN sigue pendiente.

Para revisar o construir ese prototipo por separado, ver [su README](ui-prototype/README.md). La fuente vigente del producto conserva un único lockfile en la raíz; el prototipo no es otro backend ni otra aplicación de inferencia.
