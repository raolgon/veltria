# Veltria — nosotros hacemos el trabajo pesado

**La persona decide qué quiere crear. Veltria prepara lo necesario para hacerlo en su equipo.**

## Empezar por la intención

Antes de la primera creación, la pantalla principal prepara el equipo: Veltria detecta recursos y propone el conjunto modelo, componentes, receta y ajustes. El editor permanece oculto hasta contar con un modelo preparado. Después, crear una imagen comienza con una descripción y elecciones comprensibles. Los nombres técnicos y los controles avanzados se pueden consultar sin convertirlos en requisitos del recorrido sencillo.

La recomendación ayuda a elegir según el equipo. No decide qué debe imaginar la persona ni transforma su descripción de forma oculta. No necesita un LLM adicional.

## Una preparación completa

Primero buscar y comprobar ComfyUI existente. Si sirve, reutilizarlo sin modificar su entorno ni sus modelos. Si falta, ofrecer preparar una instalación propia y aislada, con versiones fijadas. La configuración manual de rutas y puertos es una alternativa avanzada.

La acción **Preparar mi equipo** muestra antes descarga pendiente, espacio final/temporal, ubicación, fuente, licencia y cambios. Autorizar el conjunto una vez; resolver internamente sus dependencias. Volver a pedir una decisión sólo si cambia materialmente el plan o hace falta un permiso/acceso nuevo. Un controlador del SO o un acceso restringido puede requerir intervención real; explicarla y verificar su resultado.

Mostrar fases y progreso medible. Si no existe un denominador fiable, indicar actividad sin inventar porcentajes. Preparar no envía automáticamente una generación. Al terminar se habilita **Crear imagen**, conservando descripción y ajustes.

Este recorrido es el objetivo de producto. La instalación administrada está implementada en desarrollo; su aceptación exige pruebas reales por plataforma y usabilidad. Reutilizar un ComfyUI existente no basta para declarar la app lista para principiantes desde cero.

## Modelos, adaptaciones y calidad

Un archivo descargado no es un perfil preparado. Reunir y verificar todos los componentes de la receta. Separar compatibilidad declarada, estimación por recursos y ejecución comprobada con equipo/ajustes concretos.

Presentar adaptaciones LoRA sólo con una base compatible y su intensidad visible. No exigir mover archivos ni descubrir incompatibilidades mediante un fallo. No añadir palabras ocultas al prompt ni asumir que todas las adaptaciones funcionan por tener la misma extensión.

Dejar elegir resolución y esfuerzo dentro de la receta admitida. Explicar que más píxeles usan más memoria y más pasos no garantizan calidad. Recomendar un punto de partida sin presentar los valores superiores como certificados.

## Recuperar dentro de Veltria

Un fallo conserva la descripción, ajustes, archivos íntegros y progreso recuperable. Ofrecer una acción concreta para continuar, elegir otra ubicación o reducir recursos. No repetir una generación cuyo envío sea incierto; consultar su estado antes de reenviar.

No reparar una instalación externa alterando sus paquetes sin autorización específica. No borrar modelos o creaciones al retirar un componente. Una retirada compartida explica los perfiles afectados; una reparación futura debe preservar los datos de la persona.

## Una experiencia local y coherente

Navegador y Electron usan el mismo servicio y muestran el mismo plan, trabajos y biblioteca. Los resultados, modelos y cálculos permanecen en el equipo. La futura LAN seguirá usando ese host, con activación y emparejamiento explícitos; no es inferencia móvil ni sincronización cloud.

Obsidian, temas, idiomas, teclado y móvil deben facilitar completar la tarea. Los estados vacíos, errores y funciones pendientes son parte del producto. No usar temporizadores, imágenes de muestra o botones sin respaldo para aparentar preparación o resultados reales.

## Criterios de aceptación

- Una persona nueva puede preparar un perfil admitido sin terminal, tutoriales externos o edición de workflows.
- Conoce la descarga, ubicación y cambios antes de autorizar; no confirma cada dependencia interna.
- Descargar, preparar y comprobar ejecución son estados distintos y verificables.
- Las interrupciones permiten recuperar lo seguro sin duplicar instalaciones ni envíos.
- La compatibilidad de LoRA y los ajustes se revalida al cambiar de modelo.
- Un fallo ofrece recuperación o identifica honestamente la intervención externa inevitable.
- Las pruebas de usabilidad registran si la persona consigue crear, sus decisiones obligatorias y sus dificultades. No se presentan como realizadas mientras estén pendientes.

Priorizar pocos recorridos completos y comprobados. El estado real y el siguiente hito están en [docs/status.md](docs/status.md).
