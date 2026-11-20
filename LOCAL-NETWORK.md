# Red local (LAN)

Permite usar Kobocraft desde un teléfono, tableta u otra computadora conectada a la misma red privada, ejecutando los modelos y guardando los resultados en el equipo principal.

## Cómo funciona

1. En el equipo principal (`owner`), abrir **Ajustes → Red local (LAN)**, elegir una interfaz IPv4 privada activa (`10.x.x.x`, `172.16–31.x.x` o `192.168.x.x`) y activar el acceso.
2. El servicio abre un servidor HTTP secundario exclusivo en esa dirección y genera un código de 6 dígitos y un enlace `#pair=<token>` con vigencia de 10 minutos, junto a un código QR en SVG generado localmente (`packages/core/src/qr.ts`).
3. El dispositivo secundario abre la dirección o el QR, escribe su nombre y envía la solicitud de vinculación (`POST /api/v1/lan/pair`). El fragmento `#pair=` se limpia de la URL.
4. El propietario aprueba o rechaza la solicitud en el equipo principal (`POST /api/v1/lan/decision`). Hasta aprobarla, el dispositivo remoto permanece en espera y no recibe sesión.
5. Al aprobarse, el dispositivo reclama su cookie de sesión con rol `lan` y token CSRF (`POST /api/v1/lan/pair/:id`) y accede a la interfaz compartida.
6. El propietario puede regenerar el código, revocar dispositivos individuales o desactivar la red local en cualquier momento, cerrando al instante las sesiones y conexiones SSE remotas sin afectar la sesión local.

## Permisos y seguridad

- El servidor principal sigue escuchando únicamente en `127.0.0.1`; ComfyUI permanece en loopback.
- La validación de `Host` exige que las peticiones por el listener LAN coincidan exactamente con el origen `http://<ip-privada>:<puerto>` activo.
- Límite de 10 intentos fallidos de código por minuto y máximo de 12 solicitudes pendientes simultáneas. Comparación de secretos en tiempo constante (`timingSafeEqual`).
- Las sesiones con rol `lan` pueden consultar estado, recursos, catálogo, trabajos, artefactos y eventos SSE, seleccionar modelos preparados (`POST /api/v1/catalog/select`), crear, cancelar o reconciliar trabajos de imagen/video y cerrar su propia sesión (`POST /api/v1/lan/logout`).
- Las sesiones `lan` tienen bloqueados (`403 FORBIDDEN`) los cambios de ajustes globales, configuración o preparación de motores/modelos, descargas o borrado de archivos del catálogo, administración de la propia LAN y control de apagado del servicio.

## Código y pruebas

- Servicio y controlador: `apps/local-service/src/lan.ts` y rutas `/api/v1/lan/*` en `apps/local-service/src/server.ts`.
- Contratos y generador QR: `packages/contracts/src/lan.ts` y `packages/core/src/qr.ts`.
- Interfaz: `apps/ui/src/LanSettings.vue` (panel del propietario en Ajustes) y `apps/ui/src/LanPairScreen.vue` (pantalla de vinculación en el cliente remoto).
- Pruebas automatizadas: `tests/lan.bun.ts` verifica validación de IPv4 privadas, generación QR, bloqueo sin sesión, flujo de solicitud/aprobación/reclamación, permisos permitidos y denegados para el rol `lan`, y revocación inmediata de dispositivos y SSE.

## Límites y validación

- El transporte LAN usa HTTP directo en la red privada local; no cifra el tráfico ni debe exponerse a Internet o redes públicas.
- Si el servicio se ejecuta dentro de WSL2, detecta la interfaz virtual y muestra una advertencia indicando iniciar Kobocraft directamente en Windows para conectar desde otros dispositivos físicos sin reenvío de puertos.
- Validado físicamente el 20 de noviembre de 2026 en Windows nativo (`Kobocraft.exe` sobre Wi-Fi privada) desde un segundo dispositivo físico real: emparejamiento y aprobación en la PC principal, creación y consulta de imágenes con rol `lan`, funcionamiento sin salida a Internet en la misma Wi-Fi local y revocación inmediata desde el equipo principal.
