# Recursos del equipo

El monitor lateral muestra lecturas del host del servicio: CPU, RAM en uso/total, GPU NVIDIA y VRAM, y espacio libre del volumen de datos de Veltria. CPU y GPU incluyen el nombre del componente en texto pequeño. El disco de datos puede ser distinto del de modelos.

Las cifras corresponden al equipo completo, incluidas otras aplicaciones, no al consumo atribuido a Veltria. Los desconocidos se muestran sin lectura, nunca como cero. WSL se identifica: CPU/RAM/disco pertenecen a Linux; NVIDIA puede exponer la GPU de Windows. No se suman RAM y VRAM ni varias tarjetas.

El cliente autorizado consulta `/api/v1/resources` cada tres segundos después de completar la lectura anterior. No solapa peticiones; pausa al ocultar la pestaña y vuelve a consultar al mostrarla. Fallos/desconexiones retiran las cifras anteriores. No se almacenan muestras en SQLite ni archivos.

El servicio comparte muestras concurrentes, conserva caché durante 2,5 segundos y no muestrea sin clientes. La consulta NVIDIA tiene timeout y espera antes de reintentar tras fallar. RAM Linux usa `MemAvailable`; Windows informa su fuente del SO. No instala sensores ni herramientas.

CPU/RAM/disco se consultan por separado. Otras GPU y sensores macOS siguen pendientes. Cálculo, caché, autorización, actualización, fallo/recuperación y pausa tienen pruebas; lecturas nativas Windows y GPU visible en el laboratorio se registran en [validation.md](validation.md).
