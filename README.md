# Kobocraft

Aplicación local para crear imágenes sin administrar manualmente modelos, carpetas o workflows. La persona decide qué crear; Kobocraft prepara lo necesario. Imagen primero, con video todavía experimental.

**Versión de desarrollo: 0.10.0 · rama de trabajo: `development`.** Estado y pendientes en [docs/status.md](docs/status.md). La preparación reutiliza ComfyUI existente y ofrece una [instalación propia](docs/managed-setup.md) cuando falta un motor utilizable.

## Abrir en esta PC

Proyecto: `C:\Users\rafao\Documents\ChatGPT\Veltria` (identificadores internos y rutas de código conservan el nombre histórico `veltria`). Cerrar otras versiones antes de abrirlo y conservar cada ejecutable con sus recursos.

```powershell
Set-Location 'C:\Users\rafao\Documents\ChatGPT\Veltria'
# Escritorio:
.\release\0.10.0\win-unpacked\Kobocraft.exe
# Navegador: abrir el enlace autorizado que imprime.
.\build\browser\0.10.0\veltria-web.exe
```

Linux/WSL con pantalla (tras compilar con `bun run build` / `bun run package:dir`):

```bash
cd '/mnt/c/Users/rafao/Documents/ChatGPT/Veltria'
./release/0.10.0/linux-unpacked/veltria
./build/browser/0.10.0/veltria-web
```

El enlace del navegador vence en 60 segundos y es de un solo uso. Ejecutar de nuevo el lanzador emite otro. Cerrar una pestaña no detiene el servicio; usar Ctrl+C en su lanzador propietario. No ejecutar Windows y Linux sobre una misma base activa.

## Qué se puede hacer

- Crear imágenes con SD 1.5, DreamShaper 8 y SDXL Base; elegir formato, tamaño, pasos y CFG, limpiar el lienzo y recuperarse de fallos clasificados (memoria, incompatibilidad, motor o ejecución) con ajustes reducidos revisables.
- Buscar modelos y LoRA admitidos, explorar compatibles por popularidad, revisar recomendaciones y preparar sus componentes.
- Descargar con progreso, pausa, reanudación cuando el origen la admite y verificación SHA-256; gestionar archivos completos y parciales con avisos de espacio y permisos.
- Compartir el estudio en red local (LAN) con código o QR local, aprobación en el equipo principal y revocación por dispositivo.
- Importar/exportar configuraciones JSON, guardar PNG y consultar la biblioteca persistente.
- Consultar recursos reales del equipo y usar español/inglés y temas claro/oscuro/sistema con logotipos adaptativos.
- Revisar el flujo experimental de video H3. No hay una generación H3 real validada en esta PC.

SDXL tiene pruebas GPU reales en Windows a 768 y 1024 px. Eso no certifica todas las resoluciones ni otros equipos. No hay un LLM adicional para seleccionar modelos o reescribir descripciones. Audio sigue pendiente.

## Desarrollo

Vue 3 + TypeScript + Vite, Electron y servicio local Bun/Fastify con SQLite. Dependencias fijadas en `bun.lock`. Desarrollo: Bun 1.4.4 y Node 24.13.0; los paquetes para usuarios incluyen sus runtimes.

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
bun run start:web
# O escritorio:
bun run start:desktop
```

`bun run dev` usa Vite en 43120 y proxy al servicio en 43121. Producción utiliza un puerto loopback asignado por el SO. Para UI en Linux sin pantalla: `xvfb-run -a bun run test:ui`.

## Documentación vigente

| Documento | Contenido |
| --- | --- |
| [PROJECT.md](PROJECT.md) | Decisiones de producto, alcance y reglas de trabajo. |
| [PHILOSOPHY.md](PHILOSOPHY.md) | Experiencia para personas sin conocimientos técnicos. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Procesos, API, persistencia, seguridad, LAN y distribución. |
| [DESIGN.md](DESIGN.md), [MOBILE-UI.md](MOBILE-UI.md) | Identidad Obsidian, temas y comportamiento responsive. |
| [LOCAL-NETWORK.md](LOCAL-NETWORK.md) | Acceso en red local, emparejamiento QR, permisos y límites. |
| [FIRST-TASK.md](FIRST-TASK.md) | Próximo incremento propuesto del hito 4 y validación pendiente. |
| [Hito 4](docs/milestone-4.md) | Requisitos, implementación actual, faltantes y criterios de cierre. |
| [Estado](docs/status.md), [validación](docs/validation.md) | Qué funciona, evidencia y pendientes por plataforma. |
| [Preparación](docs/setup.md), [instalación propia](docs/managed-setup.md) | Recorrido de configuración, entorno administrado y recuperación. |
| [Modelos](docs/models.md), [calidad](docs/image-quality.md) | Catálogo, LoRA, archivos y ajustes por imagen. |
| [Video](docs/video.md), [recursos](docs/resources.md), [idiomas](docs/languages.md) | Funciones específicas y su alcance. |

El historial de entregas se consulta en Git; estas guías describen el estado actual. Modelos, resultados y datos personales permanecen fuera del repositorio.
