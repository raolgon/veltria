# Prototipo visual de Veltria

Abrir `veltria.html` para revisar la referencia Obsidian. [Alcance](../UI-PREVIEW.md), [diseño vigente](../DESIGN.md) y [aplicación real](../README.md).

Fuente en `src/`: Vue/TypeScript, CSS e ilustración propia. Hardware, perfiles, progreso y preparación son escenarios de diseño. No hay motor, servicio ni inferencia; no copiar sus temporizadores como lógica de producto.

El paquete independiente declara `dev`, `typecheck` y `build` en `package.json`. Para trabajar específicamente en esta referencia, desde esta carpeta:

```bash
bun install
bun run dev
# Compilar el HTML autocontenido:
bun run build
```

El build comprueba tipos, ejecuta Vite y `standalone.mjs`. No sustituye las comprobaciones del workspace de producción. No distribuir dependencias de desarrollo con el HTML ni modificar el producto por interpretar datos de ejemplo como requisitos.
