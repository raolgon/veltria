# Elegir con una propuesta clara · 0.6.2

En Modelos, **Recomendación de Veltria** prioriza opciones comprobadas con los ajustes elegidos, preparadas, descargadas y parcialmente descargadas, antes de opciones sin archivos locales. Es una recomendación para facilitar la preparación, no una puntuación de calidad visual ni un benchmark. La compatibilidad y la memoria disponible siguen procediendo del servicio local; no se estima VRAM a partir del tamaño del archivo.

La propuesta muestra el modelo, el motivo real de compatibilidad o memoria limitada y **Usar esta propuesta**, que recorre la selección/preparación existente. Conserva las decisiones de descarga y el prompt. Sin hardware confirmado o por debajo de los mínimos, explica el motivo sin presentar una propuesta como viable.

Cada ficha local explica su utilidad y muestra los ajustes elegidos y sus dimensiones reales (cuadrado, horizontal o vertical). Para SD 1.5 y DreamShaper se mantienen los ejemplos reales incluidos. No se inventan especialidades para modelos desconocidos ni galerías de terceros: se remite a la descripción del autor. Los resultados externos proponen Equilibrada a 512 × 512 y distinguen el tamaño del archivo elegido de la descarga pendiente del conjunto. Un LoRA explica que necesita un modelo base y que el plan reúne ambos componentes.

En resultados externos, se priorizan fuentes que ya tienen opciones locales reutilizables; después se mantiene el orden por descargas. **Popularidad** conserva como alternativa el orden por descargas del proveedor. No se asignan números de popularidad ficticios a los modelos locales. La selección de otra variante de un repositorio sigue requiriendo revisar su propio plan: compartir una fuente no implica compartir pesos ni una generación verificada.

## Evidencia de generación

**Comprobado con los ajustes elegidos** exige que la evidencia del servicio corresponda al modelo y configuración actualmente seleccionados y que las dimensiones coincidan con el formato elegido. Cambiar el desplegable a otros ajustes no hereda esa etiqueta. Preparado sigue siendo distinto de comprobado. No se amplía la evidencia de las pruebas aisladas a la biblioteca habitual del usuario.

## Comprobaciones

Tipos, **24 pruebas Vitest**, **22 pruebas Bun (184 aserciones)** y **83 comprobaciones HTTP**. Las pruebas nuevas cubren configuración/dimensiones de evidencia, prioridad de opciones preparadas y ausencia de especialidades inventadas. **18 recorridos de interfaz** comprueban recomendación frente a popularidad, propuesta visible, ajustes iniciales y adaptación a escritorio/móvil, además de la regresión existente.

Se construyen auxiliares y paquetes Linux/Windows. Se comprueban el lanzador web y el arranque/cierre del escritorio en Windows nativo, con datos de prueba separados. No se descargan nuevos modelos ni se repite inferencia GPU para esta mejora de presentación. Las pruebas GPU previas permanecen documentadas en model-discovery.md.

Pendiente: GPU en Linux nativo, macOS y recetas de nuevas familias. Esta entrega no añade familias ni promete que los modelos recientes funcionen por tener una ficha.

## Abrir

Cerrar antes la versión anterior. Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.6.2\win-unpacked\Veltria.exe
# Navegador: abrir el enlace que imprime
.\build\browser\0.6.2\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.6.2/linux-unpacked/veltria
./build/browser/0.6.2/veltria-web
```

Protocolo 6, SQLite 4; se conservan datos, modelos y paquetes anteriores.
