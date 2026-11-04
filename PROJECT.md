# Veltria — decisiones vigentes

Actualizado el 3 de noviembre de 2026. Nombre provisional: Veltria. Identificador técnico: veltria. Dirección visual: Obsidian, con temas oscuro, claro y sistema.

## Filosofía obligatoria

**La persona decide qué quiere crear. Veltria prepara lo necesario para hacerlo en su equipo.** Seguir PHILOSOPHY.md: tareas comprensibles primero, perfiles recomendados, preparación completa con una acción, LoRA con compatibilidad explícita, detalles técnicos progresivos y recuperación dentro de la app. Automatizar la mecánica y mantener visibles las decisiones sobre descarga, ubicación, licencia, calidad y cambios importantes.

La integración con un ComfyUI existente es una etapa técnica y una opción avanzada. La incorporación normal del producto para principiantes debe gestionar su propio entorno, motor y componentes; no delegar esa instalación en tutoriales o terminal. Preferir pocos perfiles completamente comprobados a muchos archivos que la persona tenga que hacer funcionar.

## Objetivo y prioridades

Crear una aplicación accesible para descubrir, descargar y utilizar modelos de pesos abiertos de imagen, video y audio. Detectar el hardware y recomendar combinaciones de modelo, variante, receta y ajustes que sean viables y prácticas. Imagen primero.

Reducir desarrollo duplicado compartiendo la interfaz web y la de escritorio, y también la lógica que administra hardware, archivos, instalaciones y generaciones. El cálculo de IA seguirá dependiendo del motor, sus optimizaciones y el hardware; el cambio de tecnología de interfaz no garantiza generaciones más rápidas.

## Decisiones de plataforma

- Vue 3 + TypeScript + Vite para la UI común, con SFC y Composition API. Usar componentes reales, no una captura como fondo de interfaz.
- Electron como contenedor de escritorio: ventanas, ciclo de vida e integración mínima con el SO.
- Bun + TypeScript + Fastify como servicio local, ejecutable sin Electron y también como proceso separado administrado por Electron.
- El servicio Bun se distribuye como ejecutable auxiliar que Electron inicia con spawn; Electron conserva su Node interno. Ninguna API Bun en main/preload o componentes Vue. El usuario final no instala runtimes por separado.
- Mantener Fastify y verificar sus plugins/red/streaming bajo Bun antes de ampliar funciones; no sustituir el framework por cambiar el runtime.
- API local HTTP y eventos SSE; la UI no accede directamente a ComfyUI, SQLite, procesos o archivos internos del motor.
- SQLite mediante bun:sqlite como autoridad de datos del servicio; archivos grandes fuera de la base.
- Bun workspaces y versiones estables compatibles fijadas con bun.lock. No introducir microservicios, Docker, Kubernetes o un segundo backend.
- Windows y Linux son las primeras plataformas de validación. macOS es un objetivo de portabilidad, empaquetado y pruebas pendientes, no una plataforma ya certificada.
- La generación es local. Sin servicios cloud propios, cuentas Veltria, sincronización, telemetría o conectores de inferencia remota en esta etapa.
- Web usa el servicio del equipo principal. Inicialmente navegador local; requisito LAN aceptado para dispositivos emparejados de la misma red, sin Internet si el perfil está preparado. El host ejecuta y conserva datos; el cliente sólo presenta controles y resultados. Activación explícita y alcance según LOCAL-NETWORK.md; sin sitio público o túneles.
- El diseño contempla un ejecutor remoto futuro mediante la frontera del adaptador, sin implementarlo ahora.
- Trabajar sin subagentes. Conservar trabajo y datos existentes.

## Experiencia visual

Seguir DESIGN.md, UI-PREVIEW.md y el prototipo ui-prototype/veltria.html para el nuevo flujo; design/obsidian-dark.png / obsidian-light.png conservan el estilo de referencia. Grafito/ámbar en oscuro, marfil y ámbar/cobre en claro. Misma estructura en ambas variantes, estados legibles, foco de teclado y efectos discretos. Temas desde el primer hito. La interfaz web debe adaptarse también a teléfono/tableta siguiendo MOBILE-UI.md, con la misma lógica y controles accesibles; esto no añade un ejecutor móvil ni acceso LAN automático.

Navegación: Crear, Modelos, Biblioteca, Mi equipo y Ajustes. Prompts y ajustes sencillos al frente; controles avanzados desplegables. UI preparada para localización; no incrustar textos de usuario en lógica. Inglés como idioma visual inicial de las referencias.

## Modelos y compatibilidad

Distinguir modelo, variante de pesos, receta ejecutable y perfil de ajustes. Un modelo descargado no está listo hasta reunir componentes y requisitos de la receta.

Detectar CPU, RAM, GPU, VRAM, controlador y disco con fuente de datos y valores desconocidos cuando corresponda. Distinguir total y disponible, entornos WSL y Windows, y hardware del servicio frente al del navegador. No sumar RAM y VRAM ni varias GPU como memoria intercambiable.

Equipo del usuario como referencia de prueba, no constante de producto: RTX 4050 de 6 GB VRAM, 16 GB RAM y Ryzen 5 7535H. Confirmarlo al ejecutar.

Recomendaciones locales mediante reglas y mediciones; no requieren un LLM. Estados: recomendado, con ajustes, experimental, no compatible y sin verificar. Explicar motivos y separar requisitos documentados, pruebas similares y ejecución verificada. No inventar tiempos ni porcentajes. Registrar la vigencia de mediciones según modelo, ajustes y entorno.

## Motores y descargas

ComfyUI local es el primer motor. Empezar conectando una instalación existente sin mover archivos o cambiar su entorno. Instalar y administrar una instancia propia en el hito 3 como ruta normal para principiantes; la conexión externa no sustituye este requisito de producto. No exigir otros gestores como intermediarios.

Cada receta declara workflow API, componentes, versiones, entradas y extensiones necesarias. La preparación la resuelve el servicio como una operación persistida: plan previo, autorización del conjunto, ejecución, comprobación y recuperación. Un archivo descargado no equivale a una tarea preparada o verificada. Los LoRA requieren relación con familia/modelo/receta y estado de compatibilidad; no son archivos intercambiables por estar en la misma carpeta. No prometer compatibilidad con cualquier workflow ni conversión universal entre motores. Cancelar sólo trabajo propio, especialmente con motores compartidos.

Catálogo inicial pequeño y revisado, incluido para consulta offline. Descarga de componentes por streaming a archivos temporales, reanudación cuando el origen la admita, verificación de integridad y espacio total/temporal antes de instalar. Credenciales de proveedores fuera de logs y repositorio. Respetar licencias y pasos de acceso del proveedor. No ejecutar instrucciones arbitrarias de metadatos o workflows.

## Calidad y distribución

Validar navegador y Electron sobre el mismo servicio, sin duplicar reglas. Pruebas con mocks no equivalen a detección o generación real. Una build para un sistema no equivale a haber ejecutado el producto en él.

Conservar resultados y modelos fuera de carpetas eliminables de motores. Documentar comandos, versiones y validaciones disponibles. No activar actualizaciones automáticas o publicar instaladores durante este traspaso.

Consultar PHILOSOPHY.md para principios y aceptación de UX, ARCHITECTURE.md para procesos, contratos y fases; MIGRATION.md si ya existe código previo. Mantener este archivo como la síntesis vigente.
