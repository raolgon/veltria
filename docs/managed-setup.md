# Instalación administrada · hito 3

Implementación de desarrollo 0.10.0, protocolo 9, esquema de trabajos 4. No hay migración destructiva: se añaden tablas de estado, ubicación y autorizaciones del instalador a SQLite.

## Recorrido

Hasta contar con un vínculo y al menos un modelo preparado y verificado, la pantalla principal es la bienvenida (`WelcomeSetup.vue`): hardware real, modelo principal, una alternativa y otros modelos. No se montan el editor, la navegación ni las pestañas de creación. Revisar la instalación abre el plan dentro de esa pantalla, sin diálogo superpuesto. Seleccionar un modelo invalida la propuesta anterior y su consentimiento. La pregunta de reutilizar ComfyUI aparece sólo si existe una instalación utilizable; también se puede optar por un entorno propio. La autorización y el botón de instalar conservan descarga, espacio, ubicación y licencias. El progreso y la pausa permanecen en la bienvenida; tras preparar el modelo se muestra Crear. Al reabrir se consulta el catálogo del servicio. Video se identifica como experimental y se prepara por separado desde Crear.

Preparar mi equipo busca primero un motor existente. Si no encuentra uno utilizable, ofrece **Instalación propia de Kobocraft**. Revisar instalación no descarga ni ejecuta código. El plan reúne entorno y modelo seleccionado, tamaños pendientes, reserva de espacio, destinos, fuentes, licencias y bloqueos por recursos.

La ubicación inicial es `managed/<receta>` dentro del directorio de datos. Se puede elegir otra carpeta; el servicio añade `Veltria-managed/<receta>`. Revisar otra ubicación invalida la propuesta anterior. Los archivos anteriores se conservan. En Electron se ofrece selector nativo; en navegador la ruta pertenece al equipo del servicio.

Una aceptación autoriza instalar el entorno y preparar el modelo. La instalación comprueba los archivos, extrae Python y ComfyUI propios, instala dependencias sin red desde wheels verificados, comprueba CUDA y prepara el motor/modelo. Crear imagen es una acción posterior explícita.

Cuando se detecta otro ComfyUI, la opción por defecto sigue siendo reutilizarlo. Elegir explícitamente un entorno separado permite revisar su plan sin modificar el anterior. Esa elección forma parte de la revisión y de la autorización; cambiarla invalida el plan. No se habilita duplicar el motor por una omisión del cliente.

## Alertas de almacenamiento y permisos

Los planes incluyen avisos estructurados con carpeta afectada (entorno, modelos o datos), espacio disponible/requerido y gravedad. Poco margen (menos de 256 MiB o 10 % del presupuesto requerido, el mayor de ambos) advierte y permite continuar con consentimiento; presupuesto insuficiente, espacio desconocido o permisos insuficientes bloquean. Se reservan además 16 MiB para metadatos del entorno administrado. Las carpetas de entorno y modelos pueden cambiarse por separado desde el aviso. Revisar o cambiar una carpeta retira el consentimiento anterior y nunca continúa automáticamente.

La comprobación inicial es de sólo lectura. Después de autorizar se prueba escritura/sincronización/retirada de un temporal propio antes de descargar. Los errores durante la operación distinguen disco lleno (`ENOSPC`/`SQLITE_FULL`), cuota (`EDQUOT`), sólo lectura (`EROFS`) y permisos (`EACCES`/`EPERM`); conservan los archivos recuperables y ofrecen revisar. Si falla el guardado de estado en SQLite, el aviso identifica los datos de la aplicación. La app no eleva privilegios ni modifica ACL. [Criterios y límites](validation.md).

## Recetas fijadas

Windows/Linux x64 con NVIDIA: ComfyUI 0.35.0, CPython 3.12.12, uv 0.11.3, PyTorch 2.7.1, torchvision 0.22.1 y torchaudio 2.7.1. Windows usa las variantes `+cu126` del índice oficial de PyTorch (`comfy-0.35.0-py312-torch271-cu126-win-v2`). Las dependencias transitivas, URLs, tamaños y SHA-256 están fijados en `packages/core/src/managed/{linux,win}.json` (actualizables por mantenedores con `scripts/lock-managed.py`); no se resuelven versiones en el equipo del usuario. No se descargan controladores, nodos personalizados ni código de metadatos.

Fuentes: [ComfyUI](https://github.com/Comfy-Org/ComfyUI/tree/v0.35.0), [Python standalone](https://github.com/astral-sh/python-build-standalone/releases/tag/20251014), [uv](https://github.com/astral-sh/uv/releases/tag/0.11.3) y wheels de PyPI / PyTorch. La instalación offline con hashes sigue la [interfaz pip de uv](https://docs.astral.sh/uv/pip/compile/).

- Entorno Linux: 3.879.334.071 bytes (6.012.030.833 bytes con SD 1.5 si no hay archivos reutilizables).
- Entorno Windows CUDA v2: 3.517.429.712 bytes (5.650.126.474 bytes con SD 1.5 si no hay archivos reutilizables).

Los manifiestos son la autoridad de cifras y revisiones. Se reserva espacio adicional para extracción, copias y caché.

## Recuperación

La interfaz muestra porcentaje y bytes reales para las descargas del entorno y del modelo. Las fases de instalación y comprobación muestran actividad sin porcentaje y mensajes de etapa; no se asignan porcentajes artificiales a procesos sin una medida disponible. Durante la preparación administrada, el progreso del modelo proviene del mismo estado `creation.preparation` que se utiliza con motores reutilizados.

- Estado y autorización completa persistidos antes de comenzar.
- Descargas `.part`, Range cuando se admite, tamaño y SHA-256 antes de extraer o ejecutar.
- Pausa y cierres abruptos conservan los archivos verificados. Reabrir vuelve a pausa y requiere revisar el plan para continuar, sin descargar de nuevo los paquetes íntegros.
- Fallos de escritura/permisos muestran cómo liberar espacio o elegir otra carpeta. Si tampoco puede persistirse el error en SQLite, se conserva en memoria y el último estado activo persistido vuelve como pausa al reabrir.
- Un cambio de receta, configuración, vínculo o ubicación requiere nueva revisión.
- Las operaciones incompatibles quedan bloqueadas durante la instalación; el cierre de Electron detecta esta actividad.
- Los resultados y los modelos de otras instalaciones se conservan; no se instala sobre el ComfyUI externo.

API: `/api/v1/setup/managed`, `/setup/managed/plan`, `/setup/managed/prepare` y `/setup/managed/pause`. Sólo acepta destino y consentimiento; no acepta manifiestos, URLs o comandos proporcionados por el cliente.

## Validación

- **Automatizada (`tests/managed.bun.ts`, `tests/managed-recipes.test.ts`, `tests/storage-issues.test.ts`, `tests/setup.e2e.ts`, `tests/progress.e2e.ts`):** consentimiento, plan obsoleto, cambio y persistencia de destino, elección explícita de entorno separado, reanudación Range, hash incorrecto sin ejecutar instalador, errores de disco/cuota/sólo lectura/permisos, pausa/reapertura e imagen explícita. Estas fixtures no acreditan inferencia GPU.
- **Con hardware real:** el recorrido administrado completo pasó en Windows nativo con entorno/datos separados y en WSL (Ubuntu 24.04), incluida descarga verificada, pausa, cierres forzados durante extracción y dependencias, instalación offline (PyTorch eager sin exigir compilador C en Linux), comprobación CUDA, generación explícita SD 1.5 (512 × 512) y biblioteca tras reiniciar, además de prueba ACL real en Windows. No certifica Linux nativo, una VM limpia, macOS ni usabilidad con principiantes. [Validación](validation.md).
