# Español e inglés

Seleccionar **Ajustes → Idioma → English**, o **Settings → Language → Español**. El cambio es inmediato y se comparte por eventos entre navegador y escritorio conectados al mismo servicio. No reinicia el motor ni vuelve a generar una imagen.

Se traducen navegación, Crear, biblioteca, ajustes, equipo, recursos en vivo, plan de preparación, licencia/consentimiento, progreso, estados y mensajes de recuperación. Los títulos y opciones propios de los diálogos Electron usan el idioma elegido; los controles que pertenecen al sistema operativo conservan su idioma nativo. Se retiraron la frase «La creatividad es tuya. Del resto nos encargamos.» y el adorno del menú lateral.

## Datos y preferencias

- `settings.locale` admite `es` y `en`, validado por el contrato compartido. Se guarda en el JSON de preferencias de SQLite, sin modificar el esquema de trabajos ni las autorizaciones de preparación.
- El contrato de proceso/API pasa a **protocolo 3**, porque las interfaces anteriores validaban estrictamente las preferencias y no reconocen `locale`. El lanzador rechaza adjuntarse a un servicio anterior, sin cerrarlo ni tocar sus datos. Después de guardar preferencias con esta versión, usar el paquete bilingüe para abrir esos datos; los ejecutables anteriores se conservan como entregas históricas.
- Las preferencias anteriores sin idioma se leen como español. Los parches de idioma conservan apariencia, vínculo, directorio de modelos y biblioteca. Un parche de apariencia conserva el idioma.
- Una caché local de presentación evita mostrar el idioma equivocado al cargar; el servicio es la autoridad. Sin conexión se permite una selección temporal, identificada como tal.
- Los mensajes de producto existentes se conservan en su forma canónica y se traducen al presentarlos, incluyendo estados ya guardados en la biblioteca. Las variables se insertan literalmente. Los diagnósticos externos desconocidos conservan su texto original.
- Las descripciones del usuario, nombres de dispositivos/modelos, rutas, archivos, identificadores y condiciones originales de la licencia no se traducen ni se envían a otro servicio. No se incorpora un LLM ni una traducción en línea.
- `html.lang`, nombres accesibles, fechas y cantidades se ajustan al idioma. La evidencia de generación incluye fecha y dimensiones estructuradas para formatear la fecha sin reinterpretar texto español guardado.

El catálogo compartido está en `packages/core/src/english.ts`; el renderizado Vue usa `apps/ui/src/i18n.ts`. Los códigos de estado y la lógica del motor no dependen de los textos traducidos.

## Abrir el paquete bilingüe

Se conserva la versión anterior y cualquier ventana abierta. Cerrar primero esa ventana; después abrir:

```powershell
Set-Location 'C:\Users\rafao\Downloads\veltria-codex\veltria'
.\release\0.2.0-bilingual\win-unpacked\Veltria.exe
# Navegador:
.\build\browser\0.2.0\veltria-web.exe
```

Linux / WSL con pantalla:

```bash
cd '/mnt/c/Users/rafao/Downloads/veltria-codex/veltria'
./release/0.2.0-bilingual/linux-unpacked/veltria
# Navegador:
./build/browser/0.2.0/veltria-web
```

La ventana anterior conserva su código hasta cerrarla; otro cliente puede adjuntarse a ese mismo servicio antiguo. Los datos habituales y el modelo preparado se reutilizan al abrir el paquete nuevo.

## Validación y pendientes

Comprobaciones: tipos, build Vue/Electron y auxiliares Linux/Windows; catálogo y parámetros de mensajes; preferencias antiguas/reapertura de SQLite; cambio de idioma con preparación activa; autorización/validación HTTP; dos ventanas con idioma compartido; persistencia al recargar; descripciones intactas; español e inglés en Crear, ajustes, equipo, recursos y biblioteca; plan/licencia, pausa y generación con fixture explícita; tamaños 320/390/768/1363 px y temas claro/oscuro.

Resultado: **14 pruebas Vitest, 9 pruebas Bun y 63 comprobaciones HTTP correctas**. Pasaron los **8 recorridos Playwright**, también con el ejecutable Linux del paquete final. Se comprobó el título inglés de guardado a través del manejador real de descarga de Electron, sin abrir el diálogo ni escribir archivos. En Windows nativo pasaron los tres smoke: auxiliar/protocolo 3, lanzador web y escritorio empaquetado con guardado de `locale=en`, ventana y cierre de su auxiliar. Se revisaron capturas de escritorio, ajustes móviles y plan en inglés; el detector de cambios UI no registró hallazgos.

Comandos de comprobación y empaquetado:

```bash
bun run typecheck
bun run test
VELTRIA_ELECTRON_EXECUTABLE="$PWD/release/0.2.0-bilingual/linux-unpacked/veltria" xvfb-run -a bun run test:ui
bun scripts/build.ts --target=bun-windows-x64-baseline
bun run build
bun x electron-builder --linux AppImage --dir --win --dir --x64 --config.directories.output=release/0.2.0-bilingual --publish never
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-smoke.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-web-smoke.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\windows-desktop-smoke.ps1 -Executable "$PWD\release\0.2.0-bilingual\win-unpacked\Veltria.exe"
```

Las pruebas de inferencia en esta entrega usan el motor de fixture: no se volvió a descargar el modelo ni a ejecutar una generación GPU para traducir la interfaz. Se mantiene la evidencia real anterior documentada en [first-image-validation.md](first-image-validation.md).

Pendientes: revisión manual de los diálogos reales de guardado/cierre y de accesibilidad/escalado físico de Windows; GPU y escritorio Linux fuera de WSL; macOS. Los títulos de guardado se comprueban por el manejador de descarga de Electron sin guardar archivos durante esa prueba. Los textos de consola de diagnóstico y la documentación del repositorio no constituyen otra interfaz traducida.
