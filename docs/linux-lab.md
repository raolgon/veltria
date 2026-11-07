# Laboratorio Linux aislado en D

Laboratorio de pruebas para el recorrido desde cero, separado de la instalación habitual. Ejecuta una copia del paquete vigente; no implementa el instalador administrado del motor.

## Entorno listo

- Distribución WSL 2 independiente **Veltria-Lab**, Ubuntu 24.04.5 LTS x64.
- Disco ext4 en `D:\Veltria\lab\linux\ext4.vhdx`; usuario `veltria` sin privilegios administrativos por defecto.
- Copia del paquete Veltria 0.9.0 en `/opt/veltria-lab/app`; lanzador web en `/opt/veltria-lab/browser`, reutilizando sus recursos.
- Datos de uso manual: `/home/veltria/lab/data`. Configuración del contenedor y caché también dentro de `/home/veltria/lab`.
- Sin ComfyUI, pesos ni dependencias de inferencia instalados. No requiere instalar Bun o Node al usuario: el paquete incluye sus runtimes.
- C y D no se montan automáticamente; `appendWindowsPath=false`. No se vinculan modelos ni bases de Windows o de la distribución Ubuntu habitual.

La interoperabilidad WSL permanece habilitada por compatibilidad con los servicios compartidos entre distribuciones; no se importan rutas Windows al PATH. WSL comparte kernel, red, GPU y recursos; este laboratorio separa archivos y pruebas, **no es una máquina virtual de seguridad independiente**. No se modificó `.wslconfig`, la distribución predeterminada ni Docker.

La GPU RTX 4050 es visible. WSL informa unos 7,4 GiB de RAM utilizables en este host; Veltria debe recomendar según esos recursos, no según los 16 GB físicos de Windows. No se aumentó la memoria global para evitar alterar otras distribuciones. Falta generación GPU dentro del laboratorio y Linux nativo sigue pendiente.

## Abrir

Hay accesos de doble clic en `D:\Veltria\lab`:

- `Abrir Veltria Linux.cmd`.
- `Abrir navegador Linux.cmd`: abrir el enlace autorizado que imprime.
- `Terminal Linux.cmd`.

Desde PowerShell:

```powershell
wsl -d Veltria-Lab -u veltria --cd /home/veltria --exec /home/veltria/bin/veltria-desktop
wsl -d Veltria-Lab -u veltria --cd /home/veltria --exec /home/veltria/bin/veltria-web
```

Cerrar primero la app o el lanzador antes de detener el laboratorio con `wsl --terminate Veltria-Lab`. Evitar `wsl --shutdown`, que afecta a las demás distribuciones. No editar directamente `ext4.vhdx`.

La aplicación es una copia del paquete construido desde el commit `a355e7d72e97529301420a7111b529ddfda7a99f`. Los cambios del repositorio no se trasladan automáticamente: hay que construir y desplegar la siguiente versión. La guía completa y los scripts usados están en `D:\Veltria\lab\LEEME.md` y `D:\Veltria\lab\scripts`.

## Evidencia

`D:\Veltria\lab\reports\validation.json`: **passed**. Prueba con servicio y launcher reales, sesión autorizada, hardware Linux/WSL/NVIDIA, preferencias tras reiniciar, ausencia de ComfyUI y rechazo de generación sin preparación. Electron abrió su ventana real con WSLg; desde la UI se ejecutó la búsqueda y se comprobó el estado sin instalación. El renderer confirmó sandbox y aislamiento activos, sin `window.require`.

Captura: `D:\Veltria\lab\reports\fresh-linux-desktop.png`. Las comprobaciones usaron directorios separados en `/home/veltria/lab/checks`; dejaron el directorio manual vacío y cerraron sus procesos. No hubo descarga de modelos ni inferencia. La prueba utilizó el Node interno de Electron; los ajustes de diagnóstico remoto sólo se usan durante ella, no en los accesos normales.

El estado mostrado por la aplicación sigue siendo «instalación desde Veltria pendiente». El siguiente desarrollo debe sustituir esa salida por un plan real de instalación administrada, con descarga, espacio, consentimiento y recuperación. El laboratorio ya está preparado para validarlo desde cero.

## Sistema de origen

[Imagen oficial Ubuntu](https://releases.ubuntu.com/noble/ubuntu-24.04.5-wsl-amd64.wsl), SHA-256 `bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`, comprobada con SHA256SUMS y su firma válida de Ubuntu CD Image Automatic Signing Key (2012), huella `843938DF228D22F7B3742BC0D94AA3F0EFE21092`.

Se usó la [importación de distribuciones de WSL documentada por Microsoft](https://learn.microsoft.com/windows/wsl/use-custom-distro). Sólo se instalaron en la distribución nueva las bibliotecas de sistema necesarias para Electron y herramientas básicas. El paquete se transfirió por stdin, conservando las unidades Windows desmontadas tras reiniciar el laboratorio.
