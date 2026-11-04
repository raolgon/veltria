# Referencias de producto y motores

Resumen conservado de la revisión inicial del 30 de octubre de 2026; no sustituye la verificación de las versiones que se integren. La arquitectura vigente es web/Electron, descrita en ARCHITECTURE.md.

## Aprendizajes


- Stability Matrix: instalaciones aisladas, biblioteca compartida y UI nativa sobre ComfyUI. Ya detecta hardware y recomienda backend. Sus cambios de versión no equivalen a restaurar todo el entorno.
- InvokeAI: flujo creativo, gestor separado en registro/instalación/descarga/carga, paquetes iniciales y gestión avanzada de memoria. Ya dispone de calibración para determinadas operaciones. Su API y sus workflows requieren un adaptador distinto de ComfyUI; su lienzo y sus workflows no se incorporan automáticamente a nuestra UI: requieren integración deliberada.
- ComfyUI: API local, flujos preparados y App Mode. Simplificar los nodos por sí solo no es un diferenciador suficiente.
- SwarmUI: generación accesible sobre ComfyUI, con imagen, video y ciertos modelos de audio.
- Pinokio: recetas para instalar y ejecutar herramientas sin terminal.

Aportación principal de Veltria: conectar selección por tarea, preparación completa, verificación local y recuperación comprensible dentro de una experiencia uniforme. No presentar como exclusivas funciones que otras herramientas ya tienen.


## Fuentes de motores para volver a verificar

- https://github.com/Comfy-Org/ComfyUI
- https://docs.comfy.org/development/comfyui-server/comms_routes
- https://docs.lykos.ai/stability-matrix/advanced/comfyui-integration.html
- https://docs.lykos.ai/stability-matrix/advanced/hardware-support.html
- https://docs.lykos.ai/stability-matrix/advanced/shared-folders.html
- https://docs.lykos.ai/stability-matrix/package-manager/managing-packages.html
- https://github.com/invoke-ai/InvokeAI
- https://v7.invoke.ai/development/architecture/model-manager/
- https://v7.invoke.ai/configuration/optimization/low-vram-mode/
- https://github.com/mcmonkeyprojects/SwarmUI
- https://github.com/pinokiocomputer/pinokio

Licencias observadas en la revisión inicial: código Stability Matrix AGPL-3.0, binarios con EULA propia; InvokeAI Apache-2.0; SwarmUI MIT; ComfyUI GPL-3.0. Revisar licencias de la versión concreta, modelos, extensiones y forma de redistribución antes de incorporar código o binarios. Referenciar una API no equivale a copiar su implementación.
