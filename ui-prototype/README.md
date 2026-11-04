# Veltria UI prototype

Abrir veltria.html sin instalar nada. Ver ../UI-PREVIEW.md para alcance, cambios y comprobaciones.

Fuente: src/App.vue, src/IdeaArt.vue y src/style.css. Los perfiles, hardware, compatibilidad, progreso e instalación son escenarios de diseño. El producto usará el servicio Bun/Fastify; este prototipo no lo implementa.

Desarrollo previsto con Bun: bun install y bunx --bun vite. La verificación de esta entrega usó Node por disponibilidad del entorno. Los scripts npm de desarrollo son una herramienta de revisión, no un backend Node de producto. Fijar bun.lock al integrar con Bun; no se incluye uno sin haberlo generado.

Build usado en esta entrega: npm run build. Comprueba tipos, compila y genera veltria.html autocontenido. No hay fuentes ni recursos remotos en la vista compilada.

No distribuir node_modules ni los archivos de configuración interna de la vista previa. No convertir temporizadores de ejemplo en lógica de instalación real.
