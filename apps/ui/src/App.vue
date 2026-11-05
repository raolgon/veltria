<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Sparkles, Monitor, Settings2, ChevronRight, ShieldCheck, LockKeyhole, Image as ImageIcon, Sun, Moon, Cpu, HardDrive, RefreshCw, ArrowRight, AlertTriangle, Info, Check, Wifi, Layers3, FolderOpen } from '@lucide/vue'
import { eventSchema, type Settings, type Locale, type Hardware, type Engine, type CreationState, type PreparationPlan, type ImageJob, type VideoState, type VideoPlan, type VideoJob, type Catalog, type SetupState } from '@veltria/contracts'
import { bytes, t, date, locale, setLocale } from './i18n'
import CreationStudio from './CreationStudio.vue'
import ImageLibrary from './ImageLibrary.vue'
import VideoStudio from './VideoStudio.vue'
import VideoLibrary from './VideoLibrary.vue'
import SetupWizard from './SetupWizard.vue'
import ModelCatalog from './ModelCatalog.vue'
import ResourceMonitor from './ResourceMonitor.vue'
import { api } from './api'
import { es } from './copy'
type View = 'create' | 'models' | 'library' | 'device' | 'settings'
const navigation = computed(() => [{ id: 'create', label: t(es.create), icon: Sparkles }, { id: 'models', label: t('Modelos'), icon: Layers3 }, { id: 'library', label: t('Biblioteca'), icon: FolderOpen }, { id: 'device', label: t(es.device), icon: Monitor }, { id: 'settings', label: t(es.settings), icon: Settings2 }] as const)
const view = ref<View>('create'), settings = ref<Settings>({ theme: 'system', locale: locale.value, engineUrl: null, engineBinding: null, modelsDirectory: null })
const connected = ref(false), loading = ref(true), saving = ref(false), probing = ref(false), error = ref(''), notice = ref('')
const hardware = ref<Hardware | null>(null), hardwareError = ref(''), hardwareBusy = ref(false), engine = ref<Engine | null>(null)
const setupOpen = ref(false), setupState = ref<SetupState | null>(null)
const catalog = ref<Catalog | null>(null)
const creation = ref<CreationState | null>(null), plan = ref<PreparationPlan | null>(null), jobs = ref<ImageJob[]>([]), totalJobs = ref(0), operationBusy = ref(false)
const mediaKind = ref<'image' | 'video'>('image'), videoState = ref<VideoState | null>(null), videoPlan = ref<VideoPlan | null>(null), videoJobs = ref<VideoJob[]>([]), totalVideos = ref(0), videoPrompt = ref(''), videoPreset = ref<'preview' | 'short'>('preview'), selectedVideoId = ref('')
const selectedVideo = computed(() => videoJobs.value.find(job => job.id === selectedVideoId.value) || videoState.value?.activeJob || null)
const format = ref<'square' | 'landscape' | 'portrait'>('square'), selectedJobId = ref(''), bindingDirectory = ref(''), bindingPython = ref(''), bindingDirty = ref(false)
const selectedJob = computed(() => jobs.value.find(job => job.id === selectedJobId.value) || creation.value?.activeJob || null)
const prompt = ref(''), engineAddress = ref('http://127.0.0.1:8188'), engineDirty = ref(false), systemDark = ref(false)
let media: MediaQueryList, stream: EventSource | undefined, refreshPending = false, refreshQueued = false, destroyed = false
const isDark = computed(() => settings.value.theme === 'dark' || settings.value.theme === 'system' && systemDark.value)
const heading = computed(() => navigation.value.find(item => item.id === view.value)!.label)
const status = computed(() => t(engine.value ? es[engine.value.status] : 'Sin consultar'))
function applyTheme() {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
  try { localStorage.setItem('veltria-theme-cache', settings.value.theme) } catch { /* optional cache */ }
}
function message(cause: unknown) { return cause instanceof Error ? cause.message : 'No se pudo conectar. Vuelve a intentarlo.' }
async function refresh() {
  if (destroyed) return
  if (refreshPending) { refreshQueued = true; return }
  refreshPending = true
  try {
    const [saved, motor, studio, library, movies, movieLibrary, modelCatalog, setup] = await Promise.all([api.settings(), api.engine(), api.creation(), api.jobs(), api.video(), api.videos(), api.catalog(), api.setup()])
    if (creation.value?.configuration.id !== studio.configuration.id) { format.value = studio.configuration.format; selectedJobId.value = ''; plan.value = null }
    settings.value = saved; engine.value = motor; creation.value = studio; totalJobs.value = library.total
    setupState.value = setup; catalog.value = modelCatalog; videoState.value = movies; totalVideos.value = movieLibrary.total
    videoJobs.value = [...movieLibrary.jobs, ...videoJobs.value.filter(job => !movieLibrary.jobs.some(incoming => incoming.id === job.id))]
    const older = jobs.value.filter(job => !library.jobs.some(incoming => incoming.id === job.id))
    jobs.value = [...library.jobs, ...older]
    if (!bindingDirty.value) { bindingDirectory.value = saved.engineBinding?.directory || ''; bindingPython.value = saved.engineBinding?.python || '' }
    if (!engineDirty.value) engineAddress.value = saved.engineUrl || 'http://127.0.0.1:8188'
    connected.value = true
  } catch (cause) { connected.value = false; error.value = message(cause) }
  finally { refreshPending = false; if (refreshQueued) { refreshQueued = false; void refresh() } }
}
async function refreshHardware() {
  hardwareBusy.value = true; hardwareError.value = ''
  try { hardware.value = await api.hardware() } catch (cause) { hardwareError.value = message(cause) }
  finally { hardwareBusy.value = false }
}
async function connect() {
  if (loading.value && stream) return
  loading.value = true; error.value = ''; stream?.close()
  try {
    settings.value = await api.authorize()
    await api.health(); connected.value = true
    await refresh()
    stream = new EventSource('/api/v1/events')
    stream.onmessage = event => {
      try { eventSchema.parse(JSON.parse(event.data)); void refresh() } catch { error.value = 'Se recibió un evento no válido. Vuelve a conectar.' }
    }
    stream.onerror = () => { connected.value = false; error.value = 'Se perdió la conexión con el servicio. Tu descripción se conserva. Intentando reconectar…' }
    stream.onopen = () => { connected.value = true; error.value = ''; void refresh() }
    await refreshHardware()
  } catch (cause) { connected.value = false; error.value = message(cause) }
  finally { loading.value = false }
}
async function changeTheme(theme: Settings['theme']) {
  settings.value = { ...settings.value, theme }; notice.value = ''; applyTheme()
  if (!connected.value) { notice.value = 'Apariencia temporal en esta pantalla. Se guardará cuando vuelvas a elegirla con el servicio conectado.'; return }
  saving.value = true
  try { settings.value = await api.save({ theme }); notice.value = 'Apariencia guardada en este equipo.' }
  catch (cause) { error.value = message(cause); notice.value = 'El cambio es temporal: no se pudo guardar.' }
  finally { saving.value = false }
}
async function changeLanguage(value: Locale) {
  settings.value = { ...settings.value, locale: value }; notice.value = ''
  if (!connected.value) { notice.value = 'Idioma temporal: vuelve a elegirlo con el servicio conectado para guardarlo.'; return }
  saving.value = true
  try { settings.value = await api.save({ locale: value }); notice.value = 'Idioma guardado en este equipo.' }
  catch (cause) { error.value = message(cause); notice.value = 'Idioma temporal: vuelve a elegirlo con el servicio conectado para guardarlo.' }
  finally { saving.value = false }
}
async function saveEngine(disconnect = false) {
  saving.value = true; error.value = ''; notice.value = ''
  try {
    settings.value = await api.save({ engineUrl: disconnect ? null : engineAddress.value.trim() })
    engineDirty.value = false; await refresh(); notice.value = disconnect ? 'Conexión retirada; ComfyUI sigue intacto.' : 'Dirección guardada. Comprueba la conexión cuando quieras.'
  } catch (cause) { error.value = message(cause) }
  finally { saving.value = false }
}
async function checkEngine() {
  probing.value = true; error.value = ''
  try { engine.value = await api.check() } catch (cause) { error.value = message(cause) }
  finally { probing.value = false }
}

async function operation(work: () => Promise<void>) {
  if (operationBusy.value) return
  operationBusy.value = true; error.value = ''; notice.value = ''
  try { await work(); await refresh() } catch (cause) { error.value = message(cause) }
  finally { operationBusy.value = false }
}
function selectConfiguration(id: string, prepare: boolean) { void operation(async () => {
  creation.value = await api.selectConfiguration(id)
  format.value = creation.value.configuration.format
  selectedJobId.value = ''; plan.value = null
  try { sessionStorage.removeItem('veltria-pending-create') } catch {}
  mediaKind.value = 'image'; await navigate('create')
  if (prepare) {
    if (!creation.value.bound) { setupOpen.value = true; setupState.value = await api.scanSetup() }
    else plan.value = await api.plan()
  }
}) }
function importConfiguration(value: unknown) { void operation(async () => {
  await api.importConfiguration(value)
  notice.value = 'Configuración importada. Ya puedes elegirla junto a su modelo.'
}) }
function openVideo() { mediaKind.value = 'video'; void navigate('create') }
function openSetup() { setupOpen.value = true; scanSetup() }
function scanSetup(directory?: string) { void operation(async () => { setupState.value = await api.scanSetup(directory) }) }
function prepareSetup(revision: string) { void operation(async () => { await api.prepareSetup(revision); setupOpen.value = false; mediaKind.value = 'image'; await navigate('create') }) }
function reviewPlan() { void operation(async () => { plan.value = await api.plan() }) }
function prepareProfile() { void operation(async () => { if (!plan.value) return; await api.prepare(plan.value.revision); plan.value = null }) }
function resumeProfile() { void operation(async () => { const current = await api.plan(); if (current.canPrepare && current.revision === creation.value?.preparation.revision) await api.prepare(current.revision); else plan.value = current }) }
function pauseProfile() { void operation(async () => { await api.pause() }) }
function generate() {
  void operation(async () => {
    let requestId = crypto.randomUUID()
    try { const saved = JSON.parse(sessionStorage.getItem('veltria-pending-create') || 'null'); if (saved?.prompt === prompt.value.trim() && saved.format === format.value && typeof saved.requestId === 'string') requestId = saved.requestId } catch {}
    const input = { requestId, prompt: prompt.value.trim(), format: format.value }
    try { sessionStorage.setItem('veltria-pending-create', JSON.stringify(input)) } catch {}
    const job = await api.create(input); selectedJobId.value = job.id
    try { sessionStorage.removeItem('veltria-pending-create') } catch {}
  })
}
function reviewVideoPlan() { void operation(async () => { videoPlan.value = await api.videoPlan() }) }
function prepareVideo() { void operation(async () => { if (!videoPlan.value) return; await api.prepareVideo(videoPlan.value.revision); videoPlan.value = null }) }
function pauseVideo() { void operation(async () => { await api.pauseVideo() }) }
function generateVideo() { void operation(async () => {
  let requestId = crypto.randomUUID()
  try { const saved = JSON.parse(sessionStorage.getItem('veltria-pending-video') || 'null'); if (saved?.prompt === videoPrompt.value.trim() && saved.preset === videoPreset.value && typeof saved.requestId === 'string') requestId = saved.requestId } catch {}
  const input = { requestId, prompt: videoPrompt.value.trim(), preset: videoPreset.value }
  try { sessionStorage.setItem('veltria-pending-video', JSON.stringify(input)) } catch {}
  const job = await api.createVideo(input); selectedVideoId.value = job.id
  try { sessionStorage.removeItem('veltria-pending-video') } catch {}
}) }
function cancelVideo(id: string) { void operation(async () => { await api.cancelVideo(id) }) }
function reconcileVideo(id: string) { void operation(async () => { await api.reconcileVideo(id) }) }
function reuseVideo(job: VideoJob) { videoPrompt.value = job.prompt; videoPreset.value = job.preset; selectedVideoId.value = job.id; mediaKind.value = 'video'; void navigate('create') }
function moreVideos() { void operation(async () => { const page = await api.videos(videoJobs.value.length); videoJobs.value.push(...page.jobs); totalVideos.value = page.total }) }
function cancelJob(id: string) { void operation(async () => { await api.cancel(id) }) }
function reconcileJob(id: string) { void operation(async () => { await api.reconcile(id) }) }
function changeModelsDirectory(path: string) { void operation(async () => { settings.value = await api.save({ modelsDirectory: path }); plan.value = await api.plan() }) }
function saveBinding() { void operation(async () => { settings.value = await api.save({ engineBinding: { directory: bindingDirectory.value.trim(), python: bindingPython.value.trim() } }); bindingDirty.value = false; notice.value = 'Motor vinculado. Veltria reutilizará su instalación para preparar el perfil.' }) }
function reuse(job: ImageJob) { prompt.value = job.prompt; format.value = job.format; selectedJobId.value = job.id; void navigate('create') }
function moreJobs() { void operation(async () => { const page = await api.jobs(jobs.value.length); jobs.value.push(...page.jobs); totalJobs.value = page.total }) }

async function navigate(id: View) { view.value = id; await nextTick(); window.scrollTo({ top: 0 }); document.querySelector<HTMLElement>('h1')?.focus() }
function mediaChange(event: MediaQueryListEvent) { systemDark.value = event.matches }
watch([isDark, () => settings.value.theme], applyTheme)
watch(() => settings.value.locale, setLocale, { immediate: true })
onMounted(() => {
  media = matchMedia('(prefers-color-scheme: dark)'); systemDark.value = media.matches; media.addEventListener('change', mediaChange)
  try { const cached = localStorage.getItem('veltria-theme-cache'); if (cached === 'light' || cached === 'dark') settings.value.theme = cached; prompt.value = sessionStorage.getItem('veltria-draft') || ''; videoPrompt.value = sessionStorage.getItem('veltria-video-draft') || '' } catch {}
  applyTheme(); void connect()
})
watch(videoPrompt, value => { try { sessionStorage.setItem('veltria-video-draft', value) } catch {} })
watch(prompt, value => { try { sessionStorage.setItem('veltria-draft', value) } catch {} })
onBeforeUnmount(() => { destroyed = true; stream?.close(); media?.removeEventListener('change', mediaChange) })
</script>

<template>
  <a class="skip-link" href="#content">{{ t('Ir al contenido') }}</a>
  <div class="app-shell" :class="{ 'creating-view': view === 'create' }">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('create')" :aria-label="t('Veltria, ir a crear')"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 6h7l7 14 5-10h-6l2-4h12L17 29z" fill="currentColor"/></svg><span>VELTRIA</span><span class="brand-dot"></span></a>
      <div class="workspace-label">{{ t('TU ESPACIO CREATIVO') }}</div>
      <nav :aria-label="t('Principal')"><button v-for="item in navigation" :key="item.id" :class="['nav-item', { active: view === item.id }]" :aria-label="item.label" :aria-current="view === item.id ? 'page' : undefined" @click="navigate(item.id)"><component :is="item.icon" :size="19"/><span>{{ item.label }}</span><ChevronRight v-if="view === item.id" :size="14" class="nav-arrow"/></button></nav>
      <div class="sidebar-bottom"><ResourceMonitor :connected="connected" :cpu-name="hardware?.cpu.name"/><div class="sidebar-footer"><span class="version">VELTRIA <span>{{ t('0.5 / PREPARACIÓN LOCAL') }}</span></span><button class="icon-button" :disabled="saving" :aria-label="isDark ? t('Cambiar a modo claro') : t('Cambiar a modo oscuro')" @click="changeTheme(isDark ? 'light' : 'dark')"><Sun v-if="isDark" :size="19"/><Moon v-else :size="19"/></button></div></div>
    </aside>
    <div class="main-shell">
      <header class="topbar"><a class="mobile-brand" href="#" @click.prevent="navigate('create')"><span>VELTRIA</span></a><div class="breadcrumb">{{ t('Estudio') }} <ChevronRight :size="13"/><span>{{ heading }}</span></div><div class="topbar-right"><span class="local-note"><ShieldCheck :size="15"/>{{ t(connected ? es.connected : es.disconnected) }}</span><button class="icon-button mobile-theme-switch" :disabled="saving" :aria-label="isDark ? t('Cambiar a modo claro') : t('Cambiar a modo oscuro')" @click="changeTheme(isDark ? 'light' : 'dark')"><Sun v-if="isDark" :size="19"/><Moon v-else :size="19"/></button></div></header>
      <div v-if="error" class="service-alert" role="alert"><AlertTriangle :size="18"/><span>{{ t(error) }}</span><button class="secondary-button" :disabled="loading" @click="connect">{{ t('Volver a conectar') }}</button><button class="icon-button" :aria-label="t('Cerrar aviso')" @click="error = ''">×</button></div>
      <p v-if="notice" class="service-notice" role="status">{{ t(notice) }}</p>
      <main id="content">
        <div v-if="view === 'create' || view === 'library'" class="media-tabs" role="group" :aria-label="t('Tipo de contenido')"><button :class="{ selected: mediaKind === 'image' }" :aria-pressed="mediaKind === 'image'" @click="mediaKind = 'image'">{{ t('Imágenes') }}</button><button :class="{ selected: mediaKind === 'video' }" :aria-pressed="mediaKind === 'video'" @click="mediaKind = 'video'">{{ t('Video') }}</button></div>
        <CreationStudio v-if="view === 'create' && mediaKind === 'image'" v-model:prompt="prompt" v-model:format="format" :state="creation" :plan="plan" :job="selectedJob" :connected="connected" :busy="operationBusy" :error="error" @plan="reviewPlan" @prepare="prepareProfile" @resume="resumeProfile" @pause="pauseProfile" @create="generate" @cancel="cancelJob" @reconcile="reconcileJob" @close-plan="plan = null" @models-directory="changeModelsDirectory" @device="navigate('device')" @models="navigate('models')" @setup="openSetup"/>
        <VideoStudio v-else-if="view === 'create'" v-model:prompt="videoPrompt" v-model:preset="videoPreset" :state="videoState" :plan="videoPlan" :job="selectedVideo" :connected="connected" :busy="operationBusy" :error="error" @plan="reviewVideoPlan" @prepare="prepareVideo" @pause="pauseVideo" @create="generateVideo" @cancel="cancelVideo" @reconcile="reconcileVideo" @close-plan="videoPlan = null" @device="navigate('device')"/>
        <ImageLibrary v-else-if="view === 'library' && mediaKind === 'image'" :jobs="jobs" :total="totalJobs" :busy="operationBusy" @reuse="reuse" @more="moreJobs" @create="navigate('create')"/>
        <VideoLibrary v-else-if="view === 'library'" :jobs="videoJobs" :total="totalVideos" :busy="operationBusy" @reuse="reuseVideo" @more="moreVideos" @create="navigate('create')"/>
        <ModelCatalog v-else-if="view === 'models'" :catalog="catalog" :state="creation" :busy="operationBusy" :connected="connected" @select="selectConfiguration" @import="importConfiguration" @pause="pauseProfile" @video="openVideo"/>
        <template v-else-if="view === 'device'">
          <div class="page-heading"><div><h1 tabindex="-1">{{ t('Mi equipo') }}</h1><p>{{ t('Las mediciones pertenecen al equipo que ejecuta el servicio.') }}</p></div><button class="secondary-button" :disabled="!connected || hardwareBusy" @click="refreshHardware"><RefreshCw :size="16"/>{{ hardwareBusy ? t('Consultando…') : t('Actualizar hardware') }}</button></div>
          <p v-if="hardwareError" class="warning" role="alert">{{ t(hardwareError) }}</p>
          <p v-if="!hardware && hardwareBusy" role="status">{{ t('Detectando el hardware del servicio…') }}</p>
          <template v-if="hardware">
            <div class="device-banner"><Monitor :size="20"/><span>{{ hardware.host }} · {{ hardware.platform }} / {{ hardware.arch }} <strong v-if="hardware.wsl"> · WSL2</strong><br>{{ hardware.release }}</span></div>
            <dl class="hardware-list"><div><dt><Cpu :size="18"/>{{ t('Procesador') }}</dt><dd>{{ hardware.cpu.name || t(es.unknown) }}<small>{{ hardware.cpu.logicalCores }} {{ t('procesadores lógicos ·') }} {{ t(hardware.cpu.source) }}</small></dd></div><div><dt>{{ t('Memoria RAM') }}</dt><dd>{{ bytes(hardware.ram.total) }} total · {{ bytes(hardware.ram.available) }} {{ t('disponible') }}<small>{{ t(hardware.ram.source) }}</small></dd></div><div><dt><HardDrive :size="18"/>{{ t('Disco de datos') }}</dt><dd>{{ bytes(hardware.disk.total) }} total · {{ bytes(hardware.disk.available) }} {{ t('disponible') }}<small>{{ hardware.disk.path }} · {{ t(hardware.disk.source) }}</small></dd></div><div v-for="(gpu, index) in hardware.gpus" :key="index"><dt>GPU {{ index + 1 }}</dt><dd>{{ gpu.name }}<small>VRAM: {{ bytes(gpu.vramTotal) }} total · {{ bytes(gpu.vramAvailable) }} {{ t('libre · Controlador:') }} {{ gpu.driver || t(es.unknown) }}<br>{{ t(gpu.source) }}</small></dd></div><div v-if="!hardware.gpus.length"><dt>GPU</dt><dd>{{ t('Desconocida') }}<small>{{ t('No se pudo obtener un inventario fiable.') }}</small></dd></div></dl>
            <details class="measurement-details"><summary>{{ t('Fuentes y límites de esta medición') }}</summary><p v-for="note in hardware.notes" :key="note">{{ t(note) }}</p><p>{{ t('Medido:') }} {{ date(hardware.sampledAt) }}</p></details>
          </template>
          <section class="setup-card real-setup"><div><h2>{{ t('Preparar mi equipo') }}</h2><p>{{ t('Veltria puede encontrar una instalación existente y preparar lo necesario para crear, sin pedirte rutas de Python.') }}</p></div><button class="primary-button" :disabled="!connected || operationBusy" @click="openSetup">{{ t('Revisar mi equipo') }}</button></section>
          <details class="settings-card advanced-connection"><summary>{{ t('Avanzado · Usar una instalación existente de ComfyUI') }}</summary><p>{{ t('Comprobación técnica local. Guarda la dirección y consulta capacidades sin modificar su instalación. No es la incorporación final para principiantes.') }}</p><form @submit.prevent="saveEngine()"><label for="engine-address">{{ t('Dirección local de ComfyUI') }}</label><input id="engine-address" v-model="engineAddress" type="text" class="text-input" maxlength="200" inputmode="url" :disabled="!connected || probing || saving" aria-describedby="engine-hint" @input="engineDirty = true"><p id="engine-hint">{{ t('Sólo HTTP en 127.0.0.1, localhost o [::1]. Por ejemplo, http://127.0.0.1:8188.') }}</p><div class="action-row"><button type="submit" class="secondary-button" :disabled="!connected || saving || probing">{{ t('Guardar dirección') }}</button><button type="button" class="primary-button" :disabled="!connected || !settings.engineUrl || engineDirty || saving || probing || engine?.status === 'checking'" @click="checkEngine">{{ probing || engine?.status === 'checking' ? t('Comprobando…') : t('Comprobar conexión') }}</button><button v-if="settings.engineUrl" type="button" class="text-button" :disabled="!connected || saving || probing" @click="saveEngine(true)">{{ t('Retirar conexión') }}</button></div></form><section aria-live="polite"><h3>{{ status }}</h3><p>{{ t(engine?.message || '') }}</p><template v-if="engine?.status === 'ready'"><p>{{ engine.nodeCount }} {{ t('tipos de nodo · Versión:') }} {{ engine.version || t('No informada') }}</p><p>{{ t('Dispositivos del motor:') }} {{ engine.devices.join(', ') || t('No informados') }}</p><details><summary>{{ t('Modelos declarados por ComfyUI (') }}{{ engine.models.length }})</summary><ul><li v-for="model in engine.models" :key="model">{{ model }}</li></ul><p v-if="!engine.models.length">{{ t('No se declararon modelos en los cargadores consultados.') }}</p></details></template><p v-if="engine?.checkedAt" class="small-note">{{ t('Última comprobación:') }} {{ date(engine.checkedAt) }}{{ t('. No es una monitorización continua.') }}</p></section></details>
          <details class="settings-card advanced-connection"><summary>{{ t('Avanzado · Vincular la instalación para crear') }}</summary><p>{{ t('Veltria reutiliza el Python y el motor que ya tienes. Durante la preparación abrirá un proceso local con carpetas propias; no actualizará la instalación ni ejecutará sus nodos personalizados.') }}</p><form @submit.prevent="saveBinding"><label for="binding-directory">{{ t('Carpeta de ComfyUI (contiene main.py)') }}</label><input id="binding-directory" v-model="bindingDirectory" type="text" class="text-input" maxlength="1000" @input="bindingDirty = true"><label for="binding-python">{{ t('Python existente del motor') }}</label><input id="binding-python" v-model="bindingPython" type="text" class="text-input" maxlength="1000" @input="bindingDirty = true"><button class="secondary-button" :disabled="!connected || operationBusy || !bindingDirectory.trim() || !bindingPython.trim()">{{ t('Vincular esta instalación') }}</button></form><p v-if="settings.engineBinding">{{ t('Instalación vinculada. Ya puedes revisar la preparación desde Crear.') }}</p></details>
        </template>
        <template v-else>
          <div class="page-heading"><div><h1 tabindex="-1">{{ t('Ajustes') }}</h1><p>{{ t('Tu espacio, a tu manera.') }}</p></div></div>
          <section class="settings-card" aria-labelledby="language-title"><h2 id="language-title">{{ t('Idioma') }}</h2><p>{{ t('Elige el idioma de Veltria. Se comparte entre navegador y escritorio.') }}</p><div class="language-options" role="group" :aria-label="t('Idioma')"><button v-for="option in ([{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }] as const)" :key="option.value" :lang="option.value" :class="{ selected: settings.locale === option.value }" :aria-pressed="settings.locale === option.value" :disabled="saving" @click="changeLanguage(option.value)">{{ option.label }}<Check v-if="settings.locale === option.value" :size="16" aria-hidden="true"/></button></div></section>
          <section class="settings-card"><h2>{{ t('Apariencia') }}</h2><p>{{ t('La preferencia se comparte entre navegador y escritorio conectados al mismo servicio.') }}</p><div class="theme-options"><button v-for="option in (['system', 'light', 'dark'] as const)" :key="option" :class="{ selected: settings.theme === option }" :aria-pressed="settings.theme === option" :disabled="saving" @click="changeTheme(option)"><Monitor v-if="option === 'system'" :size="23"/><Sun v-else-if="option === 'light'" :size="23"/><Moon v-else :size="23"/><strong>{{ { system: t('Sistema'), light: t('Claro'), dark: t('Oscuro') }[option] }}</strong><Check v-if="settings.theme === option" :size="14"/></button></div><p class="small-note">{{ connected ? t('Guardada en SQLite por el servicio local.') : t('Sin servicio: puedes usar una apariencia temporal.') }}</p></section>
          <section class="settings-card"><h2><Wifi :size="19"/>{{ t('Red local') }}</h2><p>{{ t('Compartir con otro dispositivo está pendiente del incremento 3B. Este servicio escucha sólo en loopback.') }}</p><label class="pending-toggle"><input type="checkbox" disabled>{{ t('Compartir en mi red local · pendiente') }}</label></section>
          <section class="settings-card"><h2>{{ t('Tu espacio creativo') }}</h2><p>{{ t('Incluye imagen y video local con perfiles revisados. Instalación de motores, imagen a video y edición siguen pendientes.') }}</p></section>
        </template>
      </main>
      <footer class="prototype-bar"><span><ShieldCheck :size="14"/>{{ connected ? t('Servicio autorizado · sólo este equipo') : t('Sin conexión al servicio') }}</span><span>{{ t('Veltria 0.5 · Creación local') }}</span></footer>
    </div>
    <SetupWizard v-if="setupOpen" :state="setupState" :connected="connected" :busy="operationBusy" :error="error" @close="setupOpen = false" @scan="scanSetup" @prepare="prepareSetup"/>
    <div class="mobile-dock"><nav class="mobile-nav" :aria-label="t('Navegación móvil')"><button v-for="item in navigation" :key="item.id" :class="{ active: view === item.id }" :aria-label="item.label" :aria-current="view === item.id ? 'page' : undefined" @click="navigate(item.id)"><component :is="item.icon" :size="21"/><span>{{ item.label }}</span></button></nav></div>
  </div>
</template>
