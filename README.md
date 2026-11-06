# Veltria — web local y Electron

## Versión actual: 0.9.0 · calidad de imagen a tu elección

En **Crear → Calidad de imagen**, elige tamaño y esfuerzo de generación, o ajusta ancho, alto, pasos y CFG manualmente. Las opciones dependen de la familia seleccionada. Se muestra el tamaño real y se avisa al superar el punto de partida; el usuario puede intentarlo dentro de los límites de la receta. Más píxeles o pasos no garantizan un mejor resultado. Los ajustes de cada imagen se guardan en su trabajo sin cambiar la configuración del modelo. [Alcance y comprobaciones](docs/image-quality.md).

SDXL Base 1.0 conserva su ajuste inicial de 768 px y `--lowvram`, junto a SD 1.5 y DreamShaper 8. [Prueba real anterior de SDXL](docs/sdxl-validation.md).

En **Modelos → Gestionar descargas**, revisa archivos completos y parciales, tamaño, ubicación y perfiles compartidos. Puedes usarlos, continuar su preparación o revisar su retirada. Retirar un LoRA conserva la base; retirar un archivo compartido requiere confirmar los perfiles afectados. Creaciones y configuraciones se conservan.

En **Modelos**, Veltria propone un punto de partida priorizando opciones comprobadas con los ajustes elegidos y archivos ya preparados. Puedes volver al orden por popularidad. Las fichas explican utilidad, ajustes iniciales y compatibilidad estimada o comprobada.

En **Modelos → Ver modelos para mi equipo**, explora sin escribir una búsqueda, con los más descargados primero y más páginas disponibles. También busca por intención o nombre, consulta Hugging Face y prepara checkpoints/finetunes y LoRA estándar SD 1.5 compatibles con una configuración inicial. Filtros por equipo, descarga pendiente, detalles avanzados y preparación conjunta de adaptación y modelo base. Otras familias, salvo el SDXL oficial incluido, se muestran con su soporte pendiente; no se promete ejecutar cualquier archivo.

**Crear → Preparar mi equipo** busca y propone reutilizar tu ComfyUI existente, sin pedir una ruta de Python. Revisa la descarga, el espacio y los cambios, autoriza la preparación y crea cuando termine. Si no lo encuentra, puedes elegir una carpeta. La búsqueda sólo lee archivos; no instala otro motor ni modifica tus modelos.

**Modelos** permite elegir SD 1.5, DreamShaper 8 o SDXL Base 1.0, revisar la descarga y preparar el modelo para usarlo en **Crear**. Hay configuraciones equilibrada, borrador y más pasos por modelo, exportación/importación de JSON de Veltria y selección persistente. Se conservan las descargas parciales al cambiar de modelo; cambiar sólo ajustes no vuelve a descargar los pesos.

Crear permite elegir **Imágenes** o **Video**. Conserva la generación de imagen, la biblioteca, los recursos en vivo y español/inglés. El primer flujo de video reutiliza MiniMax H3 y sus componentes existentes: plan previo sin descargas, comprobación del motor, vistas previas, progreso real, MP4 con reproducción/guardado y biblioteca de videos. Una tarea de generación a la vez.

**El perfil H3 es experimental.** Se detectaron los cuatro archivos instalados en esta PC, pero el conjunto grande no está verificado para generar en la RTX 4050 de 6 GB y 16 GB de RAM. Se advierte antes de prepararlo. La receta de 6 GB encontrada en D usa otros pesos que faltan; no se sustituyen ni descargan automáticamente. La validación Windows del esquema de nodos y de MP4 no se presenta como una generación H3 real.

Abrir en Windows PowerShell, después de cerrar la versión anterior:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\release\0.9.0\win-unpacked\Veltria.exe
# Navegador:
.\build\browser\0.9.0\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.9.0/linux-unpacked/veltria
# Navegador:
./build/browser/0.9.0/veltria-web
```

El lanzador web imprime el enlace autorizado. Conservar los ejecutables con sus recursos. El paquete usa **protocolo 8** y SQLite de trabajos **esquema 4**; conserva imagen, preferencias y biblioteca, y crea una copia antes de actualizar datos anteriores. No adjuntarse a servicios anteriores ni compartir SQLite entre Windows y Linux. Las entregas anteriores se conservaron en sus carpetas. Cerrar las versiones anteriores antes de abrir esta; los nuevos controles de calidad requieren 0.9 y no se garantiza volver a una versión anterior con los mismos datos.

Desarrollo con Bun 1.4.4 y Node 24.13.0:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
bun run start:web
# O escritorio:
bun run start:desktop
```

`bun run dev` usa Vite 43120 y el proxy a Bun 43121. El servicio contiene toda la lógica y SQLite; Electron conserva su Node y sólo administra ventana, supervisor y diálogos. La UI es compartida y sigue Obsidian. No hay LAN, nube, LLM para reescribir descripciones ni instalación de motores. Los modelos del catálogo se descargan únicamente después de revisar y autorizar su plan. La descarga de los componentes H3 y la importación de workflows arbitrarios siguen pendientes.

[Gestión de descargas](docs/download-management.md) · [Recomendaciones y fichas](docs/catalog-guidance.md) · [Explorar compatibles por popularidad](docs/compatible-browsing.md) · [Buscar modelos y adaptaciones](docs/model-discovery.md) · [Validación real del catálogo](docs/catalog-real-validation.md) · [Preparación automática: búsqueda, pruebas y límites](docs/automatic-setup.md) · [Catálogo: modelos, configuraciones y validación](docs/model-catalog.md) · [Video: receta, componentes, pruebas, comandos y límites](docs/video-validation.md) · [primera imagen real](docs/first-image-validation.md) · [idiomas](docs/languages.md) · [recursos](docs/resources.md).

---

## Registro de la entrega anterior


## Aplicación real · hito 1 (4 de noviembre de 2026)

La implementación está en `apps/` y `packages/`; `ui-prototype/` conserva la referencia original intacta. Funciona en navegador y Electron con el mismo servicio Bun/Fastify, SQLite, hardware real, temas y comprobación avanzada de ComfyUI existente. La generación y la preparación administrada están pendientes; no hay simulaciones de instalación o resultados.

Requisitos de desarrollo: **Bun 1.4.4 y Node 24.13.0** en PATH. Un único `bun.lock` en la raíz. Node es una herramienta de desarrollo y el runtime interno de Electron; el backend siempre ejecuta Bun.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
```

Abrir en navegador:

```bash
bun run start:web
```

Abrir la URL que imprime el lanzador en ese mismo equipo. El enlace autoriza una sesión, vence en 60 segundos y sólo se puede usar una vez. Ejecutar de nuevo el comando emite un enlace nuevo. La URL no tiene puerto fijo en producción. Ctrl+C cierra el servicio si este lanzador lo inició; cerrar una pestaña no lo detiene.

Abrir en escritorio, desde otra terminal o sin el navegador:

```bash
bun run start:desktop
```

Ambos se conectan al mismo servicio si usan el mismo directorio de datos. La apariencia guardada en Ajustes aparece en ambos clientes. Si se cierra el propietario del servicio, los demás clientes se desconectan y conservan sus borradores. No ejecutar las versiones Linux/WSL y Windows contra una misma base activa.

Desarrollo de la UI con Vite y proxy explícito:

```bash
bun run dev
```

Abrir el enlace autorizado que imprime para `http://127.0.0.1:43120`. Requiere un build previo de la UI. Usa el servicio fuente con Bun fijado, en 43121; cerrar un servicio de producción antes de iniciar este modo. Sólo loopback; no usar `--host 0.0.0.0`.

### Abrir las distribuciones sin instalar runtimes

Después del build, el lanzador web incluye su propio runtime y utiliza el mismo auxiliar que Electron. Mantener la carpeta `resources` junto al lanzador.

Linux / WSL con interfaz gráfica:

```bash
./build/browser/veltria-web
./release/linux-unpacked/veltria
```

El segundo comando requiere haber empaquetado con `bun run package:linux` o `bun run package:dir`. También se genera `release/Veltria-0.1.0.AppImage`; su ejecución directa depende de FUSE y de la distribución.

Windows PowerShell, tras el build nativo y empaquetado correspondientes:

```powershell
.\build\browser\veltria-web.exe
.\release\win-unpacked\Veltria.exe
```

Para desarrollo en Windows, primero `Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'` y usar los comandos `bun` anteriores. Para este checkout en WSL:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
export PATH="/home/rafao/.local/share/veltria-tools/bun-linux-x64:/home/rafao/.nvm/versions/node/v24.13.0/bin:$PATH"
```

### Comprobar y empaquetar

```bash
bun run test
bun x playwright install chromium
bun run test:ui
bun run package:linux
# En Windows, o con las herramientas de compilación cruzada disponibles:
bun run package:win
# Sólo carpeta ejecutable Windows, sin crear NSIS:
bun run package:win:dir
```

En Linux sin pantalla, usar `xvfb-run -a bun run test:ui`. `package:win` compila explícitamente el auxiliar Windows; `package:linux` debe ejecutarse en Linux. Las builds macOS requieren elegir el target Bun adecuado en el Mac antes de electron-builder. Ningún comando publica ni activa actualizaciones.

Consultar [estado y límites](docs/status.md) y [pruebas ejecutadas y pasos pendientes por plataforma](docs/validation.md). WSL/Xvfb, el servicio y el arranque/cierre del paquete Electron Windows nativo fueron comprobados; no equivalen a una validación visual de Windows o macOS ni a generación GPU.

---

## Documentación original de arquitectura y prototipo


Decisiones actualizadas el 3 de noviembre de 2026. Este paquete es el traspaso de arquitectura y diseño para Codex; incluye un prototipo navegable de UI en Vue, pero todavía no la aplicación de generación completa.

## Revisar la nueva interfaz

Abrir `ui-prototype/veltria.html` con doble clic para recorrer la propuesta sin instalar herramientas. Incluye temas Obsidian claro/oscuro, selección por tarea, perfiles, preparación y adaptaciones con datos de ejemplo claramente marcados. UI-PREVIEW.md describe el alcance, código y validación. La revisión móvil del 4 de noviembre está integrada en el mismo HTML: navegación inferior, descripción primero, controles táctiles y diálogos desplazables; consultar MOBILE-UI.md.

## Filosofía de producto

**Tú decides qué crear; Veltria prepara lo necesario.** La instalación, modelos, dependencias, LoRA y recuperación deben resolverse dentro de la aplicación para los perfiles admitidos. Una acción prepara el conjunto, con espacio/descarga y decisiones relevantes visibles, sin confirmar cada paso interno. Leer PHILOSOPHY.md antes de diseñar o implementar.

La conexión a un ComfyUI existente en los primeros hitos es una validación técnica. La primera entrega para principiantes requiere preparación administrada: no se considera cumplida la facilidad de uso por dejar un tutorial de instalación externa.

## Usar otros dispositivos de la red

Requisito aceptado: compartir Veltria con teléfono, tableta u otra computadora de la misma LAN/Wi-Fi, incluso sin salida a Internet cuando los perfiles estén preparados. El equipo principal conserva modelos, GPU, cola y resultados; los otros dispositivos usan el navegador. LOCAL-NETWORK.md define activación, emparejamiento y permisos. Ajustes muestra el flujo como función pendiente, sin abrir la red realmente.

## Stack acordado

- Interfaz compartida: Vue 3 + TypeScript + Vite, con CSS y variables semánticas para Obsidian oscuro/claro/sistema.
- Escritorio: Electron para Windows, Linux y macOS.
- Servicio local: Bun + TypeScript + Fastify, compartido entre navegador y escritorio.
- Persistencia: SQLite mediante bun:sqlite y archivos locales. Motor inicial: ComfyUI en un proceso separado.
- Bun workspaces, con bun.lock y sin una plataforma adicional para coordinar el monorepo.

Electron conserva su Node interno, pero el backend corre en un ejecutable Bun separado incluido en el paquete. No se exige instalar Bun o Node al usuario final. Mantener Fastify, comprobando su compatibilidad y la de sus plugins con Bun en el primer hito.

La web completa usa un servicio del equipo principal. Inicialmente se abre en ese mismo equipo; el incremento LAN permitirá usarla también desde dispositivos emparejados de la misma red. No requiere renderizado en la nube. Electron inicia el servicio automáticamente; el modo navegador lo inicia con un lanzador o comando. Una página estática sin servicio sólo puede mostrar una interfaz limitada, no instalar modelos ni detectar el hardware completo.

## Inicio con Codex

1. Extrae este paquete en la carpeta del proyecto.
2. Lee PHILOSOPHY.md, PROJECT.md, ARCHITECTURE.md, DESIGN.md, UI-PREVIEW.md y LOCAL-NETWORK.md; abre el prototipo y las imágenes de referencia en design/.
3. Si ya existe implementación de la etapa anterior, sigue MIGRATION.md; no sobrescribas el repositorio con este paquete.
4. Pega FIRST-TASK.md en Codex local. No necesita acceso a la conversación original.
5. Ejecuta las instrucciones de validación que deje para Windows y Linux. macOS permanece pendiente de pruebas reales.

## Hitos

1. UI compartida en navegador y Electron, servicio local real, hardware, SQLite, temas y conexión verificable a ComfyUI existente.
2. Primer flujo real de texto a imagen y biblioteca de resultados en ambas interfaces.
3. Preparación administrada de ComfyUI y de un perfil completo desde Veltria, con catálogo pequeño, descargas reanudables y verificación. Después, incorporar LoRA compatibles mediante un flujo propio comprobado.
4. Recomendación por tarea/hardware y comprobación local de perfiles.
5. Video, audio, motores adicionales y distribución ampliada.

Incremento 3B: uso compartido LAN, con emparejamiento y comprobación desde otro dispositivo sin salida a Internet; ver LOCAL-NETWORK.md. No amplía automáticamente FIRST-TASK.md.

La identidad sigue siendo Veltria/Obsidian. Las capturas son referencias conceptuales: sus cifras y controles no implican funciones implementadas. No generar recomendaciones o estados de conexión ficticios.

RESEARCH.md conserva los aprendizajes de Stability Matrix, InvokeAI, ComfyUI, SwarmUI y Pinokio. PHILOSOPHY.md rige la experiencia; ARCHITECTURE.md es la fuente vigente para las decisiones técnicas.
