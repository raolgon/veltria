# Prueba Windows nativa con entorno separado en D:

10 de noviembre de 2026, desarrollo 0.10.0. **Resultado: aprobado** para el recorrido descrito. El usuario eligió entorno y datos separados en D:, compartiendo Windows y GPU; **no es una VM ni Windows Sandbox**. El host es Windows 11 Home Single Language, build 26200, sin Sandbox disponible; VirtualBox sólo tenía una VM Linux/HA, que no se modificó.

## Aislamiento aplicado

Raíz `D:\Veltria\lab\windows-native-20261110`: paquete, `data`, Python/ComfyUI, modelos, cachés, temporales, perfil de proceso y `reports`. El lanzador configura USERPROFILE, APPDATA, LOCALAPPDATA, TEMP/TMP, HF_HOME, TORCH_HOME y CUDA_CACHE_PATH sólo en el proceso hijo. No cambia las variables globales, el controlador NVIDIA ni los paquetes de las instalaciones habituales.

Las dos instalaciones de ComfyUI detectadas en `D:\pinokio\api` permanecieron disponibles y se eligió explícitamente **Preparar una instalación propia**. Se contrastaron las huellas de sus archivos `main.py` y el SHA-256 del SD 1.5 original al terminar; coinciden con la referencia. Esto no es un inventario exhaustivo de cada archivo del host ni aislamiento de seguridad entre procesos.

## Recorrido comprobado

1. Servicio y UI de producción nativos: `platform: win32`, `wsl: false`, Ryzen 5 7535HS, RTX 4050 Laptop 6 GB y unos 15,3 GiB de RAM utilizables. Bienvenida visible, editor bloqueado y cero trabajos.
2. Plan de entorno separado, fuentes/licencias, consentimiento y **3.517.429.712 bytes** de descarga. SD 1.5 se copió al laboratorio desde el archivo existente de 2.132.696.762 bytes y se verificó; no se descargaron pesos nuevos ni se usaron directamente los del motor habitual.
3. Pausa real durante la descarga, cierre/reapertura y continuación con los bytes conservados. El plan volvió a mostrar sólo el tramo pendiente; no se continuó automáticamente.
4. Cierre forzado del árbol de procesos del servicio del laboratorio durante extracción y otro durante instalación de dependencias. Se comprobó su ruta y directorio de datos antes de terminarlo. Cada reapertura recuperó estado de pausa; la UI requirió revisión y autorización antes de continuar. Los paquetes completos se reutilizaron sin otra descarga.
5. Instalación offline, importaciones y `torch.cuda.is_available()` aprobados con el Python propio. Log del motor: `pytorch version: 2.7.1+cu126`, dispositivo `cuda:0 NVIDIA GeForce RTX 4050 Laptop GPU`, ComfyUI 0.35.0 y Python 3.12.12.
6. Preparar dejó cero trabajos. Una acción explícita de Crear produjo una imagen real de **512 × 512, 20 pasos y CFG 7**, inspeccionada visualmente. Se reinició el servicio y Biblioteca mostró el mismo PNG y un solo trabajo completado, sin instalación ni generación automática.

El log registró 9,87 segundos para ese prompt; no es un benchmark ni una garantía. ComfyUI utilizó su gestión de memoria anterior a DynamicVRAM con esta versión fijada de PyTorch; no se certifican otros tamaños o familias por este resultado.

## Problemas encontrados y corregidos

- La receta Windows v1 fijaba `torch 2.7.1+cpu` de PyPI. Se comprobó leyendo `torch/version.py` del wheel por HTTP Range. La receta CUDA v2 fija torch, torchvision y torchaudio `+cu126` desde el índice oficial de PyTorch, con tamaños y SHA-256, y declara esa fuente/licencias en el plan. El generador de manifiestos y las pruebas rechazan volver a fijar los wheels CPU para esta receta NVIDIA.
- El asistente ofrecía un entorno propio, pero el servicio lo bloqueaba al detectar ComfyUI. Ahora la elección explícita se incluye en el plan y su revisión. Por defecto sigue proponiendo reutilizar; cambiar la elección invalida el plan anterior. No se acepta código ni fuentes arbitrarias del cliente.

## Evidencia y repetición

- `build/lab/validated-managed-windows.json` y `D:\Veltria\lab\windows-native-20261110\reports\validated-managed-windows.json`: `passed`, `fixture: false`, GPU, vínculo propio, trabajo, integridad y recuperación.
- `build/lab/first-managed-windows-image.png`: resultado real.
- En `reports`: `CrashExtraction.json`, `CrashDependencies.json` y `external-baseline.json`. Log del motor en `data\image-engine\engine.log`.
- `tests/windows-managed-lab.ps1`: Deploy, Start, Status, Stop y cierres forzados **sólo** del servicio identificado de este laboratorio. No ejecutar las acciones Crash sobre una sesión normal de uso.
- `tests/windows-managed-report.ps1`: comprueba el resultado y conserva el informe. `-LibraryVerified` registra la comprobación de biblioteca tras reiniciar, que debe haberse realizado desde la UI.

Para abrir el laboratorio conservado:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-managed-lab.ps1 -Action Start
```

Imprime un enlace de un uso que vence a los 60 segundos. La opción de ExecutionPolicy se limita a ese proceso para ejecutar el script local, no cambia la política global. Stop realiza cierre autenticado y espera su finalización; los datos se conservan. Las pruebas de espacio/permisos tienen su cobertura acotada en [validación](validation.md); no se llenó el disco ni se alteraron ACL de las instalaciones habituales.

Esta ejecución comprueba el auxiliar Windows y la UI web compartida. No certifica una VM Windows limpia, otra GPU, Linux nativo, video, el instalador firmado ni usabilidad con una persona nueva. [Estado del hito 3](status.md).
