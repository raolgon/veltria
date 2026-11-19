# Interfaz móvil y tableta

La aplicación de `apps/ui` comparte componentes y servicio con escritorio. Sus reglas responsive están en `apps/ui/src/style.css`, `app.css` y `mobile.css`.

## Comportamiento

- Hasta 740 px: navegación inferior para Crear, Modelos, Biblioteca, Mi equipo y Ajustes; sin barra lateral.
- Descripción antes de la previsualización y opciones. Imagen y video reflejan sus capacidades reales; audio sigue pendiente.
- Acción principal accesible y barras adaptadas a la edición de texto. Conservar borradores al cambiar de vista.
- Controles táctiles amplios, entradas legibles a 16 px, zoom permitido y áreas seguras.
- Diálogos y pantallas de vinculación LAN desplazables y con cierre/foco accesibles; rutas, nombres y revisiones largas no deben provocar desbordamiento horizontal.
- Catálogo, biblioteca, configuración manual de calidad y ajustes utilizan el ancho disponible. Tableta conserva navegación compacta y controles ampliados.
- Orientación horizontal y poca altura requieren desplazamiento útil, no reducir toda la interfaz.

## Cobertura

Los recorridos automatizados han usado 320 × 568, 390 × 844, 768 × 1024, 1363 × 900 y 740 × 360, con ambos temas y los idiomas admitidos según el caso. Ver [validación](docs/validation.md).

Para conectar un teléfono o tableta al equipo principal se activa el acceso en red local desde Ajustes y se vincula mediante código o QR ([LOCAL-NETWORK.md](LOCAL-NETWORK.md)); el teléfono controla el servicio del host y no ejecuta inferencia local ni instala una PWA. Faltan pruebas físicas en iOS/Android reales, teclado virtual, áreas seguras, orientación y lectores de pantalla.
