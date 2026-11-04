# ComfyUI existente en D: conexión real comprobada

4 de noviembre de 2026. Ampliación de la validación del hito 1, sin instalar otro motor ni avanzar a generación.

## Instancia comprobada

- Motor: `D:\pinokio\api\minimax-h3-pinokio.git\app`.
- Python existente: `D:\pinokio\api\minimax-h3-pinokio.git\app\env\Scripts\python.exe`.
- ComfyUI **0.35.0**, Python **3.10.20**, PyTorch **2.10.0+cu130**.
- API local: `http://127.0.0.1:8188`.
- Dispositivo declarado por el motor: `cuda:0 NVIDIA GeForce RTX 4050 Laptop GPU : cudaMallocAsync`, aproximadamente 6 GiB de VRAM.
- `/object_info`: **923 tipos de nodo**, respuesta de aproximadamente 1.76 MB.
- Cargadores consultados: **3 modelos de difusión de video y 7 LoRA**, sin checkpoints declarados por `CheckpointLoaderSimple`. Esto no significa que todos los modelos del disco hayan sido inventariados ni que sus combinaciones sean compatibles.

Los modelos de esta instancia conservan sus enlaces existentes hacia `D:\pinokio\drive\drives\peers\d1788559745617\`. No se copiaron, movieron ni descargaron pesos.

También se encontró Comfy Desktop en `D:\Comfy\Comfy Desktop`. Su catálogo conserva una referencia a `D:\ComfyUI\ComfyUI`, que no existe actualmente; no se modificó ese catálogo ni se ejecutó su actualizador. La conexión comprobada utiliza el motor ya instalado dentro de Pinokio.

## Prueba realizada

Se inició directamente el Python de esa instalación en Windows nativo, con:

- `--listen 127.0.0.1 --port 8188`: sólo loopback.
- `--disable-auto-launch --disable-all-custom-nodes`: sin abrir otra ventana ni ejecutar las extensiones de usuario durante esta comprobación. No se habilitó ComfyUI Manager.
- `-B` y `PYTHONDONTWRITEBYTECODE=1`: sin generar bytecode dentro de la instalación.
- `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` y telemetría de Hugging Face desactivada en ese proceso.
- Directorios de prueba de usuario, entrada, salida y temporales bajo `%LOCALAPPDATA%\Veltria\diagnostics\existing-comfy-20261104-113843`; base de datos del motor en memoria. Los directorios originales de trabajo no se sustituyeron en su configuración.

Los hashes SHA-256 de `main.py`, `comfy/cli_args.py`, `comfyui_version.py` y `env/pyvenv.cfg` permanecieron iguales tras el arranque. No se ejecutaron instaladores, pip, actualizaciones o generaciones.

Después se usó la sesión autorizada del **servicio Windows de Veltria que ya estaba abierto**, conservando su apariencia. Se guardó `engineUrl=http://127.0.0.1:8188` mediante `/api/v1/settings`, se ejecutó `/api/v1/engine/check` y se volvió a consultar `/api/v1/engine`.

Resultado de Veltria: **`ready` / API disponible**, versión 0.35.0, 923 nodos, 10 entradas de modelos y la GPU NVIDIA. Comprobado a las 11:40 del 4 de noviembre, hora de Ciudad de México. La UI recibe el cambio por el canal de eventos existente.

## Uso y límites

En Veltria: **Mi equipo → Avanzado · Usar una instalación existente de ComfyUI → Comprobar conexión**. La dirección queda guardada en SQLite y sirve tanto para navegador como para escritorio conectados a ese servicio Windows.

El motor se dejó funcionando para esta sesión de comprobación. Es un proceso externo: cerrar Veltria no lo apaga, y abrir Veltria todavía no lo inicia automáticamente. Al volver a usar la instalación habitual desde Pinokio, comprobar la dirección que anuncie y pulsar de nuevo Comprobar conexión. No iniciar dos motores sobre el mismo puerto.

Esta prueba demuestra reutilización del motor, consulta real de capacidades y lectura de los modelos que declara. Los nodos personalizados estuvieron desactivados; no se certifican sus dependencias, workflows o compatibilidad. Tampoco se ha verificado una generación ni un perfil de imagen adecuado para 6 GiB. Elegir y probar ese perfil pertenece al hito 2; no requiere instalar un segundo ComfyUI.

La conexión equivalente desde un servicio Linux/WSL permanece pendiente. La comprobación se hizo con Veltria y ComfyUI ejecutándose ambos en Windows nativo.
