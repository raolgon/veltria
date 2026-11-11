# Interfaz móvil y tableta

La aplicación de `apps/ui` comparte componentes y servicio con escritorio. Sus reglas responsive están en `style.css`, `app.css` y `mobile.css`; el prototipo permanece como referencia visual.

## Comportamiento

- Hasta 740 px: navegación inferior para Crear, Modelos, Biblioteca, Mi equipo y Ajustes; sin barra lateral.
- Descripción antes de la previsualización y opciones. Imagen y video reflejan sus capacidades reales; audio sigue pendiente.
- Acción principal accesible y barras adaptadas a la edición de texto. Conservar borradores al cambiar de vista.
- Controles táctiles amplios, entradas legibles a 16 px, zoom permitido y áreas seguras.
- Diálogos desplazables y con cierre/foco accesibles; rutas, nombres y revisiones largas no deben provocar desbordamiento horizontal.
- Catálogo, biblioteca, configuración manual de calidad y ajustes utilizan el ancho disponible. Tableta conserva navegación compacta y controles ampliados.
- Orientación horizontal y poca altura requieren desplazamiento útil, no reducir toda la interfaz.

## Cobertura

Los recorridos automatizados han usado 320 × 568, 390 × 844, 768 × 1024, 1363 × 900 y 740 × 360, con ambos temas y los idiomas admitidos según el caso. Se revisaron capturas de los controles de calidad en escritorio y 320 px. Ver [validación](docs/validation.md).

Faltan pruebas físicas iOS/Android, teclado virtual, áreas seguras, orientación y lectores de pantalla. Responsive no habilita acceso desde un teléfono por sí solo: el servicio sigue en loopback. La futura conexión LAN requiere [emparejamiento y permisos](LOCAL-NETWORK.md); no implica inferencia móvil ni PWA.
