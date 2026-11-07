# Calidad de imagen

En Crear → Calidad de imagen se elige tamaño y esfuerzo de generación. Ajustar manualmente permite ancho, alto, pasos y CFG. El resumen muestra los valores que recibirá la siguiente imagen, en español o inglés y en ambos clientes.

| Familia | Tamaños propuestos, lado largo | Inicio | Límites manuales por lado |
| --- | --- | --- | --- |
| SD 1.5, DreamShaper y LoRA SD 1.5 admitidos | 512, 768, 1024 px | 512 px | 256–1024 px |
| SDXL Base oficial | 768, 1024, 1536 px | 768 px | 512–1536 px |

El formato propone dimensiones cuadradas, horizontales o verticales. Los valores manuales de ancho y alto definen el formato final. Se exigen múltiplos de 64; el servidor valida además los límites de familia.

El esfuerzo ofrece 12 pasos, los pasos de la configuración seleccionada y 30 pasos. Manualmente: 1–60 pasos y CFG 1–15. Se mantiene Euler/normal, una imagen por trabajo y PNG sin pérdida. No incluye refiner ni escalado posterior.

Estos son límites de la receta admitida por Veltria, no límites universales del modelo ni garantía de ejecución. Superar el tamaño inicial muestra un aviso de memoria y permite intentarlo dentro de esos límites. Más píxeles requieren más memoria; más pasos tardan más y no siempre mejoran el resultado. SD 1.5 a tamaños grandes también puede alterar la composición.

## Persistencia y comprobación

- Se aplican a la siguiente imagen sin modificar la configuración portable ni descargar pesos.
- El borrador se conserva al recargar esa pestaña, asociado a su configuración. Cambiar de modelo/configuración restablece sus valores; también existe Restablecer ajustes del modelo.
- El trabajo guarda dimensiones, pasos, CFG, semilla y solicitud de calidad reales; la biblioteca permite consultarlos.
- Cambiar ajustes con un identificador de solicitud ya utilizado se rechaza para conservar idempotencia.
- Los valores inválidos impiden crear y muestran cómo corregirlos. Los controles se bloquean durante operaciones en curso.
- La etiqueta comprobada exige coincidencia de dimensiones, pasos y CFG. Una prueba con valores modificados no certifica la configuración base.

En Windows se comprobó SDXL a 768 × 768, 20 pasos/CFG 7, y a 1024 × 1024, 24 pasos/CFG 6,5. Las opciones de 1536 px y extremos de pasos/CFG no tienen una generación GPU certificada. Evidencia y repetición optativa en [validation.md](validation.md); comandos de apertura en [README](../README.md).
