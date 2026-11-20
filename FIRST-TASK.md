# Próxima tarea propuesta — validaciones físicas pendientes (hitos 3 y 4) y siguiente incremento

El código del hito 4 (reglas por hardware e incertidumbre de RAM, prioridad y etiquetas unificadas entre bienvenida, asistente, catálogo y Crear, recuperación guiada y matriz ampliada de pruebas con fixtures) está implementado en `development`, los paquetes nativos Windows `0.10.0` pasaron los smoke tests y la validación física del hito 3B (LAN desde segundo dispositivo físico en Wi-Fi privada, con corte de Internet y revocación) quedó comprobada en Windows el 20 de noviembre de 2026. Ver detalle en [docs/milestone-4.md](docs/milestone-4.md) y [docs/validation.md](docs/validation.md).

Leer [PROJECT.md](PROJECT.md), [PHILOSOPHY.md](PHILOSOPHY.md), [ARCHITECTURE.md](ARCHITECTURE.md) y [docs/status.md](docs/status.md). Trabajar en `development`, sin subagentes; conservar motores, datos y cambios. No descargar pesos ni instalar entornos nuevos sin un plan autorizado.

## Validación física pendiente de hitos 3 y 4

El instalador administrado, la bienvenida principal, el uso en red local (LAN), las recomendaciones unificadas y la recuperación guiada están implementados en 0.10.0. [Instalación administrada](docs/managed-setup.md), [red local](LOCAL-NETWORK.md), [evidencia](docs/validation.md). Continúan abiertos:

1. Probar el recorrido administrado y los paquetes en Linux nativo (WSL no certifica Linux nativo) y en otros equipos/SO limpios si se desea ampliar el alcance certificado.
2. Probar con una persona nueva que completa preparación, primera imagen y recuperación ante fallo sin terminal, registrando decisiones y dificultades.

## Siguientes posibles incrementos de código

- Alinear pruebas E2E antiguas (`tests/creation.e2e.ts` y `tests/app.e2e.ts`) con la pantalla de bienvenida obligatoria cuando aún no hay modelo preparado.
- Generar y comprobar el paquete `AppImage` (`package:linux`) cuando se vaya a probar en Linux nativo.
- Avanzar en el hito 5 según alcance autorizado (video H3, audio, firma o plataformas adicionales), manteniendo la creación como acción explícita posterior y sin añadir cuentas, nube ni autoactualizaciones.
