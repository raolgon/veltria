# Veltria — interfaz móvil

Actualizado el 4 de noviembre de 2026. Esta revisión adapta el prototipo Vue a pantallas de teléfono y tableta, conservando Obsidian oscuro/claro/sistema. El HTML actualizado sigue en ui-prototype/veltria.html; los estilos específicos están en ui-prototype/src/mobile.css.

## Comportamiento

- Hasta 740 px de ancho, la interfaz ocupa toda la pantalla: navegación inferior con Crear, Modelos, Biblioteca, Mi equipo y Ajustes. La barra lateral queda para pantallas mayores.
- Crear muestra primero las tareas admitidas y la descripción; después aparece la ilustración/imagen de referencia y las opciones. Video/audio futuros se ocultan en el teléfono.
- La acción principal permanece en una barra sobre la navegación. Tu perfil lleva directamente al panel de opciones. Ambas barras se ocultan mientras se edita el texto para dejar espacio; reaparecen al salir del campo.
- Controles principales de al menos 44 px de alto, entradas de texto a 16 px en móvil, tamaños de lectura mayores y libertad para ampliar la página. No se desactiva el zoom.
- Los diálogos de preparación, perfiles y LoRA son paneles inferiores desplazables, con cierre accesible, foco contenido y fondo inactivo. A 320 px los datos del plan pasan a dos columnas más una fila de ubicación y las adaptaciones a una sola columna.
- Catálogo, biblioteca, equipo y ajustes también usan todo el ancho y conservan la navegación. Cambiar de pantalla lleva al inicio sin eliminar el prompt.
- Hay reglas para orientación horizontal de poca altura, áreas seguras y tema claro/oscuro. La tableta conserva el espacio de trabajo con navegación compacta y controles ampliados.
- La indicación de prototipo continúa visible. Los estados de preparación, hardware y compatibilidad son ilustrativos; no se convierten en funciones reales por adaptar el diseño.

## Verificación de esta entrega

Build de producción y comprobación de tipos con Vue/Vite en Linux. El HTML autocontenido se revisó en Chromium dentro de marcos con tamaños de viewport explícitos; no es emulación de un dispositivo físico.

| Viewport de prueba | Revisión | Resultado |
| --- | --- | --- |
| 320 × 568 | Crear, Modelos, Biblioteca, Mi equipo y Ajustes | Sin desbordamiento horizontal; navegación inferior accesible. |
| 390 × 844 | Crear y edición del prompt | Sin desbordamiento; barras inferiores ocultas al escribir. |
| 320 × 568 | Preparación y selector de LoRA | Paneles contenidos en altura y ancho, con desplazamiento interno. |
| 768 × 1024 | Estudio en tableta | Sin desbordamiento; navegación compacta. |
| 1363 × 900 | Estudio en escritorio | Sin desbordamiento; navegación lateral. |
| 740 × 360 | Estudio horizontal | Sin desbordamiento; reglas de poca altura. |

Se revisaron los temas claro y oscuro y se conservó el texto al recorrer las vistas. La pantalla de teléfono usa barras de desplazamiento del navegador de escritorio durante estas pruebas, por lo que el ancho útil puede ser algo menor al viewport indicado.

Pendiente: pruebas en Safari/iOS y Android reales, teclado virtual, áreas seguras físicas, lectores de pantalla, importación de archivos y cambios de orientación en esos sistemas. No se han validado inferencia, descarga, Electron ni Bun mediante esta adaptación visual.

## Alcance de arquitectura

La adaptación móvil comparte componentes y contratos. El requisito de controlar el host desde el teléfono por la misma LAN/Wi-Fi ya está aceptado y definido en LOCAL-NETWORK.md. La implementación de red sigue pendiente: loopback por defecto y listener LAN sólo mediante activación/emparejamiento. No añade una PWA ni generación en el teléfono. La UI puede revisarse como HTML offline sin un motor activo.

Al implementar FIRST-TASK.md, reutilizar este comportamiento responsive y verificarlo con los estados reales disponibles. Conservar también la ruta de escritorio y los límites de los hitos. Los controles de ejemplo siguen siendo sólo una referencia de diseño hasta integrarse con el servicio.
