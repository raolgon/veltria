# Validación real del catálogo · Veltria 0.5.1

Esta entrega continúa el catálogo de 0.4 y la preparación automática de 0.5. El objetivo es comprobar los modelos y las configuraciones existentes con archivos, proveedor, interfaz y motor reales. No añade modelos de video, LoRA ni workflows externos.

## Ajustes de producto

- Elegir un modelo para preparar desde **Modelos**, sin instalación vinculada, abre ahora **Preparar mi equipo**. Antes abría directamente el plan antiguo con el bloqueo que pedía introducir el vínculo avanzado.
- Se retiró el aviso fijo de DreamShaper que decía que todavía no había una generación comprobada. Ese estado depende del equipo y de los ajustes: lo calcula la evidencia del servicio. La advertencia general recuerda que un resultado correcto no certifica otros ajustes.
- Los archivos, revisiones, licencias declaradas y recetas del catálogo se mantienen. No se marca globalmente como verificado un modelo por aprobar una prueba en una sola máquina.

## Cómo se prueba sin descargar otro checkpoint completo

DreamShaper ya estaba en `D:\Veltria\models\checkpoints\veltria-dreamshaper8-879db523.safetensors`. Se comprobó el archivo entero contra los metadatos LFS del proveedor:

- Bytes: `2132625894`.
- SHA-256: `879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd`.
- Revisión fijada: `228d79cb20811466f5c5710aa91f05dabd0b8a14`, archivo `DreamShaper_8_pruned.safetensors` del [repositorio oficial de Lykon](https://huggingface.co/Lykon/DreamShaper/tree/228d79cb20811466f5c5710aa91f05dabd0b8a14). El proveedor sigue declarando licencia `other`; no se sustituye por otra licencia por asociación con repositorios relacionados.

La comprobación crea una carpeta propia y un `.part` con un prefijo **copiado localmente** del archivo ya existente. Quedan **256 MiB** pendientes. Esa procedencia se registra: no se presenta el prefijo local como una descarga realizada durante esta prueba.

El tramo restante sí procede del proveedor real. La UI solicita la preparación, se interrumpe con **Pausar preparación**, se cierra el servicio de validación y se vuelve a abrir con la misma base. Se comprueba que la selección y los bytes parciales sobreviven sin reanudar automáticamente. Tras pulsar **Continuar preparación**, se verifica que los bytes no vuelven a cero y que el archivo final completo tiene el SHA-256 esperado. Se registran las respuestas HTTP 206 y sus rangos, sin guardar URL firmadas del CDN ni material de sesión.

Es una interrupción controlada de la transferencia y un reinicio real del servicio. No se apaga la red del equipo ni se afirma haber reproducido un corte del proveedor/ISP. Los casos de red rota, falta de espacio, respuesta sin Range y hash incorrecto tienen además pruebas deterministas con fixtures; una fixture no se presenta como transferencia pública real.

## Interfaz y generación nativas

`tests/windows-catalog-real.ps1` ejecuta `tests/windows-catalog-real.cjs` usando el Node que ya incluye Electron y Microsoft Edge existente en modo headless, con perfil temporal separado. No instala Node, otro navegador, ComfyUI ni dependencias de generación. El ejecutor necesita las dependencias de desarrollo del checkout para Playwright; no es un requisito de la aplicación distribuida.

Se utilizan el lanzador web, el servicio Bun compilado, la UI y el ComfyUI existentes. Los clics reales recorren **Modelos → configuración → preparar → Crear → Guardar**, y después **Biblioteca**. Las imágenes no son muestras de fixture. Se comprueban identidad de modelo/configuración, pasos, CFG, dimensiones, resultado PNG y descarga del archivo desde la app.

| Modelo | Configuración | Pasos | CFG | Formato comprobado |
| --- | --- | ---: | ---: | --- |
| DreamShaper 8 FP16 | Equilibrada | 25 | 7 | 512 × 512 |
| DreamShaper 8 FP16 | Borrador rápido | 12 | 7 | 512 × 512 |
| DreamShaper 8 FP16 | Más pasos | 30 | 7 | 512 × 512 |
| SD 1.5 FP16 | Equilibrada | 20 | 7 | 512 × 512 |
| SD 1.5 FP16 | Borrador rápido | 12 | 7 | 512 × 512 |
| SD 1.5 FP16 | Más pasos | 30 | 7 | 512 × 512 |

Después se reinicia de nuevo el servicio y se comprueba la biblioteca con seis trabajos completos, sin reenviarlos. Las capturas, resultados y metadatos se guardan en una carpeta de validación separada. No se cambia la selección, el motor ni la biblioteca de la sesión habitual. Al terminar correctamente se eliminan sólo las copias de pesos de esta prueba; se conservan los originales, las imágenes y el registro de resultados.

La evidencia de la app sigue vinculada al servicio, equipo y configuración que terminaron una creación. Estos tests no rellenan ni certifican silenciosamente la biblioteca habitual de la persona.

## Resultados

**Completado en Windows nativo** sobre la RTX 4050 Laptop de 6 GB y 16 GB nominales de RAM, con ComfyUI 0.35.0:

- Pausa después de recibir `432799` bytes nuevos sobre el prefijo local de `1864190438` bytes.
- `.part` conservado de `1864623237` bytes tras cerrar y reabrir el servicio.
- HTTP **206**, `Content-Range: bytes 1864623237-2132625893/2132625894`, para los `268002657` bytes pendientes; el CDN fue `us.aws.cdn.hf.co`.
- Archivo final con SHA-256 completo coincidente: `879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd`.
- **Seis imágenes reales**, una por cada fila de la tabla, creadas y guardadas mediante la UI. PNG de 512 × 512 y parámetros comprobados. Los seis trabajos siguieron completos al reabrir, sin reenviarse.
- Auxiliar y motor propios cerrados; bloqueo liberado y copias temporales de pesos retiradas. El archivo original y la sesión habitual se conservaron.

Registro y resultados: `%LOCALAPPDATA%\Veltria\catalog-real-2026-11-05T20-29-35-646Z-9c469e6f`, archivo `validated-catalog.json`. Allí están las seis imágenes descargadas, capturas de UI y de la biblioteca nativa. Las comprobaciones se pudieron continuar después de corregir una espera/selector del propio ejecutor, comprobando los trabajos ya terminados en lugar de volver a generarlos.

**Completado en Linux/WSL con Bun 1.4.4**, sin inferencia GPU: el adaptador de producción descargó desde el origen real los primeros `2105846` bytes, se interrumpió y continuó hasta `4217418` bytes. El prefijo reanudado coincide con el checkpoint completo previamente verificado; SHA-256 del prefijo `afc46bf689d9e77c461439c0199e7eda69f3f1bff2861031bb0845684c5163b2`. Se retiró sólo el `.part` temporal de la prueba. Registro: `/tmp/Veltria real model transfer N37fiN/validated-transfer.json`. Esto no se presenta como descarga completa ni inferencia en Linux.

También pasaron tipos, lockfile congelado, builds Linux/Windows, **17 pruebas Vitest**, **21 pruebas Bun (177 aserciones)**, **83 comprobaciones HTTP** en fuente/compilado y **15 recorridos de interfaz** del paquete Linux/Xvfb. Los recuentos y pruebas de fixtures son independientes de las seis inferencias reales de Windows.

## Repetir la prueba

Esta prueba es **manual y opt-in**: realiza tráfico real al proveedor y seis generaciones GPU. No forma parte de `bun run test`.

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\tests\windows-catalog-real.ps1 -ModelsDirectory 'D:\Veltria\models'
```

Si una comprobación de generación/interfaz falla después de completar y verificar la transferencia, el ejecutor puede continuar con `-ValidationDirectory` apuntando a su carpeta anterior. Sólo acepta su espacio de validación y el mismo modelo/revisión, conserva las imágenes completas comprobando sus trabajos y requiere que las copias de pesos sigan presentes. No se usa sobre la biblioteca habitual ni después de que la limpieza correcta haya retirado esas copias.

Para repetir sólo la transferencia acotada en Linux/WSL, sin GPU:

```bash
bun scripts/validate-model-transfer.ts dreamshaper-8 /mnt/d/Veltria/models/checkpoints/veltria-dreamshaper8-879db523.safetensors
```

Este comando verifica primero el SHA-256 de la referencia, limita cada tramo a aproximadamente 2 MiB y compara el prefijo recibido. No termina otra copia del modelo completo.

Requiere las dos variantes exactas del catálogo ya presentes en esa carpeta, una instalación ComfyUI local compatible y el paquete/lanzador de la versión del `package.json`. El directorio de modelos se aporta explícitamente. El script no acepta otro motor, intérprete o workflow arbitrario ni detiene procesos ajenos.

Las comprobaciones sin inferencia real siguen disponibles con `bun run typecheck`, `bun run test` y los recorridos de Playwright sobre el paquete de Linux/Xvfb. Los datos de fixtures se identifican como tales.

## Abrir esta entrega

Cerrar antes la versión anterior. En Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.5.1\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime
.\build\browser\0.5.1\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.5.1/linux-unpacked/veltria
./build/browser/0.5.1/veltria-web
```

Protocolo 6 y SQLite 4, sin cambios de esquema. Los paquetes anteriores se conservan. Pendiente: GPU e inferencia de ambos modelos en Linux nativo; descarga completa nueva de DreamShaper desde cero en esta versión, corte no controlado de red, resoluciones/formatos adicionales de DreamShaper, pruebas macOS y el flujo H3 del siguiente paso. No se generaliza la prueba de esta RTX 4050 a todos los equipos ni se prometen tiempos de generación.
