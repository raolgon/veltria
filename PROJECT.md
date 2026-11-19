# Kobocraft — decisiones vigentes

Actualizado el 19 de noviembre de 2026. Nombre de la aplicación: **Kobocraft** (los paquetes, variables y rutas internas conservan el identificador técnico `veltria`). Identidad visual: **Obsidian** con logotipos adaptables al tema. Código en `apps/` y `packages/`; rama de trabajo `development`. [Estado de hitos](docs/status.md).

## Producto

La persona decide qué crear y Kobocraft hace la preparación pesada. El recorrido desde cero es:

1. Detectar recursos reales y proponer un **modelo de imágenes**, sus componentes y ajustes viables.
2. Buscar ComfyUI en ubicaciones acotadas y comprobar si una instalación existente puede reutilizarse.
3. Si falta una instalación utilizable, ofrecer un entorno propio, aislado y versionado.
4. Mostrar descarga, espacio, ubicación, licencias y cambios; autorizar el conjunto una vez.
5. Ejecutar preparación y verificación con progreso real y recuperación. Crear es una acción posterior.

No exigir conocimientos de Python, CUDA, nodos, puertos o rutas de pesos. Los detalles avanzados permanecen accesibles. La instalación administrada está implementada para Windows/Linux x64 con NVIDIA; [receta y validación](docs/managed-setup.md).

«Modelo» se refiere aquí al generador de imágenes. No se requiere un LLM adicional para recomendarlo ni para modificar las descripciones. Recomendaciones mediante reglas y evidencia local; no filtrar la intención creativa por categorías arbitrarias.

## Stack y fronteras

Vue 3 + TypeScript + Vite para una UI compartida; Electron para escritorio; Bun + Fastify como servicio local independiente; SQLite mediante `bun:sqlite`. Un único `bun.lock` para el producto. Electron conserva su Node interno; el servicio se compila con Bun y se ejecuta fuera de ASAR mediante `spawn` y `shell:false`.

Toda la inferencia es local mediante ComfyUI. No añadir otro backend, Docker como requisito de producto, cuentas, telemetría o inferencia en la nube. El navegador y los clientes en red local consultan el hardware del servicio, sin atribuir su GPU al dispositivo cliente. Windows y Linux primero; WSL y Linux nativo se distinguen. macOS no está certificado.

## Modelos y datos

Distinguir modelo, archivo/variante, receta y configuración. El catálogo admite tres modelos incluidos y descubrimiento acotado de checkpoints/finetunes y LoRA SD 1.5, más el SDXL oficial fijado. Descargar no equivale a preparar ni a comprobar ejecución. No prometer soporte de cualquier safetensors o workflow.

Usar fuentes/revisiones fijadas, comprobación de espacio y SHA-256. No ejecutar instrucciones de metadatos ni instalar nodos arbitrarios. Mantener modelos y resultados fuera del paquete, preservar parciales y componentes compartidos. Las configuraciones y ajustes reales de cada trabajo se conservan en SQLite.

Equipo de referencia comprobado: Ryzen 5 7535HS, RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM. No convertirlo en una constante de producto ni extrapolar sus resultados a otros equipos. Cada recomendación explica recursos, incertidumbre y alcance de la evidencia.

## Experiencia y alcance

Crear, Modelos, Biblioteca, Mi equipo y Ajustes; español/inglés; temas sistema/claro/oscuro; controles avanzados desplegables. Mantener Obsidian y la adaptación móvil. Mostrar sólo estados respaldados por el servicio. [PHILOSOPHY.md](PHILOSOPHY.md) define la aceptación de la experiencia.

- **Hito 3 (instalación administrada y bienvenida):** implementado y comprobado en Windows nativo aislado y WSL; falta aceptación en Linux nativo y prueba de usabilidad.
- **Hito 3B (red local / LAN):** implementado con emparejamiento por código/QR y permisos acotados según [LOCAL-NETWORK.md](LOCAL-NETWORK.md); falta probarlo desde un segundo dispositivo físico.
- **Hito 4 (recomendaciones verificables y recuperación guiada):** clasificación de errores del motor y recuperación guiada por memoria implementadas; falta unificar la prioridad de recomendación entre bienvenida y catálogo, ampliar casos de recursos/ajustes y completar validación. [Comparación y criterios](docs/milestone-4.md).
- Audio, entrenamiento, workflows arbitrarios, nube y actualizaciones automáticas no están implementados.

## Trabajo y validación

Trabajar sin subagentes y conservar cambios, datos y motores existentes. Mantener `development`; no publicar ni fusionar a `main` como efecto de un build. No descargar pesos ni instalar componentes sin que estén incluidos en una autorización concreta.

Verificar comportamientos bajo sus runtimes reales y en paquetes. Una fixture no es inferencia; una compilación cruzada no certifica la plataforma; WSL no es Linux nativo. Registrar pruebas y límites en [docs/validation.md](docs/validation.md). La tarea pendiente se define en [FIRST-TASK.md](FIRST-TASK.md).
