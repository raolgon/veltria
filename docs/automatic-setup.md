# Preparación inicial automática · Veltria 0.5

**Crear → Preparar mi equipo → revisar propuesta → autorizar → Crear imagen.** Una persona puede conservar su descripción y formato durante toda la preparación. Ya no necesita introducir una ruta de Python para vincular una instalación existente.

## Qué hace la app

1. Busca instalaciones existentes mediante el servicio local. El progreso de búsqueda es indeterminado: no hay porcentajes ni tiempos ficticios.
2. Localiza ComfyUI y su entorno, presenta una opción inicial y permite elegir otra si hay varias. Una instalación ya vinculada tiene prioridad en la búsqueda general; elegir una carpeta explícita busca en esa carpeta y no vuelve silenciosamente a la anterior.
3. Revisa modelo/configuración elegidos, ubicación, descarga pendiente, espacio y margen, fuente/licencia y cambios propuestos. Conserva cualquier elección anterior de modelo o configuración.
4. Una autorización explícita permite reutilizar la instalación y preparar el conjunto mostrado. Sólo entonces guarda el vínculo, verifica o descarga los pesos y abre un proceso propio supervisado. Los modelos y ajustes externos se conservan. No instala ni actualiza ComfyUI, Python, dependencias ni nodos personalizados.
5. Al terminar, la acción permite crear la imagen. Preparar nunca inicia una generación automáticamente.

La búsqueda por sí sola **no ejecuta Python ni modifica preferencias**. «Archivos localizados» no significa entorno arrancado, y «preparado» no significa inferencia comprobada. La preparación comprueba el arranque real y las capacidades del motor. La generación terminada aporta evidencia de ejecución.

## Dónde busca y qué comprueba

Windows: instalación vinculada, carpetas habituales del usuario (incluidas Descargas/Documentos/Escritorio), ubicaciones conocidas de ComfyUI y versiones portables, carpetas `pinokio/api` de unidades locales fijas y configuración local de ComfyUI Desktop cuando está disponible. Las unidades se consultan con una orden PowerShell fija, sin interpolar rutas del usuario.

Linux: instalación vinculada, carpetas habituales del usuario, `/opt`, `/srv` y Pinokio en esas ubicaciones. En WSL no propone un Python de Windows como ejecutor Linux: explica que para reutilizar el entorno Windows se debe abrir la app nativa de Windows.

Se comprueban la estructura de archivos, opciones requeridas de ComfyUI, disponibilidad de cancelación por trabajo y un intérprete del sistema adecuado en `.venv`, `venv`, `env` o `python_embeded`/`python_embedded`, según plataforma. Se conserva el Python explícito de un vínculo previo compatible. No se utiliza un Python global encontrado por casualidad en PATH.

La búsqueda es acotada: hasta 220 ubicaciones candidatas, 100 entradas por carpeta `api` y 16 resultados; se deduplican ubicaciones canónicas y se informa cuando se alcanza un límite. Las comprobaciones de candidatos tienen un presupuesto de tiempo de 15 s, revisado entre operaciones de archivos; no se promete cancelar inmediatamente una llamada de E/S bloqueada por el sistema operativo. No se recorre recursivamente todo el disco. La configuración Desktop tiene un límite de 32 KiB y el código consultado para las capacidades de cancelación, 256 KiB. Su contenido se trata como datos, no como instrucciones.

## Recuperación sin buscar Python

**Buscar en otra carpeta** permite elegir la carpeta de ComfyUI, de la distribución portable o de Pinokio. Electron abre un selector nativo. En navegador se puede pegar una sola carpeta absoluta del equipo del servicio. Las rutas técnicas quedan en detalles opcionales. Si no hay una instalación utilizable, se indica que la instalación administrada del motor sigue pendiente; no se inventa una solución ni se descarga otro motor.

Si cambia el modelo/configuración, el vínculo, la ubicación o los archivos relevantes después de revisar, la propuesta debe revisarse de nuevo. Las propuestas caducan a los 10 minutos y se descartan al reiniciar o iniciar otra búsqueda. Las diferencias de apariencia/idioma no invalidan la preparación. La búsqueda puede repetirse; un fallo de disco o compatibilidad bloquea la preparación antes de adoptar el vínculo.

Una preparación iniciada conserva la persistencia, pausa y recuperación existentes de los pesos. El vínculo aceptado se guarda en SQLite, por lo que al reiniciar no es necesario localizar de nuevo una instalación que sigue siendo válida. La búsqueda y sus propuestas son temporales; no se añade otra base ni un segundo servicio.

## Frontera de procesos

Bun/Fastify conserva la detección y las reglas, con sesión local, origen, CSRF y validación estricta. API nueva:

- `GET /api/v1/setup`: estado de la búsqueda compartido.
- `POST /api/v1/setup/scan`: búsqueda general o una carpeta absoluta.
- `POST /api/v1/setup/plan`: propuesta para un ID de instalación de esa búsqueda.
- `POST /api/v1/setup/prepare`: autorización de la revisión concreta.

Los clientes se actualizan por SSE. Los cambios de vínculo/preparación se serializan con los trabajos de imagen/video existentes. El servidor conserva la autoridad sobre los IDs: la autorización no acepta un ejecutable Python arbitrario enviado por el cliente.

El preload de Electron añade únicamente `chooseEngineDirectory()`: canal fijo, selector de carpetas, sin argumentos para ejecutar comandos ni acceso genérico a IPC o archivos. Main comprueba renderer, frame principal y origen del servicio. Se mantienen sandbox, aislamiento de contexto y ausencia de Node en la UI.

## Distribución y comandos

Versión **0.5.0**, protocolo **6**, SQLite **4**. No se modifica el esquema ni se eliminan datos. Cerrar una versión anterior antes de abrir esta entrega. Los paquetes anteriores se conservan en sus carpetas.

Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.5.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime
.\build\browser\0.5.0\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.5.0/linux-unpacked/veltria
./build/browser/0.5.0/veltria-web
```

El monitor lateral muestra también los nombres detectados de CPU y GPU en letra pequeña, con el nombre completo al pasar el cursor. RAM y VRAM conservan sus lecturas habituales; en la barra estrecha los nombres siguen en el detalle accesible.

## Validación

Resultados de esta entrega:

- Lockfile congelado y tipos: correctos.
- `bun run test`: **17 pruebas Vitest, 21 pruebas Bun (177 aserciones) y 83 comprobaciones HTTP** sobre servicio fuente y compilado. Las seis pruebas nuevas de detección/preparación comprueban Linux/venv, portable/Pinokio en otra unidad, enlaces duplicados, ausencia de Python adecuado, búsqueda de sólo lectura, consentimiento, conservación de ajustes, propuesta obsoleta por cambios de modelo/configuración/ubicación/archivos, falta de espacio y generación con la instalación seleccionada.
- Playwright sobre el paquete Electron Linux/Xvfb: **15 recorridos correctos**, con regresión de interfaz, temas/idiomas, recursos, catálogo, imagen y video. Los **tres recorridos nuevos** verifican la primera preparación en español, varias instalaciones, cambio de propuesta que invalida el consentimiento, descripción/formato conservados, descarga y creación con fixture; recuperación mediante carpeta en inglés/móvil; y el selector nativo a través del IPC real de Electron con renderer aislado. El diálogo del SO se sustituye en esta prueba por una respuesta controlada para no abrir ventanas de selección manual. Las fixtures no prueban inferencia GPU.
- Auxiliar, lanzador web y escritorio empaquetado nativos de Windows: correctos, incluidos HTTP/CSRF/SSE, SQLite, catálogo, preferencias, recursos reales y cierre de ventana WM_CLOSE sin dejar el auxiliar propio. Datos de prueba separados de los habituales.
- **Prueba real Windows sin introducir rutas del motor ni Python:** `tests/windows-setup-preflight.ps1` encontró automáticamente `D:\pinokio\api\minimax-h3-pinokio.git\app` y su `env\Scripts\python.exe`. La propuesta no guardó el vínculo antes de la autorización. Reutilizó el SD 1.5 de `D:\Veltria\models`, comprobó SHA-256 sin descargar pesos, preparó ComfyUI 0.35.0 y confirmó que todavía no había generado ninguna imagen. Tras solicitar Crear, terminó una imagen **512 × 512, 20 pasos, CFG 7**, con la descripción del test. Cerró únicamente su auxiliar/motor y liberó el bloqueo.

Evidencia nativa conservada en `%LOCALAPPDATA%\Veltria\setup-validation-20261105-134032`, registro `validated-setup.json`, resultado `creations\7d020afb-63e4-49d0-b408-f8bc3be4930c.png`. Las imágenes y preferencias habituales no se modificaron; se usó una carpeta de validación separada.

Pruebas reproducibles:

```bash
bun install --frozen-lockfile --ignore-scripts
bun run typecheck
bun run build
bun run test
bun scripts/build.ts --target=bun-windows-x64-baseline
bun x electron-builder --linux AppImage --dir --win --dir --x64 --publish never
VELTRIA_ELECTRON_EXECUTABLE="$PWD/release/0.5.0/linux-unpacked/veltria" xvfb-run -a bun run test:ui
```

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1 -Executable "$PWD\release\0.5.0\win-unpacked\Veltria.exe"
# Valida búsqueda automática y crea una imagen con pesos ya presentes; rechaza cualquier descarga:
.\tests\windows-setup-preflight.ps1 -ModelsDirectory 'D:\Veltria\models'
```

Pendiente: Linux nativo con GPU y una instalación real distinta de las fixtures; instalación Desktop completa con entorno válido; otras distribuciones/ubicaciones fuera de las revisadas; inspección completa del diálogo nativo Windows con ratón/teclado; macOS, empaquetado y ejecución. Siguen pendientes la instalación administrada de motores, descarga/inferencia real de DreamShaper y la inferencia H3 en este equipo. Esta entrega no amplía esas funciones.
