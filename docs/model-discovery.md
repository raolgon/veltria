# Descubrir y preparar · Veltria 0.6.0

## Recorrido

En **Modelos**, buscar por nombre, estilo o efecto, o elegir Fotografía, Ilustración, Anime o Personajes. El texto filtra también modelos y nombres de configuraciones del catálogo local. **Buscar en Internet** consulta Hugging Face explícitamente; escribir o abrir la pantalla no hace consultas externas. Son búsquedas de palabras/nombres y categorías, no interpretación semántica mediante un LLM.

**Para mi equipo** aplica los requisitos actuales de la receta SD 1.5 y muestra candidatos con familia admitida. **Explorar todo** permite ver resultados de otras familias y consultar por qué falta soporte. **Descargados** muestra pesos locales completos, distinguiendo los que aún necesitan preparación. No se oculta una opción por su contenido creativo. Una incompatibilidad de receta no se resuelve con un simple aviso de memoria.

Las fichas locales incluyen ejemplos reales de las pruebas de 0.5.1 para SD 1.5 y DreamShaper, identificados como ejemplos, sin prometer el mismo resultado. Los resultados externos no tienen imágenes inventadas. Se propone una variante inicial (prioriza la identidad conocida y después el tamaño); la lista exacta de archivos está en **Detalles técnicos**. No se promete que el menor archivo sea el mejor modelo ni que todas sus variantes funcionen.

**Preparar y usar** comprueba la cabecera del archivo antes de incorporarlo a SQLite y selecciona su configuración Equilibrada. Después abre el mismo asistente/plan autorizado de preparación. La incorporación al catálogo no descarga todos los pesos ni empieza una generación. El plan muestra bytes pendientes, componentes, fuentes, licencias y ubicación. Se conservan el prompt y los modelos anteriores. Al terminar, la persona pulsa Crear.

## Modelos, finetunes y LoRA

- Checkpoints completos de SD 1.5 en safetensors, con UNet, VAE y CLIP incluidos y atención de 768 dimensiones. Finetunes completos utilizan la misma receta. Configuraciones Equilibrada, Borrador rápido y Más pasos, con importación/exportación JSON existentes.
- LoRA estándar de SD 1.5 en formato Kohya, con claves `lora_unet_` y atención de 768 dimensiones. Por defecto usa SD 1.5 e intensidad 0,7. En detalles se puede escoger otro checkpoint SD 1.5 del catálogo y una intensidad entre 0 y 1,5 antes de preparar. No se añade texto oculto al prompt.
- Un perfil de adaptación identifica de manera estable el archivo, la revisión del proveedor, el modelo base y la intensidad. El workflow usa `LoraLoader` para el modelo y ambos textos; conserva el VAE del checkpoint. Cada trabajo conserva la revisión del perfil y de la configuración usada.
- El plan de LoRA reúne el checkpoint base y la adaptación: descargas pendientes agregadas, espacio, progreso y SHA-256 de ambos. Reutiliza archivos presentes, comprobando integridad. Guarda LoRA en `loras`, checkpoints en `checkpoints` y añade esas rutas sólo a la configuración de su proceso propio de ComfyUI. No modifica el entorno externo.

Los perfiles externos se guardan en la tabla adicional `discovered_models`. Se mantienen protocolo 6 y SQLite 4, sin sustituir tablas existentes. No abrir versiones distintas simultáneamente sobre los mismos datos. Los modelos, configuraciones, pesos y resultados anteriores se conservan.

## Fuente y comprobaciones

La integración utiliza la [API pública de Hugging Face](https://huggingface.co/docs/hub/api), con consultas acotadas a ocho repositorios, respuesta máxima de 2 MiB y tiempos límite. Sólo admite identidades de repositorio, no servidores arbitrarios. Metadatos del proveedor se tratan como datos. No se ejecutan README, scripts, nodos o workflows externos.

Para incorporar un archivo se exige revisión de commit, tamaño y SHA-256 LFS. Además se lee una cabecera safetensors acotada mediante HTTP Range: las etiquetas de familia no sustituyen esa comprobación. El checkpoint DreamShaper conocido se deduplica con su perfil existente por SHA-256. La transferencia completa mantiene el adaptador de streaming, pausa, reanudación y hash final. Consultar metadatos no certifica generación: esa evidencia sigue siendo por equipo, perfil y configuración.

Las consultas sólo envían términos de búsqueda al proveedor, nunca los prompts de creación ni datos del equipo. La generación sigue siendo local. Los repositorios privados/restringidos y la conexión de cuentas no están implementados; se explica el requisito sin intentar evitarlo. La fuente y licencia declarada permanecen visibles.

## Validación de esta entrega

- Tipos y builds de Linux/Windows. Suite de 20 pruebas Vitest, 22 pruebas Bun (184 aserciones) y 83 comprobaciones HTTP fuente/compilado. Incluyen familias equivocadas, acceso restringido, cabeceras incompletas y workflow LoRA; prueba de integración de preparación conjunta/reutilización y parámetros enviados usando fixtures, sin confundirlas con GPU.
- **16 recorridos** de interfaz de navegador y Electron sobre Linux/WSL con Xvfb: catálogo, búsqueda por intención, vacío, respuesta externa de fixture, fallo recuperable, controles avanzados, idiomas y adaptación a móvil. Se corrigió el desbordamiento de revisiones largas en detalles técnicos.
- Comprobaciones nativas Windows del auxiliar, lanzador web, recursos, sesiones, persistencia, catálogo y cierre de procesos propios.
- Consulta pública real de DreamShaper y búsqueda de LoRA SD 1.5; cabeceras y hashes publicados comprobados sin bajar otro checkpoint completo.
- **Prueba real Windows**, RTX 4050 Laptop 6 GB, ComfyUI 0.35.0: búsqueda mediante la UI de `neonforestmist/sd15-storybook-anime-lora`; descarga real de `storybook_anime_lora.safetensors`, **37.869.632 bytes**, SHA-256 `0304bb42819790cf63f4125ac70cee60fda682cc5aa4bfb512bb9e3b1746e9b0`; reutilización de SD 1.5 local, intensidad 0,7, imagen real **512 × 512**, guardado y biblioteca persistente al reiniciar. No se volvió a descargar el checkpoint.

Registro Windows: `%LOCALAPPDATA%\Veltria\discovery-real-1793915199787-a5b2543a\validated-discovery.json`, junto a `real-search.png`, `real-lora-ui.png` y `real-lora.png`. Usa datos y copias separados; cerró sólo sus procesos y retiró sólo sus copias de pesos después de aprobar. No certifica silenciosamente la biblioteca habitual.

Repetir la comprobación real es opt-in: descarga aproximadamente 38 MB y utiliza GPU. Requiere las dependencias de desarrollo y el paquete de esta versión, Edge existente, ComfyUI compatible y SD 1.5 exacto ya presente:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\tests\windows-discovery-real.ps1 -ModelsDirectory 'D:\Veltria\models'
```

## Abrir

Cerrar antes la versión anterior. Windows PowerShell:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
# Escritorio
.\release\0.6.0\win-unpacked\Veltria.exe
# Navegador: abrir el enlace autorizado que imprime
.\build\browser\0.6.0\veltria-web.exe
```

Linux/WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.6.0/linux-unpacked/veltria
./build/browser/0.6.0/veltria-web
```

## Límites pendientes

SDXL, Flux y otras arquitecturas, LoRA Diffusers/LyCORIS/DoRA, varios LoRA simultáneos, archivos en subdirectorios, Civitai y otras fuentes, credenciales de proveedor, galerías externas y entrenamiento de finetunes/LoRA. La búsqueda muestra otras familias en Explorar todo, pero no las presenta como ejecutables. No importa workflows arbitrarios ni convierte formatos automáticamente. Las estimaciones actuales de hardware corresponden sólo a SD 1.5 a 512 píxeles; no se prometen tiempos ni compatibilidad universal. Pendiente: GPU nativa Linux y pruebas macOS; Windows tiene la prueba de LoRA indicada, no una certificación de todos los resultados públicos.
