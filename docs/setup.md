# Preparar el equipo

## Recorrido actual

En Crear o al elegir un modelo pendiente, **Preparar mi equipo** busca ComfyUI en ubicaciones habituales y carpetas elegidas. La búsqueda es acotada y de sólo lectura: no ejecuta Python, descarga ni instala componentes por localizar una carpeta. Revisa instalaciones portable, Pinokio, Desktop y carpetas compatibles con un entorno utilizable para el SO del servicio.

La propuesta distingue archivos localizados, entorno utilizable, motor comprobado y generación verificada. Si hay varias instalaciones, permite elegir. Presenta modelo/configuración, compatibilidad estimada, descarga restante, espacio con margen, ubicación, fuente, licencia y cambios. Una revisión concreta del plan requiere consentimiento antes de preparar.

El servicio guarda el vínculo aceptado, descarga/verifica los componentes necesarios y abre un proceso propio de ComfyUI con rutas de modelos de Veltria. No modifica el entorno externo ni sus modelos. Cambios de instalación, ubicación, componentes o configuración invalidan la revisión anterior. La propuesta tiene vigencia limitada y se vuelve a comprobar antes de actuar.

Se conservan descripción y ajustes. Pausar conserva el progreso recuperable; continuar verifica el plan y los archivos. Preparar no genera: al terminar se habilita **Crear imagen**.

El selector de carpeta es nativo en Electron. En navegador la ruta corresponde al equipo que ejecuta el servicio. Una instalación Windows no es un entorno Python Linux reutilizable desde WSL; para ella se usa Veltria Windows.

## Recorrido pendiente desde cero

1. Detectar hardware y proponer un modelo de imágenes y ajustes admitidos.
2. Buscar una instalación existente y reutilizarla si sirve.
3. Si falta, ofrecer un entorno propio, aislado y versionado, con el conjunto completo de dependencias.
4. Mostrar descarga, espacio, ubicación, licencias y cambios; autorizar una vez ese plan.
5. Ejecutar con fases reales, persistencia y recuperación; comprobar disponibilidad antes de habilitar Crear.

La persona no debe instalar Python, configurar puertos ni mover pesos. Un permiso nuevo, acceso restringido o cambio material del plan necesita una decisión informada. No instalar controladores silenciosamente ni ejecutar comandos procedentes de metadatos.

**Esta instalación administrada aún no existe.** La app informa de su ausencia; el laboratorio separado permite desarrollar y probar esa ruta. No se considera completada por detectar un motor existente o mostrar un asistente.

## Preparación y datos

Los pesos van a la ubicación configurada, por ejemplo `D:\Veltria\models`, con subcarpetas `checkpoints` y `loras`. Los modelos descubiertos y la selección se guardan en SQLite; sus archivos permanecen fuera de la base y del paquete de la app.

Las descargas usan `.part`, pausa, Range cuando el origen lo permite y comprobación final de tamaño/SHA-256. Un archivo completo por tamaño no se considera íntegro hasta comprobarlo. Se conservan archivos previos distintos y componentes compartidos. La instalación futura debe aplicar las mismas garantías a su entorno y operaciones.

API vigente: `/api/v1/setup`, `/setup/scan`, `/setup/plan`, `/setup/prepare`; el estado/plan de componentes está bajo `/api/v1/creation`. Ver [arquitectura](../ARCHITECTURE.md), [modelos](models.md) y [validación](validation.md).
