# Laboratorio Linux aislado en D

Revisado el 10 de noviembre de 2026. Distribución WSL 2 independiente **Veltria-Lab**, Ubuntu 24.04.5 LTS x64, usuario `veltria`. Disco ext4 en `D:\Veltria\lab\linux\ext4.vhdx`.

## Prueba manual vigente

Paquete web Linux 0.10.0 con servicio propio en `/home/veltria/lab/welcome3-20261109/app`; datos en `/home/veltria/lab/welcome3-20261109/manual-data`. Incluye la bienvenida principal y el progreso corregido de entorno/modelo. La copia de Windows y los datos de otras distribuciones no se comparten.

Desde PowerShell:

```powershell
wsl -d Veltria-Lab -u veltria --exec env VELTRIA_DATA_DIR=/home/veltria/lab/welcome3-20261109/manual-data /home/veltria/lab/welcome3-20261109/app/veltria-web
```

El lanzador imprime un enlace autorizado de un uso y 60 segundos de vigencia. También está el acceso `build/lab/Abrir prueba inicial Linux.cmd` del repositorio. Cerrar la pestaña no detiene el servicio: cerrar desde el lanzador propietario. No compartir una base activa con Windows.

El 10 de noviembre, por solicitud del usuario, se retiraron las dos copias SD 1.5 del laboratorio: la del hito 3 y la de esta prueba manual, 2.132.696.762 bytes cada una. Se conservaron entornos, dependencias y resultados. Al reabrir se verificó que los tres modelos del catálogo estaban `missing`, se mostraba la bienvenida y no se montaba el editor. Registro en `/home/veltria/lab/models-reset-20261110.json`. Este reinicio **no** equivale a un equipo sin motor; el entorno continúa instalado. Nuevas descargas requieren un plan autorizado.

## Aislamiento y recursos

C y D no se montan automáticamente; `appendWindowsPath=false`. No se vinculan modelos ni bases de Windows o de Ubuntu habitual. La interoperabilidad WSL permanece habilitada por los servicios compartidos. WSL comparte kernel, red, GPU y recursos: separa archivos y pruebas, **no es una máquina virtual de seguridad independiente**. No se modificaron `.wslconfig`, la distribución predeterminada ni Docker.

RTX 4050 visible, 6 GiB de VRAM y unos 7,4 GiB de RAM utilizables en WSL. Veltria recomienda según esos recursos, no según los 16 GB nominales de Windows. No se aumentó la memoria global. Linux nativo continúa pendiente.

Cerrar antes la app o lanzador si se necesita `wsl --terminate Veltria-Lab`. Evitar `wsl --shutdown`, que afecta a las demás distribuciones, y no editar directamente `ext4.vhdx`.

## Evidencia y copias anteriores

- `/home/veltria/lab/acceptance-hito3-20261110`: prueba independiente del 10 de noviembre, sin entorno instalado inicialmente en ese destino. Completó instalación desde la bienvenida, recuperación de SIGKILL en extracción y dependencias, imagen GPU de 512 × 512 y Biblioteca tras reiniciar. Conserva sus propios pesos y entorno, separados de la prueba manual sin modelos. Usó los paquetes verificados del entorno anterior y descargó SD 1.5 de nuevo. Informe `build/lab/hito3-acceptance-20261110.json` y PNG `build/lab/first-welcome-acceptance.png`.

- `/home/veltria/lab/hito3-20261109`: instalación administrada desde cero, pausa/reapertura, SD 1.5 real de 512 × 512 y biblioteca persistente comprobadas. Sus pesos se retiraron después para repetir la prueba; se conserva la evidencia histórica.
- `/home/veltria/lab/onboarding-20261109`: ensayo anterior de la preparación en diálogo, sustituido por la bienvenida principal. No es el destino de la prueba vigente.
- `/opt/veltria-lab/app` y `/opt/veltria-lab/browser`: copias históricas 0.9.0 del commit `a355e7d72e97529301420a7111b529ddfda7a99f`. Los accesos antiguos de `D:\Veltria\lab` pueden abrirlas; no usarlos para comprobar cambios de 0.10.
- `D:\Veltria\lab\reports\validation.json` y `fresh-linux-desktop.png`: prueba inicial 0.9 de web/Electron en WSLg, hardware, sesión, preferencias y ausencia de motor, sin inferencia en aquella prueba. No describen el estado actual.
- `build/lab/welcome3-{desktop,mobile}.png`: bienvenida y plan; `model-progress-mobile.png`: progreso con bytes de fixture. Los recorridos de UI y las fixtures no acreditan inferencia GPU.

Los cambios del repositorio no se trasladan automáticamente. Construir y desplegar el paquete antes de probar; conservar directorios de datos y registros. Detalles en [validación](validation.md) e [instalación administrada](managed-setup.md).

## Sistema de origen

Imagen oficial Ubuntu: `https://releases.ubuntu.com/noble/ubuntu-24.04.5-wsl-amd64.wsl`, SHA-256 `bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`, comprobada con SHA256SUMS y firma de Ubuntu CD Image Automatic Signing Key (2012), huella `843938DF228D22F7B3742BC0D94AA3F0EFE21092`. Se importó la distribución y se instalaron las bibliotecas de sistema necesarias para Electron. El paquete se transfirió por stdin, conservando las unidades Windows desmontadas.
