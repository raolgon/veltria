# Transición a web y Electron

Decisión vigente del 3 de noviembre de 2026: usar Vue 3 + TypeScript + Vite, Electron y un servicio local Bun + Fastify. Sustituye tanto C# / Avalonia / .NET como la propuesta posterior React + Node. Las decisiones anteriores de lenguaje/UI quedan supersedidas. Se mantienen producto, generación local, SQLite, ComfyUI, nombre y Obsidian oscuro/claro/sistema.

## Si existe código de la propuesta React/Node

Conservar contratos HTTP/SSE, reglas de dominio, workflows, datos, recursos Obsidian y componentes CSS útiles. Portar la vista a Vue SFC/Composition API; eliminar dependencias React sólo cuando ya no se utilicen. Cambiar el servicio a Bun y su repositorio a bun:sqlite, comprobando APIs, tipos y esquema con una copia de la base, sin reinicializar datos.

Sustituir el arranque del backend mediante utilityProcess por spawn del ejecutable auxiliar Bun. Mantener main/preload en el runtime Electron, sin imports bun:. Migrar a Bun workspaces/bun.lock de forma controlada; retirar el lockfile anterior tras comprobar la instalación reproducible. No mantener dos servicios ni dos bases de datos por cliente. Verificar Fastify/plugins, HTTP/SSE, migraciones y cierre en el ejecutable distribuido antes de retirar la ruta anterior.

## Si todavía sólo hay documentos

No hay una aplicación que portar. Iniciar la estructura pequeña de ARCHITECTURE.md y ejecutar FIRST-TASK.md. Las capturas se usan como referencia visual.

## Si existe implementación previa

1. Inventariar código, instrucciones, cambios sin commit, esquema de base, rutas de modelos/resultados y pruebas. No borrar ni reinicializar el repositorio.
2. Registrar brevemente qué se reutiliza: reglas, contratos, workflows, datos y recursos. Mantener el código anterior hasta que la nueva ruta tenga comprobaciones equivalentes.
3. Crear la nueva aplicación en una rama/carpeta aislada dentro del flujo del repositorio. Llevar una primera función completa, no una traducción automática de toda la UI.
4. Cambiar a TypeScript las reglas necesarias con pruebas que preserven el comportamiento. No mantener un backend C# paralelo salvo dependencia encontrada que se documente y resuelva expresamente.
5. Una base SQLite antigua no es compatible sólo por utilizar SQLite: comprobar esquema, tipos, IDs y migraciones con una copia. No sobrescribir datos reales durante el primer arranque. Preservar rutas de pesos y resultados.
6. Validar navegador y Electron, migración y reapertura, y luego retirar instrucciones obsoletas. No eliminar la implementación anterior o sus datos como parte de una limpieza automática sin necesidad y autorización clara.

Estas instrucciones no certifican que ya exista código ni que se haya hecho la migración. Este paquete contiene especificaciones y referencias visuales.
