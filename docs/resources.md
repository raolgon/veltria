# Recursos del equipo en el menú lateral

El monitor compacto conserva los temas Obsidian y muestra lecturas del equipo que ejecuta el servicio local:

- CPU: porcentaje ocupado entre muestras sucesivas de los tiempos del sistema, no la carga acumulada desde el arranque.
- RAM: memoria en uso / total; la cantidad disponible se puede consultar sobre la fila. En Linux se usa `MemAvailable` de `/proc/meminfo`; en Windows se usa memoria libre informada por el sistema. La memoria recuperable puede diferir entre sistemas.
- GPU NVIDIA: utilización y VRAM en uso / total, con la memoria disponible y el nombre en el detalle de la fila. Se conservan lecturas parciales y varias tarjetas. Una lectura no disponible se muestra con raya, nunca como cero ni como ausencia de GPU.
- Disco: espacio disponible en el volumen de **datos de Veltria**. El detalle de la fila identifica su ruta; puede ser un volumen distinto del de modelos.

Los valores corresponden a **todo el equipo**, incluidas otras aplicaciones, no al consumo atribuido a Veltria. En WSL se etiqueta el entorno: CPU/RAM/disco corresponden a Linux y NVIDIA puede exponer la GPU del host Windows. No se presentan como un inventario completo de Windows.

El cliente autorizado consulta `GET /api/v1/resources` cada tres segundos después de completar la lectura anterior. Se detiene al ocultar la pestaña y vuelve a consultar al mostrarla. No se solapan peticiones; hay un límite de cuatro segundos en el cliente. Una desconexión o fallo retira las cifras anteriores y muestra el estado sin lectura. La telemetría no se escribe en SQLite ni en archivos.

El servicio agrupa peticiones simultáneas y conserva una muestra durante 2,5 segundos. No ejecuta un muestreador en segundo plano sin clientes. La consulta NVIDIA tiene un límite de 1,5 segundos y, si falla, espera 30 segundos antes de volver a intentarlo. No instala herramientas ni usa scripts aportados por el usuario. Otros fabricantes y los sensores gráficos de macOS quedan pendientes; CPU, RAM y disco tienen consultas independientes.

En escritorio se ve el detalle pequeño sobre el pie del menú. En la barra estrecha de tableta se conservan etiquetas y porcentajes; los nombres y cantidades siguen en los detalles accesibles. En teléfono se mantiene la navegación inferior existente.

Comprobaciones: cálculo de CPU y reinicio de contadores; GPU en reposo frente a sensor desconocido; múltiples tarjetas; muestra compartida/caché; autorización HTTP; actualización de la interfaz, fallo y recuperación, pausa al ocultar y ajuste a escritorio/tableta. Las pruebas de interfaz usan datos identificados como fixture. La lectura nativa de Windows se comprueba por separado con `tests/windows-web-smoke.ps1`. La validación gráfica de macOS y de GPU Linux fuera de WSL sigue pendiente.

En esta PC la prueba nativa devolvió CPU, RAM, espacio libre y la NVIDIA RTX 4050 Laptop con uso gráfico y memoria disponibles. Pasaron 8 pruebas Vitest, 8 pruebas Bun, 61 comprobaciones HTTP y los 6 recorridos Playwright de navegador/Electron. También pasaron los tipos y la compilación Linux/Windows. El paquete final Linux pasó los dos recorridos específicos de Electron, incluido el monitor en vivo. El paquete final Windows abrió su ventana, sirvió las lecturas autorizadas y cerró su auxiliar de prueba conservando SQLite. Durante esa prueba simultánea con la versión anterior Chromium registró acceso denegado a su caché gráfica compartida; no impidió abrir ni cerrar. Queda pendiente revisar visualmente esa ejecución nativa y el escalado físico de Windows.

## Abrir el paquete actualizado

Se conserva el paquete anterior y la ventana abierta. Para ver el monitor, cerrar primero esa ventana y abrir el paquete con recursos. Se reutilizan los datos habituales, el vínculo y la biblioteca; no hace falta descargar el modelo de nuevo.

Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\release\0.2.0-resources\win-unpacked\Veltria.exe
# O navegador, después de cerrar la versión anterior:
.\build\browser\0.2.0\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.2.0-resources/linux-unpacked/veltria
# O navegador:
./build/browser/0.2.0/veltria-web
```

Una ventana antigua con un servicio ya abierto conserva su código hasta cerrarla. Navegador y escritorio de un mismo SO comparten ese servicio; abrir otro cliente no lo actualiza.
