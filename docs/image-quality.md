# Veltria 0.9 · calidad de imagen a tu elección

6 de noviembre de 2026. Rama `development`. Sin subagentes.

En **Crear → Calidad de imagen** se puede elegir tamaño y esfuerzo de generación, y abrir **Ajustar manualmente** para introducir ancho, alto, pasos y CFG. Funciona en español e inglés, navegador y Electron. El resumen muestra siempre los valores que recibirá la siguiente creación.

## Opciones y límites

| Familia | Tamaños propuestos, lado largo | Ajuste inicial | Límites manuales por lado |
| --- | --- | --- | --- |
| SD 1.5, DreamShaper y adaptaciones SD 1.5 admitidas | 512, 768, 1024 px | 512 px | 256–1024 px |
| SDXL Base oficial | 768, 1024, 1536 px | 768 px | 512–1536 px |

El formato propone dimensiones cuadradas, horizontales o verticales. Ancho y alto manuales definen el formato final. Se usan múltiplos de 64; el servidor comprueba los límites de la familia además de la validación del formulario. Estos son límites de la **receta de generación directa admitida por Veltria**, no límites universales de las arquitecturas ni una garantía de ejecución a todos los tamaños.

El esfuerzo ofrece 12 pasos, los pasos de la configuración seleccionada y 30 pasos. Manualmente admite 1–60 pasos y CFG 1–15. Conserva Euler/normal, una imagen por trabajo y PNG sin pérdida. No añade refiner, escalado posterior ni un porcentaje ficticio de calidad.

Al superar el tamaño inicial se avisa del mayor consumo y del posible agotamiento de memoria, pero se permite intentarlo dentro de estos límites. Más resolución o pasos no garantizan mejor composición o calidad. Los tamaños grandes de SD 1.5 también pueden dar defectos de composición. Los mínimos de hardware del perfil siguen aplicándose; cumplirlos para el punto de partida no garantiza sus opciones superiores.

## Datos y comportamiento

- Los cambios se aplican por imagen, sin modificar el JSON de la configuración elegida ni descargar pesos de nuevo.
- El borrador de ajustes se conserva en esa pestaña al recargar y se asocia a su configuración. Cambiar de modelo/configuración restablece sus valores iniciales. **Restablecer ajustes del modelo** elimina las modificaciones manuales.
- Cada trabajo guarda dimensiones, pasos, CFG y la solicitud de calidad. La biblioteca muestra los valores reales. Los trabajos antiguos, sin el campo opcional nuevo, siguen siendo legibles.
- Los reintentos del mismo identificador conservan la idempotencia; cambiar los ajustes con ese identificador se rechaza para evitar confundir dos solicitudes.
- Los controles quedan bloqueados durante una operación en curso. Los valores inválidos impiden crear y muestran cómo corregirlos.
- La etiqueta de ejecución comprobada exige coincidencia con dimensiones, pasos y CFG. Una ejecución con pasos o CFG modificados no certifica la configuración base. Se mantiene separada la evidencia histórica.

Protocolo **8**, SQLite de trabajos **4**, sin nueva migración. Cerrar versiones anteriores antes de abrir 0.9; no se garantiza bajar de versión conservando los trabajos nuevos con todos sus campos.

## Prueba real en esta PC

Se reutilizaron el checkpoint SDXL ya autorizado en `D:\Veltria\models\checkpoints` y el ComfyUI existente. **No hubo nuevas descargas de modelos ni instalaciones.**

Desde los controles de la UI Windows se eligieron **1024 × 1024, 24 pasos y CFG 6,5**. La RTX 4050 Laptop de 6 GB, con 16 GB de RAM nominales, produjo un PNG válido de esas dimensiones; se guardó, se inspeccionó visualmente y permaneció en la biblioteca aislada después de reiniciar. El log confirmó `LOW_VRAM`. La configuración base permaneció en 20 pasos y CFG 7 y no recibió una certificación por la prueba personalizada.

ComfyUI registró 42,39 segundos de ejecución del prompt. La petición de la UI a la finalización tomó unos 50,30 segundos en esta ejecución. No es un benchmark, ni una promesa de tiempo o consumo; no se midió el pico de VRAM.

Evidencia local:

```text
C:\Users\rafao\AppData\Local\Veltria\image-quality-real-1793995271429-fe666a30\validated-sdxl.json
C:\Users\rafao\AppData\Local\Veltria\image-quality-real-1793995271429-fe666a30\sdxl-real.png
C:\Users\rafao\AppData\Local\Veltria\image-quality-real-1793995271429-fe666a30\sdxl-real-ui.png
C:\Users\rafao\AppData\Local\Veltria\image-quality-real-1793995271429-fe666a30\image-engine\engine.log
```

El registro confirma `passed`, `ownedServiceClosed`, `checkpointRetained` y los parámetros solicitados. Se cerraron sólo los procesos de la prueba. La biblioteca habitual y los modelos anteriores se conservaron. Esta prueba usó el Node interno del Electron 0.8 como controlador de automatización, con UI, lanzador y servicio **0.9**; no ejecutó la aplicación 0.8 como producto.

Para repetirla voluntariamente con el modelo existente y sin trabajos activos:

```powershell
.\tests\windows-sdxl-real.ps1 -ModelsDirectory 'D:\Veltria\models' -CustomQuality
```

## Comprobaciones y alcance

Resultados: TypeScript/Vue correctos; **31 pruebas Vitest**, **25 pruebas Bun (216 aserciones)**, **83 comprobaciones HTTP reales** y **20 recorridos UI** aprobados. Builds Windows/Linux y AppImage correctos; arranque nativo Windows de escritorio y navegador aprobado.

Pruebas de dominio y servicio comprueban límites por familia, entrada antigua sin calidad explícita, envío de dimensiones/pasos/CFG al flujo, rechazo de valores inválidos, reintentos, reapertura y conservación de la configuración y de su evidencia. El recorrido UI comprueba las opciones, validación visible, bloqueo de creación inválida, recarga, generación, restablecimiento e idiomas. Las capturas de escritorio y 320 px se revisaron; se corrigió el estiramiento del lienzo al desplegar controles.

**Windows:** generación SDXL real de 1024 px comprobada; servicio, lanzador web y escritorio nativos comprobados. Faltan pruebas GPU en todos los tamaños/formatos y con otras GPU, memoria bajo presión y cancelación durante una imagen grande. 1536 px y los extremos de pasos/CFG tienen validación de contrato, no una generación GPU certificada. Instalador firmado y Ctrl+C interactivo del lanzador siguen pendientes.

**Linux:** builds y pruebas de servicio/UI/Electron en WSL/Xvfb; falta generación GPU en Linux nativo y ejecución del AppImage en una distribución con pantalla/FUSE. **macOS:** build, ejecución y generación reales pendientes; este perfil no habilita Apple Silicon automáticamente.

## Abrir Veltria

Cerrar la versión anterior. Mantener ejecutables y sus recursos juntos.

```powershell
Set-Location 'C:\Users\rafao\Documents\ChatGPT\Veltria'
# Escritorio:
.\release\0.9.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime.
.\build\browser\0.9.0\veltria-web.exe
```

```bash
cd '/mnt/c/Users/rafao/Documents/ChatGPT/Veltria'
./release/0.9.0/linux-unpacked/veltria
./build/browser/0.9.0/veltria-web
```

Comprobaciones de desarrollo: `bun run typecheck`, `bun run test` y `xvfb-run -a bun run test:ui`. Las pruebas con fixtures no se presentan como inferencia GPU.
