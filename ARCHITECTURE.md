# Arquitectura de Veltria

Arquitectura implementada; las funciones futuras están identificadas como pendientes. [Estado](docs/status.md) y [próximo trabajo](FIRST-TASK.md).

## Responsabilidades

| Capa | Código | Responsabilidad |
| --- | --- | --- |
| UI compartida | `apps/ui` | Vue 3/TypeScript/Vite: vistas, borradores, controles y presentación de estado. |
| Escritorio | `apps/desktop` | Electron: ventana, supervisor, tema nativo y diálogos limitados. |
| Servicio local | `apps/local-service` | Bun/Fastify: API, autorización, preparación, trabajos y almacenamiento. |
| Dominio | `packages/core` | Perfiles, recetas, recomendaciones, límites y traducciones. |
| Contratos | `packages/contracts` | Zod para entradas/salidas y protocolo de proceso/API. |
| Adaptadores | `packages/adapters` | SQLite, archivos, hardware, recursos y ComfyUI. |
| Lanzadores/builds | `scripts` | Supervisor común, web standalone y compilación/empaquetado. |

ComfyUI ejecuta Python/PyTorch en un proceso separado. El servicio conversa con su API local; la UI no accede directamente al motor, archivos o SQLite. No hay un segundo backend en Electron ni una inferencia cloud.

## Arranque y ciclo de vida

Electron y el lanzador web inician el auxiliar compilado con Bun mediante `spawn`, argumentos separados y `shell:false`. El runtime está incluido. Electron mantiene Node para main/preload; no usa `utilityProcess` para el backend ni importa `bun:sqlite` en el renderer.

Un propietario por directorio de datos, protegido por `.service-lock`. El supervisor comprueba identidad y protocolo antes de adjuntarse. Secreto de arranque por stdin privado y respuesta de disponibilidad acotada por stdout; no secretos en argumentos. Puerto de producción asignado por el SO sobre `127.0.0.1`.

El navegador intercambia un nonce de un uso, válido 60 segundos, por sesión y retira el fragmento de la URL. Electron autoriza su ventana con la misma API. Cerrar la pestaña no detiene el servicio. El propietario hace cierre autenticado y espera al hijo; sólo termina forzosamente su proceso propio como respaldo. Un cliente adjunto no cierra el servicio ajeno. Electron comprueba trabajos activos antes del cierre. No se instala un servicio permanente del SO.

## API y eventos

Prefijo `/api/v1`; protocolo **9**. Los esquemas compartidos validan solicitudes y respuestas. Las rutas concretas se mantienen en `apps/local-service/src/server.ts`.

| Área | Rutas principales |
| --- | --- |
| Sesión/estado | `/session`, `/health`, `/identity`, `/activity` |
| Preferencias/equipo | `/settings`, `/hardware`, `/resources`, `/engine`, `/engine/check` |
| Búsqueda del motor | `/setup`, `/setup/scan`, `/setup/plan`, `/setup/prepare` |
| Entorno administrado | `/setup/managed`, `/setup/managed/plan`, `/setup/managed/prepare`, `/setup/managed/pause` |
| Modelos | `/catalog`, `/catalog/search`, `/catalog/browse`, `/catalog/adopt`, `/catalog/select` |
| Configuraciones/archivos | `/catalog/configurations`, `/catalog/configurations/:id`, `/catalog/storage`, `/catalog/storage/plan`, `/catalog/storage/remove` |
| Preparación de imagen | `/creation`, `/creation/plan`, `/creation/prepare`, `/creation/pause` |
| Imagen | `/jobs`, `/jobs/:id`, `/jobs/:id/cancel`, `/jobs/:id/reconcile`, `/artifacts/:id` |
| Video | `/video`, `/video/plan`, `/video/prepare`, `/video/pause`, `/video/jobs`, `/video/jobs/:id`, `/video/jobs/:id/cancel`, `/video/jobs/:id/reconcile`, `/video/artifacts/:id` |
| Notificaciones | `/events` mediante SSE |

`/control/launch` y `/control/shutdown` usan autorización de control, distinta de la sesión UI. SSE notifica cambios; la UI vuelve a consultar el estado. El adaptador recibe progreso de ComfyUI por WebSocket. Una desconexión no autoriza repetir una creación: se conservan IDs de solicitud y motor para reconciliar.

## Persistencia y archivos

Sólo el servicio abre SQLite mediante `bun:sqlite`. Esquema de trabajos **4**. Preferencias, selección, configuraciones, modelos descubiertos, preparación, trabajos y evidencia se guardan mediante repositorios del servicio. Las migraciones preservan datos y respaldan la base al actualizar esquemas anteriores; no se garantiza degradación a ejecutables antiguos.

Datos por defecto: `%LOCALAPPDATA%\Veltria` en Windows; `$XDG_DATA_HOME/veltria` o `~/.local/share/veltria` en Linux; `~/Library/Application Support/Veltria` en macOS. `VELTRIA_DATA_DIR` selecciona una raíz absoluta alternativa. No compartir SQLite activo entre Windows y Linux.

Pesos y resultados quedan fuera del paquete. Modelos en la ubicación configurada, con `checkpoints/` y `loras/`. Descarga a `.part`, Range cuando se admite y verificación de tamaño/SHA-256 antes de usar. La retirada revisa dependencias del catálogo y no borra resultados ni carpetas recursivamente.

Los PNG se validan contra las dimensiones solicitadas y se entregan por ID; los MP4 se validan, almacenan aparte y admiten rangos para reproducción. No hay lectura de rutas arbitrarias desde la API.

## Preparación, recetas y ejecución

La preparación actual localiza/reutiliza un ComfyUI existente, planifica componentes, autoriza una revisión, descarga/verifica y abre un proceso propio con rutas de modelos adicionales. No modifica paquetes o modelos externos. SDXL usa `--lowvram`; los nodos personalizados permanecen desactivados. Cambiar una configuración no vuelve a descargar pesos.

Los perfiles/recetas están incluidos o pasan las comprobaciones acotadas de descubrimiento; no se ejecutan workflows de terceros. Cada trabajo guarda perfil/revisión, configuración, dimensiones, pasos, CFG y semilla reales. La calidad por imagen se valida en contrato y dominio, sin modificar la configuración portable.

Imagen y video no se ejecutan a la vez. La cancelación se dirige al trabajo propio, sin interrupción global de motores ajenos. Un envío incierto se reconcilia, no se reenvía automáticamente.

La instalación administrada vive en `apps/local-service/src/managed.ts`, con manifiestos fijados en `packages/core/src/managed`, contratos compartidos y una sección del asistente Vue. Añade estado, ubicación y autorización persistidos en tablas propias de SQLite, sin cambiar el esquema de trabajos 4. Descarga/verifica el conjunto, instala desde wheels offline y comprueba CUDA antes de preparar el modelo. No introduce otro backend. El Python propio desactiva la importación opcional de Triton para evitar exigir compilador del sistema. [Recorrido y validación](docs/managed-setup.md).

Si existe otro motor, la instalación separada exige una elección explícita en el plan; esa decisión se incluye en su revisión y autorización. Windows fija wheels PyTorch `+cu126` de su índice oficial (receta v2), ya que los wheels PyPI Windows de la receta anterior eran CPU. Las URLs y hashes permanecen fijados en el servidor.

## Seguridad local

Loopback, Host/origen explícitos, sesión efímera, cookie HttpOnly/SameSite Strict, CSRF en mutaciones y límites de entrada/respuesta. No CORS wildcard, listeners LAN o recursos JavaScript remotos. Los secretos no se guardan en la UI ni en logs.

Electron usa `nodeIntegration:false`, `contextIsolation:true` y `sandbox:true`; el preload expone diagnósticos inmutables y un selector de carpeta específico con validación del emisor. No fs, shell o IPC genérico. Descargas y navegación externa se limitan a los casos permitidos por main.

Prompts, nombres, metadatos y JSON son datos no confiables. Los manifiestos no aportan comandos ejecutables. Instalar código o modificar un motor externo requiere un plan y autorización específicos.

## Hardware, distribución y pendientes

Detección en el host del servicio con fuentes y valores desconocidos. CPU/RAM/disco de WSL corresponden a ese entorno; la GPU puede proceder del host Windows. No sumar RAM y VRAM ni atribuir recursos al navegador. Recomendaciones y evidencia tienen alcance por equipo, receta y ajustes.

UI estática incluida, auxiliar fuera de ASAR y lanzador web standalone. Un único lockfile de producto. Desarrollo Vite con proxy explícito en 43120/43121, distinto del servicio de producción. Scripts de build y comandos vigentes en [validación](docs/validation.md).

LAN requiere otro transporte autenticado sobre estos mismos servicios y permisos, según [LOCAL-NETWORK.md](LOCAL-NETWORK.md); todavía no hay listener ni emparejamiento. macOS, instalador firmado, autoactualizaciones, audio y workflows arbitrarios siguen pendientes.
