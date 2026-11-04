> Entrega actual: [Veltria 0.4, catálogo de modelos y configuraciones](model-catalog.md). [Video experimental de 0.3](video-validation.md). Se conservan debajo las comprobaciones históricas del hito 1.

# Estado de Veltria · hito 1

> Registro histórico del hito 1. La versión actual 0.2 incorpora primera imagen, preparación y biblioteca: consultar [estado y validación actuales](first-image-validation.md).


Implementación del 4 de noviembre de 2026. El prototipo y las referencias originales se conservan en `ui-prototype/` y `design/`. La aplicación ejecutable está en `apps/`. No se utilizaron subagentes.

## Funciona

- Una UI Vue 3/TypeScript/Vite para navegador y Electron: Crear, Mi equipo y Ajustes. Reutiliza tokens, composición, ilustración propia, controles y adaptación móvil Obsidian del prototipo.
- Temas Sistema/Claro/Oscuro inmediatos. SQLite es la autoridad; el navegador mantiene sólo una caché visual y un borrador por pestaña. Eventos SSE reconcilian preferencias entre clientes; Electron refleja el tema en `nativeTheme`.
- Servicio Fastify sobre Bun, independiente de Electron, API `/api/v1`, build estático servido exclusivamente en `127.0.0.1`. Vite usa un proxy explícito en desarrollo.
- Autorización de lanzamiento por nonce de un solo uso (60 segundos), cookie HttpOnly/SameSite Strict, sesiones efímeras de 12 horas, CSRF y validación de Host, origen y entradas. Sin CORS wildcard. El fragmento de apertura se retira del historial antes de otras peticiones. Cookie sin Secure porque el transporte es HTTP loopback; no hay modo LAN.
- Supervisor compartido por lanzadores y escritorio. Ejecutable auxiliar separado mediante `spawn`, argumentos separados, `shell:false`, secreto por stdin privado, respuesta de identidad acotada por stdout. Puerto de producción asignado por el SO. Directorio de datos exclusivo, recuperación de bloqueo de un PID muerto y conexión a una instancia existente tras verificar su identidad y control.
- Cierre del auxiliar propio por HTTP autenticado, con espera y terminación de respaldo limitada al hijo propio. Un cliente que se conecta a un servicio existente no lo cierra. Cerrar una pestaña conserva el servicio. Cerrar el propietario desconecta a los demás clientes.
- SQLite mediante `bun:sqlite`, repositorio exclusivo del servicio, migración versionada, transacciones y rechazo de esquemas futuros. Base y modelos/resultados futuros fuera de los recursos instalados.
- Hardware del host: CPU, RAM total/disponible, disco del directorio de datos, GPU/controlador/VRAM cuando NVIDIA responde. Windows usa CIM como alternativa de identidad; Linux usa PCI como alternativa. Se indican fuentes, desconocidos y WSL, sin sumar memorias ni atribuir al navegador la detección.
- Ruta avanzada para una instalación local existente de ComfyUI: guardar/retirar dirección, comprobar `/system_stats` y `/object_info`, listar nodos, dispositivos y modelos declarados. Sólo HTTP loopback literal; localhost se fija a 127.0.0.1; no se siguen redirecciones ni se escanea la red. Tiempo y tamaño de respuesta acotados. No modifica archivos, nodos, paquetes ni modelos del motor.
- Electron: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, permisos denegados y navegación externa bloqueada. Preload sólo expone dos diagnósticos inmutables de aislamiento; no hay IPC genérico, shell ni acceso a archivos.
- Configuración electron-builder para Linux AppImage, Windows NSIS y extensión macOS. UI incluida y auxiliar fuera de ASAR. Lanzador web compilado separado, sin requerir Bun/Node en el equipo del usuario final.

## Límites de producto

No hay perfiles de creación preparados en este hito. La apariencia y la conexión guardada son las preferencias compartidas comprobadas; no se inventa un perfil para demostrarlo. No se instala, descarga, recomienda ni genera nada. Los datos de ejemplo, temporizadores y escenarios del prototipo no forman parte del comportamiento de producción.

Hito 2 pendiente: una generación real mínima de texto a imagen, propiedad/cancelación de su trabajo, estado persistente y biblioteca de resultados. La ilustración de bienvenida no es una generación.

Hito 3 pendiente: preparación administrada del motor y un perfil completo con una acción, plan de espacio/descarga, verificación y recuperación. Después, LoRA con compatibilidad explícita. La comprobación de ComfyUI existente es una integración técnica avanzada y todavía exige una instalación externa; **no cumple aún la incorporación para principiantes de PHILOSOPHY.md**. Tampoco se ha realizado una prueba de usabilidad de primera creación.

Incremento 3B pendiente: emparejamiento y acceso LAN/offline desde otro dispositivo. No se abre firewall ni listener LAN. Video/audio, nube, cuentas, telemetría, plugins y actualizaciones quedan fuera de este hito.

## Distribución y datos

- Desarrollo requiere Bun **1.4.4** y Node **24.13.0** para Electron, Playwright, Vitest y electron-builder. Node no ejecuta el backend. Un solo `bun.lock` para el workspace; no se modifica el paquete independiente del prototipo.
- `build/service/veltria-service[.exe]`: auxiliar compilado con runtime Bun.
- `build/browser/veltria-web[.exe]` junto a `resources/`: distribución web local; imprime la URL autorizada. No separar el ejecutable de sus recursos.
- `release/linux-unpacked/` y AppImage: distribución Electron Linux; Windows dispone de `release/win-unpacked/Veltria.exe`; NSIS está configurado pero no se completó en este host por falta de Wine. No se conserva un instalador incompleto. El resultado de cada plataforma se registra en [validation.md](validation.md).
- Datos: Windows `%LOCALAPPDATA%\Veltria`; Linux `$XDG_DATA_HOME/veltria` o `~/.local/share/veltria`; macOS `~/Library/Application Support/Veltria`. `VELTRIA_DATA_DIR` permite un directorio absoluto alternativo. WSL y Windows son entornos distintos con bases independientes; no compartir una base activa entre ellos.
- El directorio de datos y el descriptor de control se crean con permisos de propietario en POSIX; en Windows heredan las ACL del perfil. No colocar los datos en carpetas compartidas. Las sesiones no se guardan en SQLite.
- Si un cierre forzado ocurre antes de escribir el descriptor del bloqueo, se informa del conflicto: verificar que no quede un auxiliar y retirar **únicamente** `.service-lock`, conservando SQLite. Si muere el supervisor de forma forzada, el servicio puede sobrevivir; se puede volver a conectar. No se instala un servicio permanente del SO.

Las plataformas y pruebas pendientes se detallan en [validation.md](validation.md). No hay publicación, firma con credenciales ni CI activada.

## ComfyUI existente: comprobación posterior

El 4 de noviembre se conectó el servicio Windows de Veltria a la instalación ya presente en `D:\pinokio\api\minimax-h3-pinokio.git\app`: ComfyUI 0.35.0, API disponible, RTX 4050, 923 tipos de nodo y 10 entradas de modelos. La dirección local quedó guardada. No se instaló otro motor ni se descargaron pesos. Se desactivaron los nodos personalizados para la prueba; no se realizó generación. Ver [evidencia y límites](comfy-existing.md).
