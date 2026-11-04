# Veltria — nueva interfaz Obsidian

Actualización del 4 de noviembre de 2026. Prototipo de interfaz en Vue 3, construido para revisar la aplicación de PHILOSOPHY.md. No es la implementación del servicio Bun ni de los motores.

## Abrir sin instalar

Abrir `ui-prototype/veltria.html` en un navegador moderno. Incluye el código compilado de Vue, iconos, estilos e ilustración SVG; no necesita CDN, conexión a Internet o servidor para el recorrido de diseño. También se incluye el código fuente en `ui-prototype/src/`.

## Cambios del flujo

- Crear empieza por la intención: crear una imagen o transformar una referencia. Video y audio aparecen como futuros y están deshabilitados.
- El área central conserva la idea, con una ilustración de bienvenida claramente identificada. No usa capturas de pantalla como controles ni presenta esa ilustración como generación.
- El inspector presenta perfil recomendado, formato, prioridad y estilo. Modelo/familia y parámetros técnicos se consultan progresivamente.
- Preparar para crear abre un resumen del conjunto completo, con volumen, espacio y ubicación ilustrativos. Motor, entorno y componentes se prepararán como una operación, no mediante un asistente por dependencia.
- El recorrido de ejemplo permite observar preparación, pausa, continuidad y estado preparado. Ver escenarios permite revisar una interrupción y su siguiente acción sin producir efectos reales.
- Adaptaciones muestra LoRA compatibles con las familias de ejemplo y explica las de otra familia. Permite seleccionar una adaptación, editar intensidad y añadir explícitamente su palabra de activación al texto. No añade palabras ocultas. La selección de un archivo local no afirma que se haya analizado su compatibilidad.
- Mi equipo presenta la preparación administrada como ruta normal y el uso de ComfyUI existente como alternativa avanzada. Los datos del equipo están identificados como ejemplo.
- Biblioteca tiene un estado vacío honesto. Crear imagen informa de la conexión futura al motor, sin devolver resultados ficticios.
- Ajustes permite elegir oscuro, claro o sistema. La preferencia del prototipo se conserva en el navegador cuando está permitido. En el producto, el servicio/SQLite será la autoridad.

Los perfiles, familias, tamaños, compatibilidad y preparación del prototipo son datos de diseño, no un catálogo aprobado, detección real ni una estimación para la computadora donde se abre. La indicación de prototipo permanece visible: en móvil se añade al encabezado y las barras se adaptan a la escritura.

## Adaptación para móvil

MOBILE-UI.md documenta la revisión responsive integrada: navegación inferior, descripción antes de la previsualización, acción principal accesible, controles ampliados y paneles desplazables. Se revisaron marcos de 320/390 px, tableta, escritorio y horizontal. El mismo HTML se adapta al ancho de la ventana; no requiere una aplicación aparte.

## Red local prevista

Ajustes incluye Red local: interruptor deshabilitado y recorrido explicativo del futuro emparejamiento. No hay IP, QR, sesiones, listener o conexión real. LOCAL-NETWORK.md incorpora la arquitectura para controlar el equipo principal desde otros dispositivos de la misma red y con salida a Internet desconectada. El prototipo sólo presenta ese flujo.

## Código y desarrollo

Vue SFC y Composition API con TypeScript; CSS con tokens Obsidian; iconos @lucide/vue e ilustración propia SVG. Sin React. Sin telemetría, backend remoto o llamadas al motor. Las referencias seleccionadas usan object URLs de la propia pestaña, sin subirse a un servidor.

Para desarrollar con Bun, instalar dependencias en esta carpeta con `bun install` y arrancar con `bunx --bun vite`. Al integrar el prototipo, fijar y versionar bun.lock. Este paquete no contiene un lockfile generado con Bun ni afirma haber probado esa herramienta en el entorno de esta entrega. Los scripts de build incluyen un pequeño empaquetador Node como herramienta de desarrollo; se puede ejecutar con Bun al comprobar la integración. Esto no cambia el servicio de producto Bun/Fastify ni el contenedor Electron acordados.

El HTML compilado es la opción directa para revisar sin configurar herramientas. No distribuirlo como si fuera una aplicación de generación completa. Los controles y datos de simulación se sustituyen por capacidades/estados reales del servicio al integrar, no por temporizadores que aparenten una instalación.

El prototipo está en español para esta revisión. La aplicación mantiene el requisito de preparar textos para localización; los textos de ejemplo no son un sistema i18n terminado.

## Verificación realizada

- Typecheck de los componentes con vue-tsc y build de producción con Vite en Linux, Node 24.22.1.
- Revisión visual en navegador Chromium de los temas claro y oscuro.
- Selección de adaptación y explicación de incompatibilidad; palabra de activación añadida visiblemente al prompt.
- Recorrido ilustrativo de preparación hasta preparado, con descripción conservada; apertura del aviso de que no hay generación real.
- Escenario de interrupción con acción de recuperación y descripción conservada.
- El HTML sin dependencias externas se comprobó servido como archivo estático. Se verificó también que Deshacer recupera el texto anterior a Probar una idea.

No se han validado Electron, Bun, hardware, descarga, instalación, generación, red LAN entre dispositivos, Windows o macOS. La revisión móvil se comprobó en los viewports de MOBILE-UI.md; esto no equivale a pruebas físicas de iOS/Android, su teclado virtual o todos los navegadores. Las importaciones de archivos y la persistencia de apariencia necesitan comprobación adicional en las plataformas finales.

La incorporación de Red local pasó typecheck/build y se revisó en escritorio y en un viewport de 320 × 568: interruptor deshabilitado, recorrido explicativo accesible y panel sin desbordamiento horizontal. Esto valida la presentación, no una conexión entre equipos.

## Integración con el primer hito

Usar este prototipo como fuente reutilizable de composición y controles, conservando PHILOSOPHY.md y las comprobaciones del primer hito. No tratar sus perfiles o estados como datos reales. En la implementación inicial sólo habilitar acciones respaldadas por el servicio y mostrar las posteriores como pendientes. La instalación administrada y los LoRA siguen su secuencia de hitos; la UI de referencia no obliga a adelantarlos ni a simularlos en producción.
