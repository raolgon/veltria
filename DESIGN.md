# Veltria — Obsidian

Dirección visual elegida el 31 de octubre de 2026. Obsidian sustituye las referencias previas. La marca de la aplicación sigue siendo Veltria; Obsidian es el nombre de su dirección visual.

## Interfaz actualizada

La composición navegable vigente está en `ui-prototype/veltria.html`, con fuente Vue en `ui-prototype/src/`. Leer UI-PREVIEW.md. Aplica la filosofía con tareas primero, preparación unificada y controles avanzados progresivos. Las imágenes originales conservan el estilo/paleta; si sus controles conceptuales difieren del nuevo flujo, seguir el prototipo y PHILOSOPHY.md. Los escenarios de instalación, compatibilidad y hardware del prototipo son ejemplos explícitos, no funciones de backend implementadas.

## Referencias aprobadas

- `design/obsidian-dark.png`: grafito y ámbar; propuesta oscura elegida por el usuario.
- `design/obsidian-light.png`: versión clara de la misma interfaz, con marfil, texto carbón y ámbar/cobre.

Mantener estructura, posiciones y jerarquía equivalentes. La versión clara no cambia a la distribución de Aether. Imágenes conceptuales: no son capturas de una aplicación implementada ni pruebas de rendimiento. Los perfiles, métricas, contadores y estados son ilustrativos.

## Facilidad de uso como requisito

Aplicar PHILOSOPHY.md. Priorizar tareas e intención sobre nombres de motores o formatos de pesos. La ruta normal del producto presenta Preparar este equipo y, para cada perfil, Preparar para crear; Usar una instalación existente es una alternativa avanzada. Los nombres de modelo, fuentes y parámetros siguen consultables en detalles.

Una tarjeta de preparación resume compatibilidad, descarga pendiente y espacio/ubicación antes de empezar. Después, una operación muestra fases legibles y acciones reales de recuperación. No convertir cada dependencia en una pantalla o confirmación. Reservar los paneles técnicos para detalles desplegables.

Cuando se habiliten LoRA, mostrar adaptaciones compatibles con la tarea y perfil elegidos, su propósito, intensidad y cualquier palabra añadida al prompt. No obligar a buscar carpetas ni a descubrir incompatibilidades mediante una generación fallida. Las tareas futuras y funciones aún inexistentes no se presentan como botones operativos.

Estas decisiones afinan el flujo funcional; las imágenes Obsidian conservan la dirección visual y no obligan a reproducir controles conceptuales que contradigan la facilidad de uso.

## Adaptación móvil

Desde el 4 de noviembre de 2026, seguir MOBILE-UI.md y el mismo prototipo para teléfono/tableta. Hasta 740 px, sustituir la barra lateral por navegación inferior, priorizar la descripción sobre la ilustración y mantener una acción principal al alcance del pulgar. Ocultar las barras inferiores durante la edición de texto. Controles táctiles de al menos 44 px, texto de entrada a 16 px, zoom permitido y áreas seguras. Los diálogos son paneles desplazables en lugar de reducir la UI de escritorio. En tableta se amplían controles y se conserva navegación compacta.

Esto amplía el requisito visual a móvil. El control del equipo principal por la misma LAN/Wi-Fi es un requisito aceptado, descrito en LOCAL-NETWORK.md, y sigue pendiente de implementación; no implica un motor móvil o una PWA. La validación realizada y los dispositivos pendientes se especifican en MOBILE-UI.md.

## Red local en Ajustes

Mostrar Compartir en mi red local con estado real, dirección/QR sólo cuando existan y gestión de dispositivos autorizados en el host. En el prototipo el interruptor permanece deshabilitado y Ver cómo se conectarán explica el recorrido sin fingir una sesión activa. En un cliente conectado, identificar el equipo que procesa, pérdida de conexión y las capacidades disponibles. El hardware mostrado corresponde al host.

## Composición

- Navegación lateral compacta con iconos y texto.
- Selector de tarea en la parte superior del espacio de trabajo.
- Previsualización grande y dominante en el centro.
- Inspector derecho para modelo, compatibilidad, formato y ajustes avanzados.
- Compositor de prompt debajo de la previsualización; acción principal ámbar fácil de encontrar.
- Estado local y hardware en una franja discreta.

Priorizar acciones familiares y buena lectura. Esquinas moderadamente redondeadas, separadores finos, sombras y gradientes contenidos. Detalles geométricos de marca discretos; no añadir efectos costosos, transparencias que dificulten leer ni animaciones permanentes.

La navegación funcional acordada es Crear, Explorar/Modelos, Biblioteca, Mi equipo y Ajustes. Las capturas pueden usar etiquetas conceptuales diferentes: ajustar los textos a las funciones implementadas. Video y audio se incorporan después del primer flujo de imagen. Botones como Improve prompt no autorizan introducir un asistente o un LLM adicional.

## Paleta inicial de implementación

Estos valores son tokens propuestos para implementar el diseño, no colores extraídos exactamente de las imágenes. Usar nombres semánticos y verificar el contraste al aplicarlos.

| Token | Oscuro | Claro |
| --- | --- | --- |
| AppBackground | `#171717` | `#F5F2EC` |
| PanelBackground | `#222221` | `#FFFDF9` |
| InputBackground | `#1B1B1A` | `#FFFFFF` |
| TextPrimary | `#ECE9E4` | `#24211D` |
| TextSecondary | `#B8B1A8` | `#655D53` |
| Separator | `#3B3935` | `#DED7CD` |
| AccentText | `#F4B55E` | `#945213` |
| PrimaryButton | `#F4B55E` | `#E8A345` |
| OnPrimaryButton | `#21170C` | `#21170C` |

En modo claro, el ámbar brillante funciona como relleno de acciones con texto oscuro; las etiquetas pequeñas usan cobre más oscuro. Reservar colores de éxito, aviso y error para su significado y acompañarlos de texto/iconos. Definir recursos separados para selección, hover, pressed, disabled y foco, comprobando contraste en ambos temas.

## Temas desde el primer hito

Actualización técnica del 3 de noviembre de 2026: una UI Vue 3 con SFC y Composition API compartida entre navegador local y Electron. Mantener las mismas imágenes y paleta. Implementar con HTML semántico y CSS, sin reinterpretar el diseño por plataforma.

- Selector de apariencia: System / Light / Dark, con etiquetas localizables.
- Predeterminado System; el usuario puede forzar cualquiera de los dos temas.
- Guardar la elección en SQLite a través del servicio local. Aplicar el tema temprano al cargar; una caché local de presentación puede evitar destellos, pero el servicio es la autoridad. Sin servicio, permitir una preferencia visual temporal y mostrar la desconexión.
- Cambio inmediato, sin reiniciar la app o el motor y sin perder el prompt ni los ajustes.
- System responde a prefers-color-scheme; Electron sincroniza sus elementos propios mediante nativeTheme. No hacer que el cambio del SO sobrescriba una elección Light/Dark explícita.
- Una sola estructura de componentes/DOM. Usar variables CSS semánticas y atributos/clases de tema; evitar duplicar pantallas o introducir dependencias de Electron en componentes comunes.
- Fondos, texto, iconos, menús, diálogos, tooltips, selección, foco y estados siguen el tema. Revisar explícitamente cada ventana y popup propios.
- El contenido generado y los archivos de referencia conservan sus colores.

Referencia técnica del contenedor: https://www.electronjs.org/docs/latest/api/native-theme. La UI usa variables CSS y matchMedia para la preferencia del sistema; comprobar soporte en los navegadores elegidos.

## Validación visual

Validar la misma UI en navegador y Electron. En teléfono, seguir la composición y navegación de MOBILE-UI.md sin encoger el texto; validar los estados realmente disponibles del primer hito en los mismos anchos. Fuentes e iconos disponibles localmente en producción, sin depender de CDN.

Comprobar ambos temas con las ventanas de Crear, Mi equipo y Ajustes; estados vacío, cargando, error y deshabilitado; dropdowns, diálogos y navegación por teclado. Probar el cambio con texto introducido y después de reiniciar. Evitar depender sólo del color y comprobar lectura con escalado de pantalla de Windows.

Además de la revisión visual, validar los recorridos de PHILOSOPHY.md con personas nuevas cuando la función exista: preparación sin pasos manuales externos, primera creación, selección de LoRA y recuperación de fallo. Registrar el resultado observado; contar clics sin comprobar que la tarea se completó no basta.

## Procedencia de las referencias

Referencias creadas con la herramienta de generación de imágenes integrada. La captura oscura procede de la propuesta Obsidian; la clara se editó a partir de ella.

Prompt de la transformación clara: «Convert Obsidian to warm ivory and amber light theme; preserve layout, controls, lettering and the desert preview.»

Las imágenes guían la composición y el estilo. No se utilizan como fondos de una interfaz simulada: los controles de producción deben ser componentes web reales y accesibles compartidos entre navegador y Electron.
