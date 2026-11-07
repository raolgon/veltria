# Español e inglés

Ajustes → Idioma permite cambiar entre Español y English. El cambio es inmediato y se comparte por eventos entre ventanas conectadas al mismo servicio, sin reiniciar el motor ni generar otra imagen.

Se traducen navegación, creación, biblioteca, equipo, recursos, modelos, preparación, calidad, consentimiento y mensajes de recuperación. Los textos propios de los diálogos Electron siguen esa elección; controles del sistema operativo conservan su idioma nativo.

`settings.locale` admite `es`/`en` y se guarda en SQLite. El servicio es la autoridad; una caché de presentación evita destellos. Sin conexión puede aplicarse una preferencia temporal identificada como tal. Cambiar idioma conserva tema, vínculo, modelos y biblioteca.

Los estados guardados se traducen al presentar sus mensajes canónicos. Fechas, cantidades, `html.lang` y nombres accesibles siguen el idioma. Descripciones, nombres de modelos/dispositivos, rutas, archivos, identificadores y licencias originales permanecen literales. Los diagnósticos externos desconocidos no se inventan ni se envían a traducir en línea.

Catálogo compartido: `packages/core/src/english.ts` y `packages/core/src/localization.ts`; presentación Vue: `apps/ui/src/i18n.ts`. La lógica de motor no depende del texto traducido. No hay LLM de traducción o reescritura del prompt. [Comprobaciones](validation.md).
