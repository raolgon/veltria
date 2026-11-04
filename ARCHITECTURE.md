# Veltria — arquitectura compartida web y Electron

Decisión del 3 de noviembre de 2026. Diseño propuesto para implementar: la UI navegable de referencia está documentada en UI-PREVIEW.md; el servicio y los motores de esta arquitectura no se han implementado en este paquete. Sustituye la arquitectura anterior de escritorio. Se conserva la identidad Obsidian y toda la generación local.

PHILOSOPHY.md rige la experiencia: la persona expresa la tarea y Veltria resuelve la preparación completa. La simplicidad de UI requiere orquestación en el servicio, no una secuencia de instrucciones manuales al usuario.

## 1. Límites de responsabilidad

Tres capas: UI compartida, servicio local de Veltria y motor de inferencia. Electron añade un contenedor, no otro backend de producto.

- UI: Vue 3 + TypeScript + Vite, con Single-File Components y Composition API (`<script setup lang="ts">`). Presentación, navegación, edición del prompt, selección de perfiles, progreso y biblioteca. Sólo APIs web en componentes comunes.
- Servicio: Bun + TypeScript + Fastify. Hardware, validación, recetas, descargas, instalaciones, trabajos, SQLite y archivos. No importa Electron.
- Motor: ComfyUI en proceso Python/PyTorch separado. Carga pesos y utiliza CPU/GPU; Veltria lo controla mediante su API local.
- Electron main: crea ventanas, inicia/supervisa el servicio y coordina permisos, diálogos y cierre. No implementa un segundo gestor de modelos.
- Preload: puente mínimo para funciones exclusivamente de escritorio. No expone shell, fs, IPC genérico ni objetos internos de Electron.

La interfaz y el servicio no necesitan alojarse en servidores remotos. El término servidor local describe un proceso de la computadora del usuario.

## 2. Modos de funcionamiento

### Navegador local

Un lanzador inicia el servicio Bun, usando el mismo ejecutable que distribuye la edición de escritorio. Éste sirve el build estático de la UI y /api/v1 desde el mismo origen loopback. El usuario abre una URL local autorizada. La pestaña no detecta hardware ni administra procesos: lo hace el servicio.

Durante desarrollo Vite puede servir la UI y usar un proxy explícito para /api y eventos, de modo que el frontend conserve el mismo contrato. En producción no se distribuye el servidor de desarrollo de Vite.

La edición web completa necesita el servicio instalado/ejecutándose. No es una promesa de ejecución de modelos en WebGPU o de funcionamiento sin instalación de motores. Sin servicio debe mostrar una conexión ausente, sin simular capacidades.

### Electron

El proceso main inicia el servicio como ejecutable auxiliar Bun mediante `node:child_process.spawn`, con ruta absoluta conocida, argumentos separados y `shell: false`. Distribuir el servicio compilado con `bun build --compile`, que incluye su runtime, fuera de ASAR mediante extraResources. El lanzador web usa ese mismo ejecutable; en desarrollo se puede ejecutar su fuente con Bun fijado. El usuario final no necesita instalar Bun ni Node por separado.

Electron conserva su runtime Node interno para main/preload: Bun sustituye al runtime del servicio, no al de Electron. `utilityProcess.fork` crea procesos Node y no sirve para ejecutar este backend Bun. No importar `bun:sqlite` ni otras APIs Bun en main/preload o en la UI.

El supervisor y el servicio intercambian el secreto efímero de arranque mediante stdin privado y un mensaje JSON de disponibilidad por stdout, con tamaño/esquema limitados; stderr se reserva para logs sin secretos. El servicio escucha en un puerto loopback asignado por el SO y devuelve el origen real e identidad/protocolo. Verificar el mensaje y la sesión antes de cargar la ventana; no buscar el binario en PATH ni exponer el secreto en argumentos. Electron abre allí el mismo build de UI, con sesión local autorizada. Los únicos IPC específicos son integraciones de escritorio, por ejemplo seleccionar una carpeta; los comandos de producto pasan por la misma API que usa el navegador.

La UI de producción procede de archivos incluidos en el paquete, servidos por ese proceso local. No cargar JavaScript remoto ni una web pública dentro de una ventana privilegiada. Vite sólo se admite como origen de desarrollo expresamente configurado.

### Navegador en otro dispositivo de la red

Requisito aceptado del 4 de noviembre: LOCAL-NETWORK.md define el incremento 3B. Con activación explícita en el host, el mismo servicio añade un listener para una interfaz LAN seleccionada, sirve UI/API desde ese origen y exige emparejamiento por dispositivo. La cola, SQLite, modelos y ComfyUI siguen en el equipo principal; no se crea un backend por cliente.

Mantener el listener de control local y las capacidades administrativas separadas de las sesiones remotas. ComfyUI no se expone directamente. El modo offline exige componentes y recursos ya disponibles. Desactivar compartir revoca acceso remoto y conserva el uso local. El emparejamiento, transporte, permisos y validación de una segunda máquina se detallan en LOCAL-NETWORK.md.

### Sitio público: futuro opcional

Un frontend alojado podría añadirse después, pero tendría que emparejarse con un servicio local o usar otro ejecutor. Las restricciones de origen, CORS, HTTPS y permisos de acceso a la red local dependen del navegador y deben probarse. No asumir que cambiar una URL basta. No implementar ni desplegar este modo ahora.

## 3. Repositorio pequeño

Usar workspaces de package.json administrados por Bun, con un único bun.lock versionado; evitar herramientas extra de orquestación al inicio.

| Ruta | Contenido |
| --- | --- |
| apps/ui | Una aplicación Vue 3 con SFC/Composition API, estilos Obsidian y cliente de API. Compartida por navegador y Electron. |
| apps/desktop | Main, preload, supervisor del servicio y empaquetado Electron. |
| apps/local-service | Fastify, autenticación local, rutas, eventos y lanzador standalone. |
| packages/core | Tipos/reglas de dominio y casos de uso. Sin Vue 3/Electron. |
| packages/contracts | Esquemas de entrada/salida, versión de protocolo y errores; validación runtime con Zod. |
| packages/adapters | Hardware, SQLite, archivos y motores; implementaciones del servicio Bun. Crear sólo los adaptadores necesarios. |

Mantener Fastify: el cambio de runtime no autoriza sustituirlo por Elysia, Hono o Bun.serve. Antes de ampliar el servicio, verificar con las versiones fijadas Fastify y sólo sus plugins necesarios bajo Bun: arranque HTTP real, validación/errores, cookies/CSRF, archivos estáticos, streaming/SSE, desconexión y cierre. Probar también el ejecutable compilado; un test con inject no demuestra compatibilidad de red. Si hay un bloqueo, documentar y resolver esa dependencia/versiones sin volver silenciosamente a Node o cambiar el framework.

No crear un sistema de plugins, varios backends o una capa genérica de persistencia por anticipado. Los límites pueden empezar como módulos sencillos dentro de estas carpetas.

## 4. Procesos y ciclo de vida

Un servicio propietario por directorio de datos. Tanto el lanzador web como Electron utilizan la misma resolución de rutas y migraciones. No arrancar dos servicios independientes que crean que poseen la misma cola o motor. Usar un bloqueo de instancia y comprobar identidad/protocolo antes de conectar a una instancia existente.

Estado inicial del servicio: iniciando, listo, degradado o detenido. La falta de ComfyUI no impide abrir Veltria o consultar hardware. La disponibilidad del motor tiene su propio estado: sin configurar, comprobando, listo, no disponible o error.

Electron no ejecuta descargas, mediciones costosas o inferencia en main ni renderer. El servicio gestiona I/O asíncrono; trabajo intensivo de CPU y consultas largas se derivan a workers cuando sea necesario. El motor sigue en otro proceso.

Cerrar una pestaña no equivale a parar el servicio o una generación. El servicio sólo se detiene mediante una acción explícita o su supervisor propietario. Definir un cierre controlado de Electron que advierta sobre trabajos propios activos y no mate motores externos. No instalar un servicio permanente del SO en la primera versión. El supervisor gestiona timeout de arranque, fallo del ejecutable, salida inesperada y cierre explícito autenticado antes de terminación forzada sólo del proceso propio. Probar el cierre en Windows y Linux; no depender exclusivamente de señales POSIX ni matar por nombre de proceso. No reiniciar ciegamente un servicio con una generación activa.

## 5. API y eventos

Contrato versionado /api/v1. Los tipos TypeScript compartidos no sustituyen la validación de solicitudes y respuestas. La UI consume un cliente único.

Rutas previstas, implementadas por hito:

| Área | Contrato conceptual |
| --- | --- |
| Estado | GET /health y versión/capacidades del servicio. |
| Equipo | GET /hardware, con fuentes y valores desconocidos. |
| Ajustes | GET/PATCH /settings, incluyendo preferencia de apariencia. |
| Motor | Inventario, comprobación y configuración de conexiones locales admitidas. |
| Catálogo | Modelos, variantes, recetas y perfiles; consultas paginadas. |
| Preparación | Obtener plan versionado de componentes/cambios/espacio para un perfil, autorizarlo e iniciar una operación; implementado en el hito de instalaciones. |
| Descargas/instalaciones | Crear operación, consultar estado y cancelar/reanudar donde sea posible. |
| Trabajos | Enviar solicitud tipada, obtener estado y solicitar cancelación de trabajo propio. |
| Archivos | Importación y entrega de artefactos por identificadores y raíces autorizadas. |
| Progreso | SSE para eventos del servicio; la UI vuelve a consultar el estado al reconectar. |

Usar HTTP para acciones y SSE para notificaciones unidireccionales. El adaptador ComfyUI recibe su progreso por WebSocket y lo transforma a eventos de Veltria. No conectar cada pestaña directamente al motor.

Los eventos incluyen identificador de operación/trabajo y secuencia suficiente para reconciliar estados. No usar el stream como única fuente de verdad. Al reconectar, consultar SQLite/motor para recuperar el estado; no repetir automáticamente una petición de generación ya aceptada. Identificar envíos para evitar duplicados por doble clic o reintentos.

Los archivos grandes se transfieren por streaming y referencias, no base64 en JSON, eventos o IPC. La UI pide miniaturas y carga paginada; no decodifica toda la biblioteca a la vez.

## 6. Seguridad local mínima integrada

Escuchar por defecto sólo en loopback y validar Host. En el incremento LAN, añadir únicamente la interfaz elegida tras activar compartir; aplicar sesiones y permisos remotos según LOCAL-NETWORK.md. No cambiar globalmente a todas las interfaces ni confundir un cliente autorizado con el propietario local. El origen local no es por sí solo una autorización: una web ajena no debe poder iniciar instalaciones o leer archivos del usuario.

Usar una sesión por lanzamiento/emparejamiento, autorizada por el lanzador/main mediante secreto efímero. Electron puede establecer la sesión en su almacenamiento de cookies; para el navegador, un nonce de un solo uso en el fragmento de la URL de arranque se intercambia por sesión y se elimina del historial. No registrar tokens ni incluir secretos permanentes en la UI. Cookie HttpOnly/SameSite estricto, comprobación de origen y protección CSRF en mutaciones; fijar flags de transporte según HTTP loopback o HTTPS, sin degradar la autorización.

Sin CORS wildcard, sin server público y sin autorizar un origen arbitrario. En desarrollo, los orígenes permitidos son explícitos. Contenido y CSP limitados a los recursos necesarios. Rechazar navegación externa en Electron; enlaces permitidos se abren mediante una función controlada, no como una nueva página privilegiada.

Electron: nodeIntegration false, contextIsolation true y sandbox true. Preload con métodos específicos, validación del emisor y argumentos; no un proxy libre a ipcRenderer o a comandos del SO.

Ejecutar motores/probes con comandos conocidos y argumentos separados, sin shell genérica. Los manifiestos y workflows son datos que pueden referenciar código ejecutable; instalaciones sólo de recetas revisadas. Tratar prompts, nombres de archivos y metadatos como entrada no confiable.

El servicio entrega artefactos por ID y raíces autorizadas; no implementar un endpoint para leer cualquier ruta recibida. Los diálogos nativos devuelven selecciones autorizadas; en navegador, usar importación/exportación y gestión de ubicaciones a través del servicio. El alcance de esas funciones se presenta mediante capacidades, sin rutas falsas.

## 7. Persistencia

SQLite pertenece sólo al servicio; el renderer nunca abre la base. Repositorios y migraciones usan el mismo servicio Bun y esquema tanto desde navegador como desde Electron. Guardar ajustes, recetas, instalaciones, trabajos y mediciones. Modelos y resultados son archivos externos a la base y a la instalación de la app.

Driver inicial: `bun:sqlite`, incluido en Bun y usado sólo dentro del servicio. Antes de ampliar el código, comprobar apertura, transacción/rollback, migración y reapertura en desarrollo Y en el ejecutable compilado empaquetado. Incluir prueba de reinicio/persistencia desde ambos clientes. Mantener el acceso tras un repositorio pequeño; no añadir un driver SQLite para Electron ni abrir la misma base desde main. La compatibilidad del archivo depende de esquema, migraciones y versión SQLite; no se garantiza por cambiar el import del driver.

Las APIs síncronas de SQLite se usan para operaciones pequeñas; no bloquear el servicio con escaneos o transacciones largas. Elegir índices y paginación según consultas reales.

Un directorio de datos común por usuario, con subcarpetas separadas para db/settings, modelos, resultados, motores y caché. Permitir mover las ubicaciones grandes. No borrar creaciones al desinstalar un motor. La sesión del navegador puede conservar caché de presentación y borradores del propio cliente; SQLite es la autoridad de ajustes compartidos, operaciones y trabajos aceptados. Los prompts en edición no se sobrescriben entre dispositivos. Distinguir apariencia/preferencias por dispositivo de la configuración global del host. Borrar datos del navegador no elimina modelos.

## 8. Hardware y compatibilidad

Detectar en el host del servicio: SO/arquitectura, CPU, RAM, GPU, VRAM, controlador y disco. El navegador puede dar información parcial, pero no se usa como inventario fiable de GPU. Comprobar también el dispositivo elegido por el motor.

Implementar probes por plataforma con fuentes identificadas. Windows y Linux primero; macOS detrás de la misma interfaz y con valores desconocidos cuando falte una prueba. Memoria unificada Apple no equivale a VRAM dedicada; su compatibilidad con MPS y operaciones del modelo necesita validación. Distinguir WSL del host Windows.

Recomendación para combinación de tarea, modelo, variante, receta, motor/versiones y ajustes. Reglas locales con motivos; no necesita una IA externa. Clasificar recomendado, con ajustes, experimental, no compatible y sin verificar. Guardar qué se midió realmente y con qué entorno, sin extrapolar una prueba pequeña a todas las resoluciones o duraciones.

## 9. Motores, instalaciones y trabajos

Primero conectar un ComfyUI existente, sin modificar sus archivos ni dependencias. En el hito 3 instalar un entorno propio por motor/conjunto de dependencias compatibles, no uno por cada modelo. Esa instalación administrada es el camino normal del producto para principiantes; conectar un motor existente queda como alternativa avanzada. No confundir la secuencia de implementación con el flujo final de incorporación. Mantener versiones fijadas y no actualizar por sorpresa. No instalar controladores del sistema silenciosamente.

Recetas conocidas: workflow API, componentes, entradas, extensiones y restricciones. Descargar conjunto completo mediante streaming, reanudación admitida, comprobación de integridad y espacio previo. Instalar código sólo desde fuentes revisadas. Preparación offline significa disponer también de componentes y dependencias, no sólo de los pesos.

### Preparación como operación de producto

Implementar en el hito 3 un planificador sencillo dentro de core y su ejecutor en el servicio; no un nuevo backend o framework de plugins. El plan enlaza tarea/perfil con receta y versiones, componentes que ya existen o faltan, origen/integridad, requisitos de acceso/licencia, cambios de entorno, ubicación, volumen pendiente y espacio temporal/final. La evidencia de compatibilidad y los valores desconocidos se conservan en el contrato.

Autorizar una revisión concreta del plan e identificar su operación para evitar doble ejecución. Si cambia materialmente la descarga, ubicación, código a instalar o resultado esperado, presentar el cambio antes de continuar. Evitar confirmaciones repetidas para pasos incluidos. Resolver dependencias declaradas y detectar ciclos/conflictos antes de instalar; no inferir comandos de metadatos arbitrarios.

Una operación de preparación persiste pasos y resultados: comprobar, descargar, verificar, instalar/configurar, comprobar disponibilidad y, si se solicita, realizar una prueba de generación explícita. Los pasos completados se reutilizan sólo tras comprobar su estado/integridad; manejar componentes compartidos sin borrarlos al cancelar otro perfil. Los porcentajes se basan en trabajo medible, con estado indeterminado cuando no exista denominador fiable. La descarga, disponibilidad del runtime y prueba de ejecución son evidencias distintas.

Estado del perfil: descargado, incompleto, preparado, verificado con un entorno/ajustes o requiere atención. Mantenerlo separado de los estados de descarga y de trabajo. La preparación no envía automáticamente una generación; si se ofrece una acción combinada futura, su intención y parámetros deben ser explícitos. Un cliente desconectado consulta la operación existente al volver.

Después del primer perfil instalable, incorporar registro de LoRA con identidad del artefacto, fuente, familia/modelo base declarado, recetas admitidas, intensidad/palabras sugeridas y grado de evidencia. Un metadato declarado no equivale a verificación. Revalidar selección al cambiar modelo/receta; rechazar o marcar combinaciones desconocidas antes del envío. No ejecutar contenido ni confiar en el nombre del archivo. No prometer compatibilidad universal entre variantes o varios LoRA.

Toda esta preparación sucede en el servicio compartido: navegador y Electron muestran el mismo plan, estado y acciones. La UI no descarga por su cuenta ni calcula otra matriz de compatibilidad. Una reparación opera sólo sobre los recursos que Veltria administra y respeta archivos/resultados y propiedad del motor.

### Cola de generación

Empezar con un trabajo activo por GPU y cola. Estados: pendiente, preparando, ejecutando, guardando, completado, cancelado, fallido, interrumpido. Guardar IDs propios y del motor; comprobar propiedad antes de cancelar, porque ciertas operaciones del motor afectan al trabajo activo global.

Reconciliar al reiniciar y no repetir generaciones costosas automáticamente. Guardar artefactos y parámetros para reusar ajustes. No prometer reanudación de una generación desde su paso interno si el motor no lo soporta. Fallos legibles según evidencia: conexión, archivo faltante, incompatibilidad o memoria insuficiente.

## 10. Temas y rendimiento de UI

Obsidian oscuro/claro/sistema, con una estructura DOM compartida, variables CSS semánticas y preferencia en SQLite. Usar prefers-color-scheme para System; Electron puede sincronizar sus elementos propios mediante nativeTheme. No recolorear archivos del usuario. La misma UI incluye adaptación móvil según MOBILE-UI.md: navegación inferior, disposición vertical, áreas seguras y controles táctiles. Mantener la lógica y los contratos compartidos; la UI móvil no ejecuta modelos. El acceso LAN se habilita expresamente con el transporte y emparejamiento de LOCAL-NETWORK.md.

Servir fuentes, iconos y estilos incluidos, sin CDN requerida en producción. Evitar blur a pantalla completa, videos de fondo, animaciones permanentes y copiar imágenes enormes a estado reactivo de Vue. Mantener blobs/pesos fuera de stores reactivos; usar referencias a artefactos y estado pequeño. Virtualizar listas cuando lo requiera el volumen. Gestionar y revocar object URLs.

Electron puede consumir más memoria que la propuesta de escritorio anterior. El objetivo del cambio es reducir desarrollo duplicado; medir consumo real y no prometer que Chromium reduce VRAM o acelera inferencia.

## 11. Portabilidad y empaquetado

Fijar versiones compatibles de Bun, Vue/Vite, Fastify y Electron, más los plugins realmente utilizados. Bun administra dependencias y ejecuta el servicio y Vite; usar invocación explícita como `bunx --bun vite` para evitar que un shebang seleccione Node sin querer. Bun no realiza por sí solo la comprobación de tipos: ejecutar vue-tsc para SFC y tsc para los paquetes TS.

Electron y algunas herramientas de empaquetado/pruebas pueden necesitar Node en desarrollo: documentar esas excepciones y fijar su versión cuando se requiera, sin convertir Node en backend de producto. No usar Bun para ejecutar directamente main/preload: se compilan para el runtime Electron. Revisar scripts de instalación de dependencias y autorizar sólo los necesarios, como la descarga del binario Electron.

Compilar el servicio para cada SO/arquitectura objetivo con Bun estable y `bun build --compile`; usar el target x64 compatible con las CPUs admitidas, no asumir AVX2. No usar compilación AOT experimental para el primer hito. Empaquetar UI estática y ejecutable con rutas explícitas resueltas desde recursos, sin depender del directorio de trabajo. El servicio recibe la ruta de recursos y un directorio de datos escribible separado; no escribir SQLite dentro de ASAR o del instalador.

Herramienta de empaquetado propuesta: electron-builder, sin añadir una segunda. Windows instalador y Linux AppImage como primeros artefactos, comprobando soporte con las versiones elegidas. macOS x64 y arm64 como objetivos futuros separados. No activar publicación o actualizaciones automáticas en el primer hito.

Compilar, firmar/notarizar, ejecutar la ventana y generar con GPU son comprobaciones distintas. La firma macOS necesita un host macOS; la generación con Apple Silicon requiere prueba real. Se puede preparar CI macOS posteriormente, sin confundirlo con validación de hardware ni con renderizado cloud del producto.

La compilación cruzada de Bun facilita preparar binarios, pero no valida su ejecución ni reemplaza el empaquetado, firma o pruebas del instalador Electron. Probar dependencias dinámicas, recursos, permisos ejecutables y apertura HTTP en el binario distribuido. En macOS, contemplar también la firma del ejecutable auxiliar y sus requisitos de runtime; permanece pendiente de prueba real.

No copiar extensiones o módulos nativos entre runtimes/arquitecturas suponiendo compatibilidad. Los módulos del servicio deben funcionar con Bun y su compilación; los de Electron tienen requisitos propios. Si se añade una dependencia nativa externa, probar el paquete completo, no sólo el entorno de desarrollo.

## 12. Desarrollo y validación por hitos

- Hito 1: ambos clientes con misma UI y API; temas, servicio, sesión local, hardware, SQLite y conexión a ComfyUI existente. Sin generación todavía.
- Hito 2: un flujo real de texto a imagen, cancelación propia, estado persistente y biblioteca en ambos clientes.
- Hito 3: preparación administrada de ComfyUI y un perfil completo con una acción; catálogo pequeño, plan, descargas, instalación y recuperación. Incorporar después el flujo LoRA con compatibilidad verificable.
- Incremento 3B: compartir en LAN/Wi-Fi, emparejar clientes y validar generación offline desde otro dispositivo; seguir LOCAL-NETWORK.md.
- Hito 4: recomendaciones verificables y recuperación guiada.
- Hito 5: video/audio y ampliación de motores/plataformas.

Conservar Vitest para dominio/contratos y componentes Vue con Vue Test Utils cuando aporte valor; probar el servicio y bun:sqlite realmente bajo Bun (bun:test y comprobaciones HTTP del ejecutable). No ejecutar módulos exclusivos Bun en un runner Node y dar por probado el backend. Playwright para navegador y smoke de Electron según la versión soportada. Integración con motor real como suite explícita. Separar validación UI de CPU/GPU y sistemas no disponibles. Crear scripts de desarrollo claros, typecheck, build, test y empaquetado; los nombres exactos se documentan al implementarlos.

La primera entrega orientada a principiantes requiere completar la ruta administrada del hito 3 y al menos una primera creación realmente validada. Los hitos 1 y 2 pueden ser avances técnicos utilizables por personas con motor instalado; no bastan para declarar cumplida la filosofía. No añadir por ello instalaciones, LoRA o generaciones simuladas al primer hito.

## 13. Frontera remota futura

El adaptador de ejecutor expone capacidades, envío, progreso, cancelación y artefactos. Hoy sólo ejecutor local en el host. Un navegador conectado por LAN controla ese mismo ejecutor: esta función no incorpora inferencia cloud ni un motor distinto por dispositivo. Mantener IDs y referencias a artefactos fuera del conocimiento de rutas privadas del motor en la vista.

Un ejecutor remoto futuro necesitará autenticación de usuarios, transferencia, privacidad, costes y evaluación del hardware remoto. No añadir ahora SDKs cloud, servicios remotos, facturación o logins.

## Referencias técnicas revisadas

- https://www.electronjs.org/docs/latest/tutorial/process-model
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- https://www.electron.build/docs/features/multi-platform-build/
- https://vite.dev/guide/
- https://fastify.dev/docs/latest/Reference/Server/
- https://vuejs.org/guide/quick-start.html
- https://vuejs.org/guide/typescript/overview
- https://bun.com/guides/ecosystem/vite
- https://bun.com/docs/compiler/executables
- https://bun.com/docs/runtime/sqlite
- https://bun.com/docs/pm/workspaces
- https://fastify.dev/docs/latest/Reference/LTS/
- https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access
- https://docs.comfy.org/development/comfyui-server/comms_routes

Verificar documentación y APIs de las versiones fijadas al iniciar el código. Este paquete incluye un prototipo de UI, no la implementación del servicio o de la inferencia; UI-PREVIEW.md delimita las comprobaciones realizadas.
