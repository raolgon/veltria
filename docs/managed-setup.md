# Instalación administrada · hito 3

Implementación de desarrollo 0.10.0, protocolo 9, esquema de trabajos 4. No hay migración destructiva: se añaden tablas de estado, ubicación y autorizaciones del instalador a SQLite.

## Recorrido

Hasta contar con un vínculo y al menos un modelo preparado y verificado, la pantalla principal es la bienvenida de la propuesta 3: hardware real, modelo principal, una alternativa y otros modelos. No se montan el editor, la navegación ni las pestañas de creación. Revisar la instalación abre el plan dentro de esa pantalla, sin diálogo superpuesto. Seleccionar un modelo invalida la propuesta anterior y su consentimiento. La pregunta de reutilizar ComfyUI aparece sólo si existe una instalación utilizable; también se puede optar por un entorno propio. La autorización y el botón de instalar conservan descarga, espacio, ubicación y licencias. El progreso y la pausa permanecen en la bienvenida; tras preparar el modelo se muestra Crear. Al reabrir se consulta el catálogo del servicio. Video se identifica como experimental y se prepara por separado desde Crear.

Preparar mi equipo busca primero un motor existente. Si no encuentra uno utilizable, ofrece **Instalación propia de Veltria**. Revisar instalación no descarga ni ejecuta código. El plan reúne entorno y modelo seleccionado, tamaños pendientes, reserva de espacio, destinos, fuentes, licencias y bloqueos por recursos.

La ubicación inicial es `managed/<receta>` dentro del directorio de datos. Se puede elegir otra carpeta; Veltria añade `Veltria-managed/<receta>`. Revisar otra ubicación invalida la propuesta anterior. Los archivos anteriores se conservan. En Electron se ofrece selector nativo; en navegador la ruta pertenece al equipo del servicio.

Una aceptación autoriza instalar el entorno y preparar el modelo. La instalación comprueba los archivos, extrae Python y ComfyUI propios, instala dependencias sin red desde wheels verificados, comprueba CUDA y prepara el motor/modelo. Crear imagen es una acción posterior explícita.

Cuando se detecta otro ComfyUI, la opción por defecto sigue siendo reutilizarlo. Elegir explícitamente un entorno separado permite revisar su plan sin modificar el anterior. Esa elección forma parte de la revisión y de la autorización; cambiarla invalida el plan. No se habilita duplicar el motor por una omisión del cliente.

## Alertas de almacenamiento y permisos

Los planes incluyen avisos estructurados con carpeta afectada (entorno, modelos o datos), espacio disponible/requerido y gravedad. Poco margen advierte; presupuesto insuficiente, espacio desconocido o permisos insuficientes bloquean. Las carpetas de entorno y modelos pueden cambiarse por separado desde el aviso. Revisar o cambiar una carpeta retira el consentimiento anterior y nunca continúa automáticamente.

La comprobación inicial es de sólo lectura. Después de autorizar se prueba escritura/sincronización/retirada de un temporal propio antes de descargar. Los errores durante la operación distinguen disco lleno, cuota, sólo lectura y permisos; conservan los archivos recuperables y ofrecen revisar. Si falla el guardado de estado en SQLite, el aviso identifica los datos de Veltria. La app no eleva privilegios ni modifica ACL; las denegaciones de permisos de las pruebas se limitan a carpetas desechables. [Criterios, prueba ACL Windows y límites](validation.md).

## Recetas fijadas

Windows/Linux x64 con NVIDIA: ComfyUI 0.35.0, CPython 3.12.12, uv 0.11.3, PyTorch 2.7.1, torchvision 0.22.1 y torchaudio 2.7.1. Windows usa explícitamente las variantes `+cu126` del índice oficial de PyTorch, receta `comfy-0.35.0-py312-torch271-cu126-win-v2`. La receta Windows v1 apuntaba a los wheels CPU de PyPI y fue corregida antes de validar instalación GPU; no debe reutilizarse como prueba de CUDA. Linux conserva su receta v1 ya comprobada. Las dependencias transitivas, URLs, tamaños y SHA-256 están fijados en `packages/core/src/managed/{linux,win}.json`; no se resuelven versiones en el equipo del usuario. No se descargan controladores, nodos personalizados ni código de metadatos.

Fuentes: [ComfyUI](https://github.com/Comfy-Org/ComfyUI/tree/v0.35.0), [Python standalone](https://github.com/astral-sh/python-build-standalone/releases/tag/20251014), [uv](https://github.com/astral-sh/uv/releases/tag/0.11.3) y wheels de PyPI. La instalación offline con hashes sigue la [interfaz pip de uv](https://docs.astral.sh/uv/pip/compile/).

El entorno Linux representa 3.879.334.071 bytes de descarga; con SD 1.5, 6.012.030.833 bytes. Se reserva espacio adicional para extracción, copias y caché. Windows tiene otro conjunto de wheels. Los manifiestos son la autoridad de cifras y revisiones.

La receta Windows CUDA v2 suma 3.517.429.712 bytes de entorno (5.650.126.474 con SD 1.5 si no hay archivos reutilizables). Su instalación y generación GPU se comprobaron en el entorno Windows separado de D:; no se extrapola esa prueba a otros equipos.

## Recuperación

La interfaz muestra porcentaje y bytes reales para las descargas del entorno y del modelo. Las fases de instalación y comprobación muestran actividad sin porcentaje y mensajes de etapa; no se asignan porcentajes artificiales a procesos sin una medida disponible. Durante la preparación administrada, el progreso del modelo proviene del mismo estado `creation.preparation` que se utiliza con motores reutilizados.

- Estado y autorización completa persistidos antes de comenzar.
- Descargas `.part`, Range cuando se admite, tamaño y SHA-256 antes de extraer o ejecutar.
- Pausa/cierre conservan los archivos. Reabrir no instala automáticamente: se revisa el plan para continuar.
- Se comprobó SIGKILL durante extracción e instalación de dependencias en Veltria-Lab: al reabrir se presenta pausa y la continuación reejecuta la instalación con los paquetes verificados conservados; no exige descargar de nuevo el entorno.
- Fallos de escritura/permisos muestran cómo liberar espacio o elegir otra carpeta. Si tampoco puede persistirse el error en SQLite, se conserva en memoria y el último estado activo persistido vuelve como pausa al reabrir.
- Un cambio de receta, configuración, vínculo o ubicación requiere nueva revisión.
- Las operaciones incompatibles quedan bloqueadas durante la instalación; el cierre de Electron detecta esta actividad.
- Los resultados y los modelos de otras instalaciones se conservan; no se instala sobre el ComfyUI externo.

API: `/api/v1/setup/managed`, `/setup/managed/plan`, `/setup/managed/prepare` y `/setup/managed/pause`. Sólo acepta destino y consentimiento; no acepta manifiestos, URLs o comandos proporcionados por el cliente.

## Validación

Fixtures: consentimiento, disco insuficiente, plan obsoleto, cambio/persistencia de destino, respuesta Range, hash incorrecto sin ejecutar instalador, pausa/reapertura, preparación sin generar e imagen explícita con biblioteca persistente. Estas pruebas no acreditan inferencia.

La prueba real optativa se ejecuta con `scripts/validate-managed-lab.py --authorize-managed-lab` desde el Python de Ubuntu, tras compilar `build/lab/veltria-service`. Usa exclusivamente datos en `/home/veltria/lab/hito3-20261109`, dentro de Veltria-Lab en D; requiere autorización previa del plan completo. Los resultados se conservan en `build/lab/validated-managed.json`, junto al plan y al PNG. Consultar [validación](validation.md) para el resultado observado.

La instalación completa en Veltria-Lab pasó, incluida inferencia SD 1.5 y reapertura de la biblioteca. El Python propio desactiva los kernels Triton opcionales para usar PyTorch eager sin exigir compilador C. El entorno externo no se modifica.

El 10 de noviembre se repitió el recorrido desde la bienvenida de producción en `/home/veltria/lab/acceptance-hito3-20261110`, recuperando dos cierres forzados reales, creando una imagen GPU y comprobándola en Biblioteca tras reiniciar. Registro `build/lab/hito3-acceptance-20261110.json`. Los paquetes del entorno procedían de la caché verificada; el modelo se descargó de nuevo. Los errores de espacio/permisos tienen pruebas de recuperación acotadas, no una certificación de todo sistema de archivos. [Alcance exacto](validation.md).

Windows nativo completó su prueba específica el 10 de noviembre con la receta CUDA v2: entorno y datos separados en D:, descarga verificada, instalación offline, pausa y dos cierres forzados, imagen real y biblioteca tras reiniciar. Comparte SO/GPU con el host, no es una VM ni un Windows limpio. [Prueba Windows](windows-lab.md). WSL no certifica Linux nativo ni macOS. La usabilidad con una persona nueva sigue pendiente.
