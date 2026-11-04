# Veltria — compartir el equipo por red local

Decisión de producto del 4 de noviembre de 2026. Requisito aceptado: usar Veltria desde teléfono, tableta u otra computadora de la misma red, aprovechando el motor y hardware del equipo principal, incluso sin Internet. El servicio de red todavía no está implementado en este paquete; Ajustes incorpora su flujo como referencia visual.

## Experiencia prevista

1. En el equipo principal, abrir Ajustes → Red local → Compartir en mi red local. Explicar que el equipo debe permanecer encendido y conectado.
2. Veltria muestra la dirección real accesible de la interfaz seleccionada y un QR generado localmente. El acceso manual por dirección/código siempre está disponible. No mostrar localhost o 0.0.0.0 como dirección para el teléfono, ni inventar una IP antes de activar el servicio.
3. El otro dispositivo abre esa dirección en su navegador. Si se usa QR, puede escanearlo con la cámara del sistema; el navegador no necesita permiso de cámara para este flujo.
4. El equipo principal recibe una solicitud de emparejamiento con nombre identificable y confirma el alcance: crear trabajos y consultar resultados de la biblioteca autorizada. Una misma Wi-Fi no autoriza por sí sola a todos los visitantes.
5. El cliente muestra Conectado a [equipo], estado de la conexión y qué hardware ejecutará la tarea. Preparación, progreso, biblioteca y resultados proceden del servicio del equipo principal.

El equipo principal puede estar conectado al router por Ethernet y el teléfono por Wi-Fi. La condición es que la red permita comunicarse entre ellos. Las redes de invitados o con aislamiento de clientes pueden impedirlo; el diagnóstico debe explicarlo sin pedir abrir puertos del router.

## Qué sucede en cada dispositivo

| Función | Equipo principal | Dispositivo conectado |
| --- | --- | --- |
| GPU, memoria y compatibilidad | Detección y comprobación reales | Muestra las capacidades del equipo principal, sin atribuirlas al teléfono. |
| Modelos, Python y ComfyUI | Instalados y ejecutados aquí | No necesita instalarlos. |
| Interfaz | La sirve desde recursos incluidos | La carga por la red local. |
| Trabajos | Cola persistente compartida | Envía solicitudes autorizadas y recibe progreso. |
| Creaciones | Se guardan aquí | Consulta miniaturas y descarga/exporta resultados permitidos. |
| Referencias | Recibe archivos por streaming y valida límites | Elige archivos locales para subirlos al equipo principal. |
| Ajustes del servidor y acceso | Administración del propietario | No recibe permisos de administración por emparejarse. |

La edición LAN inicial es para varios dispositivos del mismo propietario. No implica un servicio multiusuario con bibliotecas independientes. Definir visibilidad antes de incorporar colaboración entre personas.

## Funcionamiento sin Internet

La UI, iconos, fuentes, catálogo básico y QR deben estar incluidos localmente. Descubrir el equipo y emparejar dispositivos no puede depender de servicios externos, DNS público, cuentas cloud o un proveedor de QR.

La generación offline requiere haber preparado el conjunto completo: pesos, componentes, extensiones, runtime y dependencias. Las descargas iniciales, acceso a repositorios o licencias que requieran conexión no desaparecen por habilitar LAN. Ante un componente ausente, indicar qué falta y dejar usar perfiles preparados; no simular una descarga offline ni prometer soporte offline de cualquier extensión.

Prueba obligatoria: cortar la salida a Internet conservando el enlace LAN y ejecutar el recorrido desde otro dispositivo con un perfil ya preparado. No considerar suficiente probar desde otra pestaña del mismo equipo.

## Arquitectura compartida

Reutilizar Vue, Bun/Fastify, contratos HTTP/SSE, reglas, cola, SQLite y adaptador ComfyUI. Hay un único propietario de los datos y trabajos. La red añade un transporte autenticado al mismo servicio, no otro backend de producto o una copia de la base.

Mantener loopback como modo predeterminado. Sólo al habilitar compartir, crear el listener LAN en una interfaz/dirección seleccionada, con puerto disponible y estado explícito. Puede implementarse con dos adaptadores HTTP en el mismo proceso Bun, usando un registro común de rutas y los mismos servicios; no duplicar la cola, migraciones o lógica por listener. Rechazar por capacidad los comandos administrativos en el acceso remoto.

No hacer un reemplazo global de 127.0.0.1 por 0.0.0.0. Si se necesitan listeners diferentes, el de control local conserva su autenticación de propietario y el de LAN expone sólo las rutas permitidas para dispositivos emparejados. Los cambios de adaptador, VPN, dirección o red deben detectarse y revalidarse, sin extender automáticamente el alcance a todas las interfaces. IPv6 se configura y prueba expresamente.

Servir UI y API desde el mismo origen LAN. ComfyUI y sus puertos continúan en loopback, detrás del adaptador de Veltria. No cargar una web pública que acceda al localhost del teléfono. Descubrimiento mDNS puede añadirse después; la dirección manual y el QR son suficientes para el primer incremento.

El acceso inicial sin sesión sólo ofrece el flujo mínimo de emparejamiento; hardware, biblioteca, archivos y operaciones requieren autorización. El QR contiene un identificador de servidor y secreto de emparejamiento efímero, de un solo uso, en el fragmento de URL. Se intercambia y elimina del historial; no es una credencial permanente. Limitar tiempo, intentos y solicitudes pendientes y exigir aprobación local antes de crear una sesión por dispositivo. El código manual también expira y está sujeto a límites.

## Transporte y permisos

Para el primer incremento LAN puede usarse HTTP sólo tras informar que se comparte en una red privada de confianza y que el tráfico no está cifrado. El emparejamiento limita acceso pero no cifra prompts, imágenes o sesiones frente a observadores de esa red. No llamarlo una conexión cifrada ni exponerlo a Internet. Si se elige HTTPS, resolver confianza de certificados de forma compatible con los dispositivos y con funcionamiento offline; no pedir omitir alertas del navegador como recorrido normal.

Una IP privada servida por HTTP no obtiene automáticamente las excepciones de contexto seguro de localhost. Usar controles web básicos, input de archivos y apertura/descarga de enlaces. Si faltan APIs como portapapeles o cámara, ofrecer selección manual de dirección/código y carga de archivos; no exigir una PWA o Service Worker para funcionar. No poner cookies Secure ni prefijos reservados para HTTPS sobre un origen HTTP de la LAN.

Sesiones distintas para control local y clientes, con expiración y revocación individual. HttpOnly, SameSite estricto, origen/Host explícitos, límites y protección CSRF; los atributos dependientes de HTTPS se fijan según el transporte real. Validar todas las acciones, SSE y accesos a artefactos. No confiar en direcciones IP o cabeceras reenviadas como prueba de identidad. No registrar secretos.

Por defecto, un dispositivo emparejado puede crear/cancelar sus trabajos y consultar la biblioteca expresamente compartida. No puede cambiar ubicaciones, instalar código/motores/extensiones, administrar sesiones, borrar la biblioteca global o cambiar el alcance de red. Si una tarea necesita una preparación nueva, notificar al propietario y aprobarla en el equipo principal. Los tokens de proveedores permanecen en el host.

El propietario puede ver dispositivos, revocar uno o detener el uso compartido. Desactivar LAN cierra el listener y las sesiones/eventos remotos; los trabajos ya aceptados permanecen en la cola salvo cancelación explícita. Seguir usando Veltria localmente. Tras reiniciar el servicio, volver a exigir emparejamiento inicialmente, hasta diseñar persistencia segura de confianza.

Las reglas de firewall, si fueran necesarias, se limitan al puerto, aplicación, interfaz y red privada seleccionados y se explican antes de aplicarse. No activar redirección de puertos, UPnP, túneles o servicios externos, ni desactivar el firewall. No abrir una regla real como parte de una maqueta.

## Cola, desconexión y continuidad

Todos los dispositivos comparten la capacidad del equipo principal y la misma cola; inicialmente sigue habiendo un trabajo activo por GPU. Más pantallas no suman memoria o potencia. Identificar trabajos con cliente y clave idempotente para evitar duplicados por reintentos y doble toque.

Cambiar de aplicación en el teléfono o perder Wi-Fi puede suspender SSE. Al reconectar, recuperar una instantánea y reconciliar IDs, no reenviar la generación automáticamente. Cerrar una pestaña no cancela el trabajo. Si el equipo principal duerme o se apaga, mostrar desconexión y reconciliar después sin afirmar que la tarea continuó ejecutándose. Para compartir, Veltria y su servicio deben mantenerse abiertos; no se instala un daemon del SO en este incremento.

La biblioteca y resultados siguen en el equipo principal. Descargar una imagen al teléfono crea una copia allí; no implica sincronización de carpetas. Las referencias importadas son archivos, no rutas del teléfono interpretadas como rutas del servidor. Limitar tamaño y validar contenido, identidades de artefactos y raíces autorizadas.

## Implementación por etapas

Mantener FIRST-TASK.md centrado en el hito 1 con loopback. La función LAN es un incremento 3B: después del primer flujo real y la preparación administrada, antes de ampliar a video/audio. Puede adelantarse para uso técnico con ComfyUI existente una vez completados el flujo real, sesiones, permisos y validación; no sustituye la ruta de instalación sencilla del producto.

Antes de habilitar el control en UI, comprobar el listener Bun/Fastify bajo el runtime elegido, emparejamiento, revocación, uploads/resultados, SSE y la cola desde una segunda máquina. Incluir al menos dos clientes simultáneos, rechazo sin sesión, restricciones administrativas, expiración del QR/código, desconexión sin duplicados, cambio de red y uso con salida a Internet bloqueada.

El prototipo muestra Red local como función pendiente y explica el recorrido. No anuncia una IP real, una sesión activa, un QR funcional ni detección/dispositivos conectados ficticios.

## Referencias técnicas

- https://fastify.dev/docs/latest/Reference/Server/
- https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie

Revisar también la compatibilidad real de las versiones elegidas y de Safari/iOS/Android durante la implementación. Este documento define el requisito, no acredita pruebas de red ya realizadas.
