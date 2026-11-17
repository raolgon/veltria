# Laboratorio Linux aislado en D

Distribución WSL 2 independiente **Veltria-Lab**, Ubuntu 24.04.5 LTS x64, usuario `veltria`. Disco ext4 en `D:\Veltria\lab\linux\ext4.vhdx`.

## Prueba manual

Paquete web Linux 0.10.0 con servicio propio en `/home/veltria/lab/welcome3-20261109/app`; datos en `/home/veltria/lab/welcome3-20261109/manual-data`. La copia de Windows y los datos de otras distribuciones no se comparten.

Desde PowerShell:

```powershell
wsl -d Veltria-Lab -u veltria --exec env VELTRIA_DATA_DIR=/home/veltria/lab/welcome3-20261109/manual-data /home/veltria/lab/welcome3-20261109/app/veltria-web
```

El lanzador imprime un enlace autorizado de un uso y 60 segundos de vigencia. Cerrar la pestaña no detiene el servicio: cerrar desde el lanzador propietario. No compartir una base activa con Windows.

## Aislamiento y recursos

C y D no se montan automáticamente; `appendWindowsPath=false`. No se vinculan modelos ni bases de Windows o de Ubuntu habitual. WSL comparte kernel, red, GPU y recursos: separa archivos y pruebas, **no es una máquina virtual de seguridad independiente**. No se modificaron `.wslconfig`, la distribución predeterminada ni Docker.

RTX 4050 visible, 6 GiB de VRAM y unos 7,4 GiB de RAM utilizables en WSL. Kobocraft recomienda según esos recursos, no según los 16 GB nominales de Windows. Linux nativo continúa pendiente.

Cerrar antes la app o lanzador si se necesita `wsl --terminate Veltria-Lab`. Evitar `wsl --shutdown`, que afecta a las demás distribuciones, y no editar directamente `ext4.vhdx`.

## Directorios y evidencia

- `/home/veltria/lab/acceptance-hito3-20261110`: prueba de aceptación del 10 de noviembre, sin entorno instalado inicialmente en ese destino. Completó instalación desde la bienvenida, recuperación de `SIGKILL` en extracción y dependencias, imagen GPU de 512 × 512 y Biblioteca tras reiniciar. Informe `build/lab/hito3-acceptance-20261110.json` y PNG `build/lab/first-welcome-acceptance.png`.
- `/home/veltria/lab/hito3-20261109`: primera instalación administrada desde cero, pausa/reapertura, SD 1.5 real de 512 × 512 y biblioteca persistente comprobadas (los pesos duplicados se retiraron después conservando la evidencia en `build/lab/validated-managed.json`).

Los cambios del repositorio no se trasladan automáticamente al laboratorio. Construir y desplegar el paquete antes de probar; conservar directorios de datos y registros. Detalles en [validación](validation.md) e [instalación administrada](managed-setup.md).

## Sistema de origen

Imagen oficial Ubuntu: `https://releases.ubuntu.com/noble/ubuntu-24.04.5-wsl-amd64.wsl`, SHA-256 `bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`, comprobada con SHA256SUMS y firma de Ubuntu CD Image Automatic Signing Key (2012), huella `843938DF228D22F7B3742BC0D94AA3F0EFE21092`. Se importó la distribución y se instalaron las bibliotecas de sistema necesarias para Electron. El paquete se transfirió por stdin, conservando las unidades Windows desmontadas.
