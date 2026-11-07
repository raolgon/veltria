# Modelos, configuraciones y archivos

## Catálogo incluido

| Modelo | Familia | Inicio cuadrado | Pasos incluidos: equilibrada / borrador / más pasos | Mínimo nominal de la receta |
| --- | --- | --- | --- | --- |
| Stable Diffusion 1.5 FP16 | SD 1.5 | 512 px | 20 / 12 / 30 | NVIDIA 4 GB, RAM 8 GB |
| DreamShaper 8 FP16 | SD 1.5 | 512 px | 25 / 12 / 30 | NVIDIA 4 GB, RAM 8 GB |
| SDXL Base 1.0 | SDXL | 768 px | 20 / 12 / 30 | NVIDIA 6 GB, RAM 16 GB |

Son tres modelos y nueve configuraciones incluidas disponibles para consulta offline. Los mínimos son reglas del perfil, no una certificación de toda resolución. SDXL usa `--lowvram`, sin refiner. [Calidad por imagen](image-quality.md).

Los manifiestos ejecutables están en `packages/core/src/image-profile.ts` y `packages/core/src/model-catalog.ts`: identidad, revisión, archivo, bytes, SHA-256, fuentes, licencia y limitaciones. Son la autoridad para esos valores; no mantener otra lista independiente de hashes en documentación.

- SD 1.5: fuente Comfy-Org fijada; CreativeML OpenRAIL-M.
- DreamShaper: fuente Lykon fijada; el proveedor declara `other` y se muestran las condiciones del autor. No atribuir otra licencia por asociación.
- SDXL: checkpoint oficial Stability AI fijado; CreativeML Open RAIL++-M.

La preparación enseña la fuente/licencia exacta y requiere aceptación. No se promete que cualquier archivo con el mismo nombre sea ese modelo.

## Descubrir compatibles

Modelos permite buscar por nombre o intención mediante texto/categorías, explorar compatibles sin escribir y ordenar por popularidad o propuesta recomendada. Las recomendaciones priorizan lo comprobado con los ajustes elegidos y archivos ya preparados; no son un ranking de calidad.

La consulta externa usa Hugging Face. La exploración general por popularidad está centrada en SD 1.5; también se reconoce el SDXL oficial fijado. Explorar todo puede mostrar familias con su soporte pendiente, sin habilitarlas como ejecutables.

Se admiten checkpoints/finetunes completos SD 1.5 safetensors compatibles con la receta y LoRA estándar SD 1.5 en formato Kohya. La incorporación exige revisión, tamaño y SHA-256 publicados y una comprobación de cabecera acotada; no basta con una etiqueta de familia. No se ejecutan README, scripts, nodos ni workflows externos. No hay cuentas privadas/restringidas ni fuentes arbitrarias por URL.

Las consultas envían al proveedor términos de búsqueda, no la descripción de creación ni el inventario del equipo. No usan un LLM. Preparar y usar incorpora/selecciona la opción y abre su plan; no inicia una generación ni descarga sin consentimiento.

## LoRA

Se elige una base SD 1.5 compatible e intensidad visible entre 0 y 1,5. El perfil identifica archivo, revisión, base e intensidad. El plan reúne base y adaptación, agrega espacio/descarga y verifica ambos; guarda el LoRA en `loras` y usa `LoraLoader` en el proceso propio. No añade texto oculto al prompt.

No se admite SDXL como base de un LoRA SD 1.5. LoRA SDXL, formatos Diffusers/LyCORIS/DoRA, varios LoRA simultáneos y entrenamiento quedan pendientes.

## Configuraciones portables

Guardar configuración exporta un JSON pequeño; importar valida y guarda en SQLite, deduplica copias idénticas y conserva selección entre sesiones. No contiene pesos, prompts ni resultados. Recetas: `sd15-text-to-image-v1` y `sdxl-text-to-image-v1`, coherentes con la familia del modelo.

```json
{
  "kind": "veltria-image-configuration",
  "version": 1,
  "name": "Borrador horizontal",
  "description": "Mis ajustes iniciales",
  "modelId": "sd15-starter",
  "recipe": "sd15-text-to-image-v1",
  "parameters": {
    "steps": 12,
    "cfg": 7,
    "sampler": "euler",
    "scheduler": "normal",
    "format": "landscape"
  }
}
```

El formato portable admite 8–40 pasos, CFG 1–12, Euler/normal y formatos square/landscape/portrait; máximo 32 KiB y 100 configuraciones importadas. Rechaza campos ajenos, scripts y grafos. Estos límites son distintos de los [ajustes por imagen](image-quality.md), que no modifican el JSON guardado.

## Gestionar descargas

Modelos → Gestionar descargas muestra archivos reconocidos completos/parciales, tamaño, ubicación y perfiles que los comparten. Son tamaños lógicos del catálogo, no un escaneo del uso total del disco. Un archivo del tamaño esperado puede seguir pendiente de integridad/preparación.

Usar o continuar abre la preparación correspondiente. Revisar retirada muestra el archivo y los perfiles afectados; cancelar lo conserva. Retirar un LoRA no retira su base. Una base o archivo compartido requiere confirmar los perfiles afectados.

Se elimina sólo el archivo revisado: no carpetas recursivamente, creaciones, configuraciones ni otros modelos. Los perfiles afectados pierden disponibilidad, conservando la evidencia histórica. Se protegen enlaces, archivos no regulares, ubicaciones externas y tamaños distintos del esperado. La revisión cambia si cambia el archivo; preparación/trabajos activos bloquean operaciones incompatibles.

No se inspeccionan dependencias de aplicaciones o workflows externos. La descarga automática del conjunto H3, gestión de configuraciones de video y soporte de otras familias siguen pendientes. [Preparación](setup.md), [validación](validation.md).
