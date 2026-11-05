# Explorar compatibles por popularidad · 0.6.1

En **Modelos → Ver modelos para mi equipo**, no hace falta escribir un nombre ni elegir un estilo. La acción limpia el filtro de texto, consulta candidatos de Hugging Face para SD 1.5 y los ordena por el contador de descargas que publica el proveedor, de mayor a menor. Muestra el contador y la fuente, sin inventar cifras cuando faltan. Se conserva la búsqueda por nombre/intención y los filtros de modelos/LoRA.

**Ver más modelos** recorre páginas del proveedor, acumula resultados sin duplicar repositorios y conserva el orden por descargas. Una página sin candidatos admitidos no termina la exploración si el proveedor ofrece otra. Si falla una página posterior, se conservan los resultados y el cursor para volver a intentarlo. No es una lista fija de ocho modelos ni un catálogo exhaustivo de Internet: depende de los metadatos y acceso público del proveedor.

La compatibilidad usa los recursos detectados por el servicio y las recetas disponibles: actualmente SD 1.5 a 512 píxeles, checkpoints completos y LoRA estándar. Sin hardware confirmado o por debajo de los mínimos, el servicio devuelve la explicación sin consultar Internet. No envía datos del equipo ni prompts al proveedor. La exploración requiere conexión; el catálogo local sigue disponible.

Antes de incluir un candidato se comprueban revisión, tamaño, SHA-256 publicado, familia declarada y cabecera safetensors con lecturas parciales acotadas. Se excluyen variantes aceleradas que necesitan otra receta (LCM, TCD, Turbo, Lightning y similares), familias ajenas y archivos incompletos. El uso de cabeceras y metadatos no certifica una generación ni todos los archivos de un repositorio: preparar vuelve a comprobar la variante elegida y sólo una creación terminada aporta evidencia para ese equipo y configuración.

Cada página consulta como máximo doce repositorios. La paginación utiliza únicamente el cursor del enlace del proveedor, sobre un origen y filtros fijados por el servicio; el cliente no aporta URL de destino. No descarga pesos completos, instala dependencias ni genera imágenes al explorar. Se mantiene el plan previo de **Preparar y usar**.

## Validación

Tipos; **22 pruebas Vitest**, **22 pruebas Bun (184 aserciones)** y **83 comprobaciones HTTP**. Pruebas específicas de consulta sin texto, orden por descargas, cursor conservado tras páginas incompatibles, datos de popularidad desconocidos y exclusión de recetas aceleradas. **17 recorridos de interfaz**: explorar sin nombre, limpiar filtros anteriores, paginar, deduplicar, conservar resultados ante fallo y verificar ausencia de desbordamiento en escritorio y móvil; junto con la regresión de navegador/Electron.

Consulta real de dos páginas de Hugging Face en Linux/WSL: lectura de metadatos/cabeceras y cursores, orden descendente y exclusión de cabeceras incompatibles. En una consulta posterior, ya con la exclusión de aceleradas, la primera página devolvió cinco candidatos y un cursor para continuar. Las cifras de descargas son temporales. No se descargaron modelos completos ni se repitió inferencia GPU para este cambio de exploración; la comprobación real de LoRA de 0.6 sigue documentada en [model-discovery.md](model-discovery.md).

Windows nativo: lanzador web y consulta real sin texto, cinco candidatos ordenados (`65456`, `4028`, `1498`, `876`, `461` descargas en esa ejecución), cursor disponible y descarte parcial de cabeceras incompatibles. Comprobados sesión/CSRF, recursos, cierre del auxiliar y arranque/cierre del paquete de escritorio. Repetir la consulta real, sin descargar pesos completos: `tests/windows-web-smoke.ps1 -BrowseCompatible`. Las cifras no son datos fijos de producto.

Pendiente: inferencia nativa Linux, macOS y soporte de nuevas familias/recetas. La exploración no amplía por sí sola las arquitecturas que puede ejecutar Veltria.

## Abrir

Cerrar la versión anterior. Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.6.1\win-unpacked\Veltria.exe
# Navegador: abrir el enlace que imprime
.\build\browser\0.6.1\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.6.1/linux-unpacked/veltria
./build/browser/0.6.1/veltria-web
```

Protocolo 6 y SQLite 4 sin cambios; se conservan datos y paquetes anteriores.
