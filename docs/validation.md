# Validación y límites

## Almacenamiento y permisos ampliados · 10 noviembre 2026

La preparación distingue errores de espacio (`ENOSPC` y `SQLITE_FULL`), cuota (`EDQUOT`), sólo lectura (`EROFS`) y permisos (`EACCES`/`EPERM`). Cada aviso identifica la carpeta y si corresponde al entorno, modelos o datos. El plan comprueba permisos sin escribir, reserva el presupuesto conjunto cuando entorno/modelos comparten unidad y bloquea si no alcanza o no se puede comprobar. Si queda menos de 256 MiB o el 10 % del presupuesto requerido, el mayor de ambos, muestra una advertencia que permite continuar con consentimiento. Se reservan además 16 MiB para metadatos del entorno administrado; no es una garantía frente a cambios posteriores del disco.

Después de autorizar se prueba crear, escribir, sincronizar y retirar un archivo temporal propio antes de descargar en cada carpeta. Los fallos posteriores conservan los archivos recuperables y requieren revisión para continuar. Cambiar la carpeta de modelos o entorno invalida el consentimiento. No se elevan privilegios ni se cambian permisos del usuario desde la app. Un fallo al persistir el error en SQLite queda visible en memoria y el estado activo anterior se recupera como pausa tras reiniciar.

Pruebas: **41 Vitest**, **14 casos de instalación administrada y 18 de creación/búsqueda**, **4 recorridos Playwright** (incluyen advertencia, bloqueo, cambio de carpeta, consentimiento y ancho de 320 px), typecheck y compilación Linux/Windows. También pasó el smoke nativo Windows del servicio compilado (HTTP, sesión, SSE, SQLite y reapertura). Los casos de cuota y sólo lectura se inyectan; Linux/WSL usa denegación real con `chmod` y `/dev/full`. No se llenó una unidad del usuario. La suite administrada también cubre pérdida de permisos de modelos mientras se descarga el entorno, recuperación sin redescargar sus paquetes y disco de metadatos lleno al guardar la autorización, sin iniciar la descarga.

**ACL real en Windows nativo: aprobado.** `tests/windows-storage-permissions.ps1` usa el comprobador compilado de la app en una carpeta desechable de D:, deniega escritura al usuario actual, comprueba `permission-denied`, restaura su ACL y verifica recuperación, conservación de un archivo existente y ausencia de temporales del comprobador. Informe: `D:\Veltria\lab\storage-permissions-2d87660789c841f298c7491461bfe502\report.json`. No se tocaron las ACL de instalaciones existentes. Repetición: compilar `scripts/storage-permission-probe.ts` para `bun-windows-x64-baseline` y pasar su ruta a `tests/windows-storage-permissions.ps1 -Probe`. ExecutionPolicy Bypass se limita al proceso de prueba.

Criterios cubiertos: aviso preventivo y bloqueo; clasificación de errores; recuperación tras revisar; permisos reales Windows/WSL; carpeta correcta; consentimiento renovado; datos existentes preservados. Siguen pendientes Linux nativo, usabilidad con una persona nueva y otros equipos/sistemas de archivos. Esta ampliación no certifica todas las ACL, cuotas o discos extraíbles ni cierra por sí sola el hito 3.

## Windows nativo con entorno y datos separados · 10 noviembre 2026

**Aprobado** en `D:\Veltria\lab\windows-native-20261110`, con el alcance elegido por el usuario: Python, ComfyUI, modelos, cachés, temporales y datos propios, compartiendo Windows 11 Home y la RTX 4050 del host. No es Windows Sandbox ni una VM/instalación limpia del SO. Se descargaron **3.517.429.712 bytes** de entorno CUDA y se verificó una copia local de SD 1.5; no hubo descarga nueva de pesos ni instalación sobre los ComfyUI habituales.

Pasaron la elección explícita de entorno separado, consentimiento, pausa durante descarga y reapertura, cierre forzado del árbol de procesos durante extracción y otro durante dependencias, revisión/continuación, instalación offline y comprobación CUDA. Cada cierre se recuperó como pausa; los paquetes conservados no se descargaron otra vez. Preparar mantuvo cero trabajos y el editor bloqueado hasta terminar.

Desde la UI web de producción se creó expresamente un PNG real de **512 × 512, 20 pasos, CFG 7**. El log confirma `pytorch version: 2.7.1+cu126` y dispositivo `cuda:0 NVIDIA GeForce RTX 4050 Laptop GPU`. Tras cerrar y reabrir el servicio, Biblioteca mostró el mismo trabajo y PNG, sin duplicarlos. Se inspeccionó visualmente el resultado. ComfyUI usó su ModelPatcher anterior a DynamicVRAM; el resultado no certifica otros tamaños ni versiones.

Se corrigieron dos problemas detectados al probar: la receta Windows usaba wheels PyPI CPU y ahora fija los CUDA oficiales con hashes (v2); el servicio bloqueaba la opción de entorno propio cuando había otro ComfyUI y ahora admite esa elección explícita, la muestra y la incorpora a la revisión del plan. Por defecto sigue proponiendo reutilización, y cambiar la elección invalida la revisión anterior. Las huellas contrastadas de los archivos principales externos y del SD 1.5 original no cambiaron.

Evidencia: `build/lab/validated-managed-windows.json` (`passed`, `fixture: false`), `build/lab/first-managed-windows-image.png`, registros en `D:\Veltria\lab\windows-native-20261110\reports` y log de su motor. [Detalle, repetición y límites](windows-lab.md).

Comprobaciones: **33 Vitest, 33 Bun (274 aserciones), 83 HTTP fuente/compilado, 3 recorridos UI, typecheck**, más el smoke nativo Windows del servicio/sesión/SQLite/SSE. La ejecución GPU fue nativa Windows; las suites generales de Bun/Vitest y Playwright de fixtures se ejecutaron en Ubuntu/WSL. No se presentan esas fixtures como inferencia Windows ni se certifica el paquete Electron firmado. Linux nativo y usabilidad con una persona nueva siguen pendientes.

## Aceptación de recuperación y recorrido completo · 10 noviembre 2026

**Aprobada en Veltria-Lab/WSL**, con datos nuevos en `/home/veltria/lab/acceptance-hito3-20261110/data`, separados de la prueba manual. Se partió sin Python/ComfyUI instalados en ese destino y sin modelo. Se copiaron únicamente los 102 paquetes de descarga del entorno, 3.879.334.071 bytes, desde la caché del ensayo anterior; el instalador volvió a verificar sus hashes. SD 1.5 se descargó de nuevo, 2.132.696.762 bytes, dentro del plan Linux previamente autorizado. No es una descarga nueva de todo el entorno por red.

Todas las decisiones normales se ejecutaron desde la bienvenida de producción: revisar plan, aceptar, instalar y continuar después de los fallos. Se provocó `SIGKILL` del servicio de aceptación y sus descendientes durante la extracción y durante la instalación de dependencias. En ambas reaperturas apareció estado `paused`, el editor permaneció oculto y no hubo continuación automática; se revisó y autorizó el plan otra vez, reutilizando los archivos verificados. La tercera ejecución completó instalación offline, comprobación CUDA y preparación del modelo. Los fallos se inyectaron mediante herramientas de prueba; el usuario normal no necesita terminal.

Preparar conservó cero trabajos. Desde Crear se escribió la descripción de una tetera de cobre y se pulsó explícitamente Crear imagen. Resultado GPU real: PNG de **512 × 512**, **20 pasos**, **CFG 7**, inspeccionado visualmente. Después se cerró y reabrió el servicio con el paquete final; Biblioteca mostró el mismo trabajo y PNG, sin duplicación ni nueva instalación. Se ajustó además el foco/scroll al entrar en Crear y se mantiene el bloqueo mientras la instalación administrada siga activa.

Evidencia: `build/lab/hito3-acceptance-20261110.json` (`passed`, `fixture: false`, cierres y parámetros), `build/lab/first-welcome-acceptance.png`; registros originales de cierre en `crash-extraction.json` y `crash-dependencies.json` dentro del directorio de aceptación. Se preservaron el entorno de Windows, la prueba manual Linux y sus resultados.

Recuperación adicional: errores de espacio/permisos ofrecen una acción concreta y conservan archivos; si SQLite no puede guardar el error se mantiene visible en memoria y la última fase activa persistida se recupera como pausa. La descarga cierra la conexión aunque falle abrir su archivo. Las pruebas Linux usan el error real `ENOSPC` al escribir en `/dev/full` y `EACCES` con una carpeta temporal sin permiso de escritura; `EPERM` y el fallo de persistencia SQLite se inyectan. **No se agotó el disco real del usuario** ni se presenta esa inyección como prueba de una unidad completamente llena.

Comprobaciones finales: **31 Vitest, 32 Bun, 83 HTTP fuente/compilado y 3 recorridos UI**, más typecheck. WSL no certifica Linux nativo; instalación completa propia en Windows, otras condiciones de almacenamiento/ACL y usabilidad con una persona nueva siguen pendientes. La prueba de navegador usa el auxiliar real, sin sustituir la validación de Electron por plataforma.

## Revisión del hito 4 · 10 noviembre 2026

Se contrastaron requisitos y código, sin modificar funciones ni repetir inferencia. Pasaron 10 pruebas existentes en cuatro archivos Vitest: `catalog-guidance`, `image-quality`, `discovery` y `sdxl`. Cubren reglas, ordenación, evidencia y límites; no acreditan recuperación guiada de memoria, que sigue pendiente. La comparación y aceptación están en [milestone-4.md](milestone-4.md).

## Incremento del hito 3 · 9 de noviembre de 2026

Desarrollo 0.10.0, protocolo 9, trabajos SQLite 4. Instalador propio implementado y comprobado desde cero en Veltria-Lab, con datos separados en `/home/veltria/lab/hito3-20261109/data`. Descarga real del entorno y SD 1.5, SHA-256, pausa/reapertura/continuación, instalación offline, CUDA, preparación sin creación automática, imagen explícita de 512 × 512 (20 pasos, CFG 7) y biblioteca conservada tras reiniciar. El PNG se inspeccionó visualmente.

El primer arranque identificó un requisito de compilador de los kernels Triton opcionales. Se corrigió configurando exclusivamente el Python administrado para ejecución eager de PyTorch; no se instalaron compiladores ni se modificó ComfyUI externo. La continuación reutilizó las descargas conservadas. Log del motor: ComfyUI 0.35.0 y 10,88 segundos para ese prompt; no es un benchmark ni se midió pico de VRAM.

Evidencia local: `build/lab/authorized-plan.json`, `build/lab/validated-managed.json` (`passed`, `fixture: false`, `pauseAndRestart`, `generated`, `libraryAfterRestart`) y `build/lab/first-managed-image.png`. Los datos reales permanecen en el laboratorio de D. La prueba usó la API del auxiliar Linux compilado; la UI se verificó por separado con fixtures y capturas.

Comprobaciones del incremento: 31 pruebas Vitest, 28 pruebas Bun, 83 comprobaciones HTTP fuente/compilado y 20 recorridos UI. Tras los ajustes finales del asistente se repitieron sus 3 recorridos y pasaron. TypeScript/Vue correctos. Servicio, lanzador web y paquete Electron 0.10 nativos Windows comprobados. Los 3 recorridos del asistente también pasaron con el paquete Electron Linux 0.10 en WSL/Xvfb. El instalador Windows tiene manifiesto y ejecutor, pero no se instaló otro motor en Windows: su validación completa sigue pendiente. También Linux nativo y usabilidad con una persona nueva.

Durante un build concurrente con la instalación, la compilación del lanzador Windows falló por memoria insuficiente. Se separaron esas operaciones y la compilación posterior de los lanzadores Windows/Linux terminó correctamente.

[Receta, límites y repetición](managed-setup.md). Las tablas siguientes conservan la evidencia de la entrega 0.9 anterior.

Revisión documental: 7 de noviembre de 2026. Las cifras siguientes son resultados registrados, no una nueva ejecución de pruebas durante esta limpieza. El código ejecutable no se modifica.

## Evidencia anterior de imagen · entrega 0.9

Producto 0.9.0, protocolo 8, SQLite de trabajos 4. Bun 1.4.4, Node 24.13.0 para desarrollo; dependencias exactas en `package.json`/`bun.lock`. No exigir runtimes separados al usuario del paquete.

| Comprobación registrada | Resultado |
| --- | --- |
| TypeScript y Vue | Correctos. |
| Vitest | 31 pruebas aprobadas. |
| Bun | 25 pruebas, 216 aserciones aprobadas. |
| HTTP real fuente y ejecutable compilado | 83 comprobaciones aprobadas. |
| Playwright navegador/Electron en Linux/WSL | 20 recorridos aprobados; temas, idiomas, móvil, preparación, calidad, catálogo y biblioteca. |
| Builds/paquetes | Windows y Linux unpacked, lanzadores web y AppImage construidos. |
| Windows nativo | API, SQLite, autorización, recursos, apertura/cierre de escritorio y lanzador web aprobados. |
| Tras mover el repositorio | Lanzador web nativo Windows y diagnóstico SQLite correctos desde Documents/ChatGPT/Veltria. |
| Laboratorio Linux nuevo | Web y Electron en WSLg, ausencia de motor, GPU visible, persistencia y sandbox comprobados. |

Las fixtures comprueban contratos, errores, transferencias, flujo y persistencia, **no inferencia**. Las pruebas GPU de abajo tienen registros propios y no se repiten por cada build. No convertir una ejecución en certificación de todas las opciones.

## Imagen real en Windows

Equipo de prueba: Ryzen 5 7535HS, RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM; ComfyUI existente. Se usaron datos aislados, sin certificar artificialmente la biblioteca habitual.

| Recorrido | Resultado observado |
| --- | --- |
| SD 1.5 y DreamShaper 8 | Seis imágenes de 512 × 512: equilibrada, borrador y más pasos de cada modelo; PNG y parámetros comprobados; biblioteca conservada tras reiniciar. |
| Descarga DreamShaper | Reanudación pública del tramo final sobre un prefijo copiado localmente; HTTP 206 y SHA-256 completo correctos. No se presenta como descarga íntegra nueva ni como corte real del ISP. |
| LoRA SD 1.5 | Búsqueda por UI, descarga real de unos 38 MB, base local, intensidad 0,7 y generación de 512 × 512; persistencia tras reiniciar. |
| SDXL inicial | Checkpoint oficial completo de 6,94 GB verificado; UI preparó/reutilizó el archivo y generó 768 × 768, 20 pasos, CFG 7; `LOW_VRAM` confirmado. La transferencia íntegra se hizo con el auxiliar autorizado, no desde la UI. |
| Calidad SDXL | Elección desde UI de 1024 × 1024, 24 pasos y CFG 6,5; PNG guardado, inspección visual y biblioteca persistente; sin nuevas descargas de pesos. |

No se midió pico de VRAM ni se establecen tiempos garantizados. SDXL 1536 px, los extremos de pasos/CFG y todos los formatos no tienen inferencia certificada. El conjunto H3 detectado no tiene una generación real validada.

Registros conservados bajo `%LOCALAPPDATA%\Veltria`:

- `catalog-real-2026-11-05T20-29-35-646Z-9c469e6f\validated-catalog.json`.
- `discovery-real-1793915199787-a5b2543a\validated-discovery.json`.
- `sdxl-real-1793991687474-91a2236a\validated-sdxl.json`.
- `image-quality-real-1793995271429-fe666a30\validated-sdxl.json`.

Los cuatro registros se comprobaron disponibles con `result: passed` durante esta revisión documental. Conservan la procedencia exacta de sus pruebas; no son archivos del repositorio ni nuevos benchmarks.

## Repetir comprobaciones

Desde la raíz del proyecto, con las herramientas fijadas en PATH:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
# Con Chromium de Playwright instalado y pantalla, o Xvfb:
xvfb-run -a bun run test:ui
```

Paquetes:

```bash
bun run package:linux
bun run package:win:dir
```

`package:linux` se ejecuta en Linux; `package:win:dir` selecciona explícitamente el target Windows del auxiliar. `package:win` configura NSIS, pero construir una carpeta Windows no certifica instalador ni firma. macOS necesita build y pruebas reales en un Mac. Ninguno de estos comandos publica.

PowerShell, desde el checkout actual:

```powershell
.\tests\windows-smoke.ps1
.\tests\windows-web-smoke.ps1
.\tests\windows-desktop-smoke.ps1
```

Prueba GPU optativa con checkpoint SDXL ya preparado; consume GPU y crea otra imagen. Confirmar que no hay trabajos activos:

```powershell
.\tests\windows-sdxl-real.ps1 -ModelsDirectory 'D:\Veltria\models' -CustomQuality
```

Los ejecutores de descarga real o catálogo pueden transferir pesos y usar GPU; no forman parte de `bun run test`. Revisar su alcance antes de ejecutarlos y autorizar nuevas descargas cuando correspondan. El auxiliar de descarga SDXL exige `--authorize-sdxl` y verifica SHA-256; no se necesita repetir una descarga ya íntegra.

## Plataformas y pendientes

**Windows:** ampliar GPU/formatos, presión de memoria, cancelación de imágenes grandes, escalado, accesibilidad, usabilidad con principiantes, Ctrl+C interactivo e instalador firmado.

**Linux:** pruebas disponibles en WSL/Xvfb y WSLg. Veltria-Lab ya tiene inferencia SD 1.5 comprobada con entorno propio y unos 7,4 GiB de RAM. Falta GPU en Linux nativo y ejecución del AppImage en una distribución con pantalla/FUSE. Una build o ventana WSLg no sustituye esas pruebas.

**macOS:** build, arranque, hardware e inferencia pendientes. No hay perfil Apple Silicon certificado.

**Producto:** ampliar validación del instalador administrado en Windows/Linux nativo y recuperación ante cierre abrupto durante instalación; faltan LAN, audio y un video viable comprobado. La prueba de usabilidad completa con una persona nueva no se ha realizado.

El laboratorio conserva `D:\Veltria\lab\reports\validation.json` con `passed` y una captura real. [Guía del entorno](linux-lab.md). [Estado de hitos](status.md), [arquitectura](../ARCHITECTURE.md) y [apertura](../README.md).
# Prueba del primer inicio · 9 noviembre 2026

## Corrección del progreso · 10 noviembre 2026

La preparación administrada conecta ahora `creation.preparation` hasta el componente del instalador: durante `managed.preparing` muestra los bytes y el total del modelo, en lugar de descartar esos datos y mostrar siempre una barra indeterminada. Entorno y modelo muestran barras separadas por etapa, con porcentaje localizado y bytes; un total desconocido muestra actividad sin inventar porcentaje. Instalación y comprobación tienen indicadores animados, compatibles con movimiento reducido. Las esperas nativas de las otras pantallas también tienen animación. El instalador informa cambios reales de etapa al extraer, instalar dependencias y comprobar aceleración.

Pasaron typecheck, nueve pruebas Bun del instalador (57 aserciones) y tres recorridos Playwright de bienvenida/progreso. La nueva prueba usa respuestas HTTP por fragmentos: verifica que aumentan los valores de la barra del entorno y del modelo, que el total de este último es el de sus propios archivos, que la actividad de instalación cambia de posición y que Crear aparece sólo al terminar. Captura móvil: `build/lab/model-progress-mobile.png`. Son bytes y ejecución de fixtures, sin descarga de pesos ni instalación real de dependencias. Paquete Linux actualizado en el directorio aislado existente; no se certifican Windows, Linux nativo ni video con esta prueba.

## Actualización: propuesta 3 como pantalla principal

Implementada `WelcomeSetup.vue`: el editor, las pestañas y las barras de navegación no se montan hasta que el servicio tenga un vínculo y un modelo con estado `prepared`. El plan se revisa dentro de la bienvenida. La comprobación usa el catálogo persistente del servicio; recargar no exige otra instalación. Seleccionar otro modelo restablece la revisión y el consentimiento.

Pasaron dos recorridos Playwright actualizados: bloqueo antes de configurar (incluido Escape), preparación autorizada con fixture, acceso a Crear, recarga y creación explícita de un PNG de prueba; retirada del vínculo, regreso a bienvenida, plan de entorno propio, inglés y 320 px. Pasaron nueve pruebas Bun de detección e instalación (57 aserciones) y typecheck. Electron y la suite completa de las otras pantallas no se ejecutaron en esta ronda.

El paquete Linux real se ejecutó con datos nuevos en `/home/veltria/lab/welcome3-20261109`. Pasó la prueba optativa `VELTRIA_VALIDATE_LAB=1` de `tests/welcome-lab.e2e.ts`: hardware real, SD 1.5 y DreamShaper, cambio de modelo, plan correspondiente, ausencia del editor y de la pregunta de ComfyUI cuando no se encuentra, consentimiento obligatorio y ausencia de descarga. Capturas en `build/lab/welcome3-{desktop,mobile}.png`. No se repitió inferencia GPU ni instalación de pesos; la generación del recorrido automatizado sigue siendo una fixture. WSL no certifica Linux nativo.

### Ensayo anterior del diálogo de preparación (sustituido por la bienvenida principal)

Paquete Linux 0.10.0 ejecutado en Veltria-Lab (WSL), con directorio nuevo en `/home/veltria/lab/onboarding-20261109`, separado de los datos e instalación del hito 3. La interfaz abrió automáticamente la preparación. Detectó RTX 4050 Laptop 6 GiB y 7,4 GiB de RAM; mostró SD 1.5 y DreamShaper 8 como recomendados, y SDXL entre otras opciones con advertencia de recursos. Sin instalación localizada no mostró la pregunta de reutilizar ComfyUI. Cambiar a DreamShaper regeneró el plan para ese modelo y dejó la autorización desmarcada. El botón de instalación permaneció bloqueado hasta aceptar el plan; aceptar lo habilitó sin descargar ni generar.

Pasaron typecheck y los dos recorridos Playwright de preparación (motor existente y ausencia de motor, móvil/inglés y conservación de descripción). La fixture incluye un solo modelo; las dos recomendaciones se comprobaron contra el catálogo real del laboratorio. Electron se omitió en esta ronda. No se repitió instalación/inferencia y no se descargó video. Video conserva el alcance experimental. Esta comprobación técnica no sustituye una sesión de usabilidad con una persona nueva ni certifica Linux nativo.
