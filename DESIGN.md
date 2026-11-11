# Veltria — diseño Obsidian

Identidad de la aplicación compartida Vue: grafito/ámbar en oscuro y marfil/cobre en claro, con opción sistema. La implementación vigente está en `apps/ui/src`; `ui-prototype` y las imágenes de `design` son referencias conceptuales, no evidencia de funciones o rendimiento.

## Composición

Navegación: Crear, Modelos, Biblioteca, Mi equipo y Ajustes. En escritorio, menú lateral con recursos compactos, espacio de descripción/resultado e inspector de modelo y ajustes. Acción principal ámbar y detalles técnicos desplegables. En móvil, seguir [MOBILE-UI.md](MOBILE-UI.md).

El primer inicio prepara un modelo antes de mostrar el editor. Después, la persona empieza por la idea. Preparación resume recursos, descarga, espacio, ubicación y cambios antes de autorizar. No convertir cada dependencia en otra pantalla. Modelo, licencia, parámetros e incertidumbre permanecen consultables. Mantener descripciones y ajustes al navegar, preparar o recuperar errores.

La calidad ofrece elecciones sencillas y campos manuales para quien los necesite, mostrando los valores reales. Compatibilidad, disponibilidad de pesos y ejecución comprobada no son el mismo estado. Un ejemplo visual se identifica como ejemplo; la ilustración de bienvenida no se presenta como una creación del usuario.

Video sigue identificado como experimental. Las funciones futuras no tienen controles que simulen resultados. El recorrido busca/reutiliza ComfyUI y ofrece instalación propia si falta, con plan, consentimiento y progreso real. La elección avanzada de destino conserva los archivos de ubicaciones anteriores.

## Tokens y temas

Los tokens semánticos actuales viven en `apps/ui/src/style.css`, con ajustes de composición en `app.css` y `mobile.css`. No mantener una segunda paleta divergente en la documentación.

| Token | Oscuro | Claro |
| --- | --- | --- |
| `--bg` | `#171717` | `#f5f2ec` |
| `--panel` | `#20201f` | `#fffdf9` |
| `--input` | `#1a1a19` | `#faf7f1` |
| `--text` | `#ece9e4` | `#24211d` |
| `--muted` | `#aaa49a` | `#6c645a` |
| `--line` | `#36332f` | `#ded7cd` |
| `--accent-text` | `#f4b55e` | `#8c4e12` |

Una estructura de componentes para ambos temas. Guardar preferencia en el servicio/SQLite; caché local sólo de presentación. Aplicar sin reiniciar ni perder entradas. Sistema sigue `prefers-color-scheme`; Electron refleja su tema nativo. Los colores de las imágenes generadas no se alteran por cambiar de tema.

## Interacción y contenido

La bienvenida inicial adopta la propuesta 3 elegida por el usuario: pantalla completa sin editor detrás, hardware, recomendación principal, alternativa visible y acceso a más modelos. El plan se revisa en la misma página. Sin vínculo y modelo preparado no se muestra la navegación del estudio. La implementación y los estados se describen en [el brief de inicio](design/welcome-brief.md).

Español e inglés mediante el catálogo compartido, con contenido del usuario literal. Iconos y recursos incluidos localmente. Mensajes de error con siguiente acción; datos desconocidos como desconocidos. Éxito/aviso/error incluyen texto o icono además del color.

Controles de teclado y foco visible, etiquetas asociadas, estados de carga/vacío/fallo/deshabilitado, contraste y desplazamiento de diálogos. Sin reducir texto para encajar móvil ni desactivar zoom. Transiciones discretas y respeto a movimiento reducido. No añadir un LLM por copiar un botón conceptual de mejorar descripción.

## Comprobación

Revisar temas e idiomas en navegador y Electron, escritorio/móvil, formularios y diálogos, contenido largo y recuperación de errores. Distinguir capturas responsive de dispositivos físicos. Escalado Windows, lectores de pantalla, teclado virtual y pruebas de usabilidad siguen ampliándose; no se declaran certificados por pasar un detector visual. [Validación](docs/validation.md), [filosofía](PHILOSOPHY.md).
