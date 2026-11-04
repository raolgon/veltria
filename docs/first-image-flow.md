# De abrir Veltria a guardar la primera imagen

Definición del recorrido, 4 de noviembre de 2026. Público: una persona sin conocimientos de IA que quiere crear imágenes en su PC. Modo: operar. Dirección visual: Obsidian existente, misma experiencia en navegador y escritorio. Este documento conserva el recorrido acordado. Su implementación 0.2 y las pruebas realizadas se registran en [first-image-validation.md](first-image-validation.md); no amplía retrospectivamente el hito 1.

## Resultado esperado

La persona describe una imagen, acepta una preparación comprensible cuando falta algo y obtiene un resultado que puede guardar. Veltria elige una recomendación inicial según el equipo y prepara el conjunto necesario. Modelo exacto, workflow, motor y parámetros técnicos quedan consultables en detalles; aprender esos conceptos no es un paso del recorrido.

La recomendación debe ser un **perfil ejecutable revisado**: modelo y variante concretos, componentes, receta de generación y ajustes iniciales. La descarga de un archivo por sí sola no completa ese perfil. La persona conserva la posibilidad de cambiar la propuesta; no se cambian modelo, resolución o calidad silenciosamente.

## Lo que ve la persona

1. **Crear una imagen.** Campo «Describe lo que imaginas» y opciones esenciales de formato. Puede escribir antes de preparar el equipo. Su texto se conserva durante preparación, errores y navegación.
2. **Una propuesta para su PC.** Una opción recomendada al frente, con nombre comprensible y una explicación breve del equilibrio entre detalle y consumo. «Ver otras opciones» ofrece alternativas revisadas; los parámetros y nombres técnicos son secundarios. «Recomendado» exige evidencia y motivos, no sólo reconocer el nombre de la GPU.
3. **Preparar para crear.** Resumen de descarga pendiente, espacio requerido y ubicación. Cifras calculadas con archivos reales; estimaciones y desconocidos se indican. Reutilizar componentes ya disponibles después de comprobarlos. Pedir licencia o acceso de proveedor únicamente si corresponde. Una autorización cubre el conjunto mostrado.
4. **Progreso que se puede entender.** «Descargando», «Comprobando archivos» y «Preparando para crear», con bytes reales, progreso medible y fase indeterminada cuando no haya un total fiable. Pausar/reanudar sólo donde sea técnicamente posible. Una interrupción conserva el trabajo comprobado y ofrece una acción real de recuperación.
5. **Crear.** La acción cambia a «Crear imagen» al completar la preparación. No genera automáticamente por terminar una descarga. El usuario conserva su descripción y formato; al pulsar Crear ve el estado real del trabajo, su resultado y las acciones Guardar/Volver a crear. La biblioteca conserva imágenes y sus ajustes para reutilizarlos.

No mostrar un catálogo técnico como requisito de entrada. Tampoco tiempos de generación, tamaños de descarga, porcentajes o compatibilidad inventados para completar una tarjeta visual.

## Lo que resuelve Veltria

- Detectar el hardware del host real: GPU y VRAM, RAM, sistema, disco y memoria disponible. Distinguir Windows y WSL; no decidir únicamente por la VRAM total ni sumar RAM y VRAM.
- Consultar las capacidades del motor vinculado. Para esta PC, reutilizar la instalación existente comprobada; no instalar otro ComfyUI como requisito de este recorrido.
- Resolver el arranque de esa instalación vinculada cuando esté autorizado y soportado, sin exigir terminal o abrir otro gestor como paso cotidiano. Supervisar únicamente procesos propios; respetar motores abiertos por otra aplicación y no cambiar su entorno por conectar.
- Escoger inicialmente entre pocos perfiles revisados y probar al menos uno de imagen en el hardware objetivo. Reglas locales y evidencia bastan para la primera recomendación; no se necesita añadir un LLM.
- Calcular el plan completo, descargar desde fuentes declaradas, verificar integridad y preparar la receta. Los componentes y resultados de Veltria se mantienen separados de los archivos del motor externo. No sobrescribir modelos existentes ni instalar extensiones arbitrarias.
- Persistir preparación y trabajos en el servicio compartido. Navegador y Electron muestran la misma operación, sin iniciar descargas o generaciones duplicadas.
- Separar «archivos descargados», «preparado» y «verificado con estos ajustes». La primera generación satisfactoria aporta evidencia de ejecución; no prometer cualquier resolución por haber comprobado una sola.

## Recuperación y decisiones

Sin espacio: explicar cuánto falta y permitir elegir una ubicación compatible antes de descargar. Sin conexión: conservar la descripción y el estado recuperable; permitir usar un perfil ya preparado offline. Motor detenido: intentar el arranque vinculado sólo si esa acción está implementada y autorizada; en otro caso mostrar la intervención pendiente con claridad. Memoria insuficiente: conservar entradas y proponer un perfil o ajuste más ligero que la persona pueda aceptar, sin reintentar generaciones costosas automáticamente.

Un cambio importante de descarga, ubicación, código externo o resultado esperado requiere presentar el nuevo plan. Los pasos internos ya incluidos en la preparación no requieren nuevas confirmaciones.

## Alcance del siguiente incremento

Objetivo de producto: **una primera imagen real completa**, con un perfil pequeño comprobado, recomendación inicial acotada, preparación y progreso reales, generación y biblioteca mínima. Combina el flujo del hito 2 con la preparación de perfil del hito 3 sobre el motor existente. No exige construir primero el recomendador amplio del hito 4 ni instalar un segundo motor.

Antes de implementar debe seleccionarse y verificarse el perfil concreto, su fuente/licencia y el presupuesto de disco/memoria. No se fija un modelo por intuición ni se inicia una descarga al aprobar este diseño. La instalación ComfyUI comprobada declara principalmente modelos de video y LoRA; todavía no aporta un perfil de imagen validado por Veltria.

Se conserva la UI Obsidian, adaptación móvil, stack y límites de seguridad actuales. Quedan fuera de este incremento: video/audio, chat, mejorador de prompts con LLM, catálogo masivo, LoRA combinables sin validar, LAN, nube y nuevas instalaciones automáticas del motor externo.

## Prueba de aceptación

En Windows primero y después Linux, una persona nueva debe poder partir de Veltria con el motor vinculado, entender la descarga y su ubicación, preparar el perfil desde una acción visible, crear una imagen y guardarla, sin mover archivos ni editar workflows. Repetir con una descarga interrumpida, falta de espacio y motor detenido. Registrar los pasos manuales y fallos observados; todavía no se ha realizado esta prueba.
