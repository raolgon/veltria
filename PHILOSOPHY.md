# Veltria — nosotros hacemos el trabajo pesado

Decisión de producto del 3 de noviembre de 2026. Define la experiencia que debe guiar arquitectura, diseño y desarrollo. No afirma funciones implementadas ni cambia el stack Vue/Bun/Electron o el alcance local.

**La persona decide qué quiere crear. Veltria prepara lo necesario para hacerlo en su equipo.**

La facilidad de instalación, selección de modelos, uso de LoRA y recuperación es parte del producto desde su diseño. Una pantalla bonita que obliga a seguir tutoriales, mover pesos o configurar ComfyUI manualmente no cumple esta filosofía para los perfiles que ofrecemos como preparados.

## 1. Empezar por la intención

La entrada principal es una tarea: crear una imagen, editar una imagen y, cuando estén soportadas, animar una imagen, crear video o generar audio. Después se ofrecen opciones comprensibles como formato, estilo y un equilibrio entre calidad y rapidez.

Veltria propone un perfil adecuado al equipo y explica brevemente por qué. El catálogo completo, el nombre exacto del modelo, la variante y los parámetros siguen disponibles mediante detalles y controles avanzados. La persona puede elegir y experimentar; no tiene que aprender la taxonomía del ecosistema para empezar.

En la primera versión se muestran únicamente tareas realmente soportadas. Una preferencia de estilo no equivale siempre a un LoRA: cada receta resuelve sus componentes. No descargar otro modelo o un LLM sólo por elegir una opción estética.

## 2. Una acción para preparar el conjunto

La acción principal propuesta es **Preparar para crear**. Antes de iniciarla, mostrar un resumen breve de la descarga pendiente, espacio necesario, ubicación y compatibilidad conocida. Usar valores reales del plan; marcar estimaciones y desconocidos. Licencias o acceso del proveedor se presentan sólo cuando corresponda.

Tras autorizar ese plan, Veltria coordina lo que falte: entorno administrado, motor, dependencias revisadas, componentes del modelo, extensiones necesarias, receta y ajustes iniciales. No pedir otro clic por cada archivo o fase ya autorizada. Las tareas se ejecutan en segundo plano con una operación identificable, progreso legible y cancelación cuando sea posible.

Al terminar, la acción pasa a **Crear**. Mantener prompt y selecciones durante la preparación. No iniciar una generación sólo porque acabó una instalación, salvo que la acción elegida lo hubiera indicado expresamente. Los detalles técnicos y registros son desplegables, no pasos obligatorios.

El objetivo es una acción visible para preparar, aunque internamente existan muchos pasos. No prometer un clic universal: autenticación de un proveedor, aceptación de licencia, permisos del sistema o una incompatibilidad pueden requerir una decisión real. Explicar qué falta, por qué y cómo continuar; conservar el progreso útil.

## 3. ComfyUI como motor administrado

El camino normal del producto terminado es **Preparar este equipo**. Detectar hardware, proponer una configuración y gestionar una instalación propia, aislada y versionada. La persona no debería tener que conocer Python, CUDA, pip, puertos, nodos o carpetas de checkpoints para ejecutar un perfil admitido.

**Usar una instalación existente** es una opción secundaria para quien ya tiene ComfyUI. Comprobar la conexión y capacidades sin modificar su entorno. No escanear ubicaciones arbitrarias ni la red buscando instalaciones. Los ajustes de dirección, puerto y rutas pertenecen a esa ruta avanzada, con validación y ayuda contextual.

El hito 1 conserva la conexión a ComfyUI existente como comprobación interna de integración. No define la incorporación final para principiantes ni basta para declarar el producto listo para ellos. La preparación administrada del hito 3 es un requisito de la primera entrega orientada a personas nuevas.

Si hace falta un controlador del SO o una instalación que no podamos gestionar de manera fiable, mostrar una acción guiada y verificar después. No afirmar que se arregló sólo por abrir una página ni ejecutar instaladores ajenos sin una decisión informada.

## 4. Modelos, variantes y familias

Presentar opciones útiles para la tarea y el equipo, con una recomendación inicial y alternativas. Diferencias de arquitectura, cuantización, backend y versión se resuelven en recetas y perfiles explícitos, no mediante instrucciones que el usuario deba memorizar.

La compatibilidad pertenece al conjunto: modelo, variante, motor, receta, adaptaciones y ajustes. Descargar un archivo no garantiza que ese conjunto pueda ejecutarse. Diferenciar **Descargado**, **Falta preparar**, **Preparado** y **Verificado con estos ajustes**. No convertir una verificación pequeña en una promesa para cualquier resolución o duración.

Al seleccionar una opción experimental, explicar el efecto esperado y ofrecer un perfil más conservador. No cambiar silenciosamente el modelo, la resolución, la duración o el resultado esperado para evitar un fallo.

Los LLM tienen familias, formatos y runtimes propios: el mismo principio se aplicaría si se incorporan, con adaptadores y capacidades específicos. Esta filosofía no añade ahora un chat, un motor LLM, un mejorador de prompts ni otro modelo auxiliar obligatorio. La orientación inicial puede funcionar con reglas locales.

## 5. LoRA sin resolver carpetas a mano

Cuando se habilite esta función, una persona podrá elegir una adaptación de estilo, personaje u otro propósito admitido desde la misma tarea. El nombre técnico LoRA permanece accesible en su ficha y en el modo avanzado; no todos los LoRA son estilos.

Veltria debe resolver descarga, ubicación, familia/modelo base declarado, receta compatible y activación. Mostrar por defecto las adaptaciones admitidas para el perfil seleccionado. Un LoRA de otra familia no se vuelve compatible por estar en la carpeta correcta.

El perfil revisado puede proponer intensidad y palabras de activación, visibles y editables. Si se añaden al prompt, mostrarlas y permitir deshacer; no alterar texto ocultamente. No garantizar que cualquier combinación de varios LoRA funcione por admitirlos individualmente. Conservar qué combinación y valores produjeron un resultado.

La importación de un archivo local debe analizar lo que realmente pueda identificar. No confiar en su nombre ni ejecutar instrucciones de sus metadatos. Si la familia, procedencia o compatibilidad son desconocidas, indicarlo y mantenerlo fuera de la selección recomendada; ofrecer asociación manual avanzada sin llamarla verificación. No añadir automáticamente un modelo base grande para satisfacer una importación sin mostrar antes el nuevo plan.

## 6. Múltiples formas de crear, una experiencia coherente

Cada tarea muestra sólo sus entradas necesarias: texto, imagen de referencia, máscara, duración o audio según corresponda. Una receta traduce esas decisiones a un workflow revisado. La persona no necesita abrir el editor de nodos para usar las tareas admitidas.

El editor de nodos y la importación de workflows arbitrarios no son requisitos del camino sencillo. Si se admite una importación avanzada más adelante, informar qué no está soportado y qué dependencias contiene; nunca instalar código desconocido por leerla.

Mantener patrones comunes: elegir tarea, aportar entradas, revisar perfil, preparar si falta algo, crear y reutilizar el resultado. No diseñar aplicaciones separadas con otra lógica de instalación para imagen, video y audio.

## 7. Recuperación dentro de Veltria

Cada fallo debe decir qué pasó, qué se conservó y cuál es la siguiente acción útil. Ejemplos de acciones: **Reanudar descarga**, **Volver a comprobar conexión**, **Reparar componentes** o **Usar un perfil más ligero**. Ofrecer sólo las que el servicio pueda ejecutar realmente.

Registrar las fases de preparación para retomar operaciones seguras sin repetir descargas verificadas. Una reparación de un entorno administrado no debe borrar modelos o creaciones; una instalación externa no se repara modificándola sin autorización específica. No prometer restaurar un entorno entero si sólo guardamos versiones.

No reintentar generaciones costosas o cancelaciones globales automáticamente. Conservar el prompt y parámetros tras un error de memoria y proponer un ajuste que la persona pueda aceptar. Los registros técnicos y diagnósticos copiables ayudan al soporte, pero leer una traza no debe ser la única salida del flujo normal.

## 8. Mostrar decisiones, resolver mecánica

Automatizar versiones compatibles, dependencias revisadas, colocación de archivos, arranque del motor, comprobaciones y defaults razonables. Pedir decisión cuando cambien descargas importantes, ubicación, permisos, licencia, calidad esperada o datos que se eliminarían. No preguntar repetidamente por pasos incluidos en un plan ya autorizado.

Usar divulgación progresiva: controles esenciales al frente, detalles y ajustes avanzados accesibles, sin una pared de parámetros. Mantener el nombre del modelo, fuentes, licencia, archivos y configuración consultables para quien los necesite. El diseño futurista Obsidian debe apoyar lectura, jerarquía y navegación por teclado, también en modo claro.

## 9. Criterios de aceptación

Estos criterios se validan por función implementada; los pendientes se registran y no se simulan.

- Un perfil ofrecido como preparado puede usarse sin terminal, sin mover archivos ni editar un workflow.
- La ruta principiante de una entrega pública no exige instalar o configurar ComfyUI externamente.
- Una preparación completa tiene una acción principal y no un asistente que pide confirmar cada componente ya autorizado.
- Se conoce el volumen pendiente y la ubicación antes de descargar; si no hay espacio o el plan cambia materialmente, se explica antes de continuar.
- Descargar, preparar y verificar son estados distintos respaldados por el servicio.
- Interrumpir una descarga permite recuperar lo que el origen y el estado persistido admitan, sin fingir progreso ni duplicar instalaciones.
- LoRA incompatible o desconocido se explica antes de generar; cambiar de modelo actualiza esa compatibilidad.
- Un fallo conserva entradas y ofrece una acción útil o identifica honestamente una intervención externa inevitable.
- Navegador y Electron muestran las mismas operaciones, decisiones y estado del servicio.
- Las pruebas de usabilidad registran decisiones obligatorias, pasos manuales externos, fallos recuperables y si una persona nueva consigue su primera creación; los objetivos no se presentan como mediciones realizadas.

## Uso desde otros dispositivos

La persona podrá usar la misma experiencia desde la red local, sin repetir descargas ni configurar un motor en cada pantalla. El equipo principal realiza la preparación y el cálculo; el dispositivo conectado muestra controles y resultados. El requisito está definido en LOCAL-NETWORK.md, con emparejamiento explícito y funcionamiento sin Internet para perfiles preparados. La simplicidad de conexión forma parte de esta filosofía.

## 10. Alcance y prioridad

Mantener los hitos técnicos de ARCHITECTURE.md. En cada uno revisar cuánta configuración trasladamos a la persona y qué puede resolver Veltria. La primera entrega para principiantes debe incluir preparación administrada y al menos un perfil completo que funcione en equipos realmente validados. Es preferible una ruta pequeña comprobada que un catálogo amplio que obliga a solucionar dependencias.

Los LoRA se incorporan como un flujo verificable después de tener el primer perfil instalable; video/audio siguen siendo posteriores. Esta filosofía no amplía automáticamente la primera tarea de Codex ni permite presentar botones de instalación, reparación o generación aún inexistentes como funcionales.
