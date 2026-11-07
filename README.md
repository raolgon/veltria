# Veltria

Aplicación local para crear imágenes sin tener que administrar manualmente modelos, carpetas o workflows. La persona decide qué crear; Veltria prepara lo necesario. Imagen primero, con video todavía experimental.

**Versión vigente: 0.9.0 · rama de trabajo: `development`.** Estado y pendientes en [docs/status.md](docs/status.md). La instalación automática de ComfyUI es el siguiente desarrollo; actualmente se reutiliza una instalación existente.

## Abrir en esta PC

Proyecto: `C:\Users\rafao\Documents\ChatGPT\Veltria`. Cerrar otras versiones antes de abrirlo y conservar cada ejecutable con sus recursos.

```powershell
Set-Location 'C:\Users\rafao\Documents\ChatGPT\Veltria'
# Escritorio:
.\release\0.9.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime.
.\build\browser\0.9.0\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Documents/ChatGPT/Veltria'
./release/0.9.0/linux-unpacked/veltria
./build/browser/0.9.0/veltria-web
```

El enlace del navegador vence en 60 segundos y es de un solo uso. Ejecutar de nuevo el lanzador emite otro. Cerrar una pestaña no detiene el servicio; usar Ctrl+C en su lanzador propietario. No ejecutar Windows y Linux sobre una misma base activa.

## Qué se puede hacer

- Crear imágenes con SD 1.5, DreamShaper 8 y SDXL Base; elegir formato, tamaño, pasos y CFG.
- Buscar modelos y LoRA admitidos, explorar compatibles por popularidad, revisar recomendaciones y preparar sus componentes.
- Descargar con progreso, pausa, reanudación cuando el origen la admite y verificación SHA-256; gestionar archivos completos y parciales.
- Importar/exportar configuraciones JSON de Veltria, guardar PNG y consultar la biblioteca persistente.
- Consultar recursos reales del equipo y usar español/inglés y temas claro/oscuro/sistema.
- Revisar el flujo experimental de video H3. No hay una generación H3 real validada en esta PC.

SDXL tiene pruebas GPU reales en Windows a 768 y 1024 px. Eso no certifica todas las resoluciones ni otros equipos. No hay un LLM adicional para seleccionar modelos o reescribir descripciones. LAN, audio e instalación administrada del motor siguen pendientes.

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
| [ARCHITECTURE.md](ARCHITECTURE.md) | Procesos, API, persistencia, seguridad y distribución. |
| [DESIGN.md](DESIGN.md), [MOBILE-UI.md](MOBILE-UI.md) | Obsidian, temas y comportamiento responsive. |
| [FIRST-TASK.md](FIRST-TASK.md) | Próximo trabajo: cerrar la preparación administrada del hito 3. |
| [Estado](docs/status.md), [validación](docs/validation.md) | Qué funciona, evidencia y pendientes por plataforma. |
| [Preparación](docs/setup.md), [modelos](docs/models.md), [calidad](docs/image-quality.md) | Recorridos y límites actuales de imagen. |
| [Video](docs/video.md), [recursos](docs/resources.md), [idiomas](docs/languages.md) | Funciones específicas y su alcance. |
| [Laboratorio Linux](docs/linux-lab.md) | Entorno aislado de pruebas en `D:\Veltria\lab`. |
| [Red local](LOCAL-NETWORK.md) | Requisito pendiente, no una función habilitada. |
| [Prototipo](UI-PREVIEW.md) | Referencia de diseño conservada; no es la aplicación de producción. |

El historial de entregas se consulta en Git; estas guías describen el estado actual. Modelos, resultados y datos personales permanecen fuera del repositorio.
