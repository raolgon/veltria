# Red local — requisito pendiente

Objetivo: controlar el equipo principal desde teléfono, tableta u otra computadora de la misma LAN, incluso sin Internet cuando el perfil completo esté preparado. **No está implementado:** el servicio actual escucha sólo en loopback, sin emparejamiento ni reglas de firewall abiertas.

## Recorrido objetivo

1. Activar Compartir en mi red local en el host y elegir una interfaz/dirección concreta.
2. Mostrar dirección real y QR local con código/secreto efímero, con alternativa manual.
3. El segundo dispositivo solicita emparejamiento; el propietario aprueba alcance y permisos.
4. Mostrar qué equipo ejecuta, progreso, biblioteca autorizada y desconexiones reales.
5. Permitir revocar cada dispositivo o desactivar compartir, conservando el uso local.

No inventar IP/QR antes de activar, usar localhost como dirección del teléfono ni depender de un proveedor de QR. Redes de invitados/VPN pueden impedir comunicación; no pedir abrir puertos del router por defecto.

## Responsabilidades y permisos

Reutilizar UI, contratos, dominio, cola, SQLite y motor del host. El cliente no instala ComfyUI ni ejecuta inferencia. Más pantallas no suman memoria o GPU. Inicialmente es uso entre dispositivos del mismo propietario, no bibliotecas multiusuario independientes.

Añadir un transporte LAN al mismo servicio con listener explícito y permisos limitados; conservar el control local separado. No reemplazar globalmente `127.0.0.1` por `0.0.0.0`. ComfyUI permanece en loopback. Cambios de red/interfaz deben revalidarse, no ampliar el alcance automáticamente.

Emparejar con secreto de un uso/vida corta y límites de intentos; eliminarlo de URL/historial. Sesiones por dispositivo con expiración y revocación. Validar Host/origen, CSRF, SSE y artefactos; no confiar en IP/cabeceras como identidad ni registrar secretos.

Permitir crear/cancelar trabajos propios y acceder sólo a la biblioteca autorizada. No conceder administración del host, instalación de código, cambios de ubicaciones, borrado global ni acceso a credenciales de proveedores. Preparaciones nuevas requieren decisión del propietario local.

## Transporte, continuidad y offline

Decidir y probar transporte antes de implementar: HTTP privado exige explicar que no cifra el tráfico; HTTPS requiere confianza de certificados sin pedir omitir alertas como recorrido normal. No asumir capacidades de contexto seguro sobre una IP privada HTTP; ofrecer carga de archivos y códigos manuales sin exigir PWA, cámara o portapapeles.

UI/API del mismo origen LAN, recursos incluidos y autenticación de todas las operaciones. No exponer el host a Internet, añadir túneles/UPnP ni desactivar firewall. Cualquier regla necesaria se limita al puerto/interfaz/red privada y forma parte del plan autorizado.

Al reconectar, consultar IDs y estado persistente sin reenviar generación. Cerrar pestaña no cancela trabajos; dormir/apagar el host no implica que siguieron ejecutándose. Desactivar LAN revoca sesiones/listener remotos y conserva trabajos aceptados salvo cancelación explícita.

Offline requiere pesos, entorno y dependencias ya preparados. Emparejamiento/QR y recursos no deben depender de cuentas, DNS o servicios externos. Archivos de referencia son uploads validados, no rutas del dispositivo remoto interpretadas por el host.

## Criterios antes de habilitar

Segundo dispositivo real, dos clientes simultáneos, rechazo sin sesión, restricciones administrativas, expiración/revocación, cambio de red, SSE/desconexión sin duplicados y recorrido con Internet desconectado manteniendo LAN. Una segunda pestaña local no acredita esto.

Es el incremento 3B; no cierra la instalación administrada del hito 3 ni se añade al trabajo actual automáticamente. [Estado](docs/status.md), [arquitectura](ARCHITECTURE.md), [próxima tarea](FIRST-TASK.md).
