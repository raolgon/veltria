<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Monitor, Search, FolderOpen, X, Download, Check, RefreshCw } from '@lucide/vue'
import type { SetupState, SetupPlan, Installation, Hardware, Catalog, Preparation } from '@veltria/contracts'
import { api } from './api'
import { t, bytes } from './i18n'
import ManagedSetup from './ManagedSetup.vue'
import StorageNotice from './StorageNotice.vue'
import type { ManagedState } from '@veltria/contracts'
const props = defineProps<{ preparation?: Preparation; inline?: boolean; state: SetupState | null; managed?: ManagedState | null; hardware?: Hardware | null; catalog?: Catalog | null; connected: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; refresh: []; scan: [directory?: string]; prepare: [revision: string]; select: [id: string] }>()
const showOthers = ref(false), ownEnvironment = ref(false)
const choices = computed(() => (props.catalog?.models || []).filter(item => !item.profile.adaptation).sort((a, b) => {
  const rank = (level: string) => ['recommended', 'limited', 'unknown', 'unsupported'].indexOf(level)
  return rank(a.recommendation.level) - rank(b.recommendation.level)
}))
const visibleChoices = computed(() => showOthers.value ? choices.value : choices.value.slice(0, 2))
function chooseModel(modelId: string) {
  const entry = props.catalog?.configurations.find(item => item.configuration.modelId === modelId)
  if (entry) emit('select', entry.id)
}
const dialog = ref<HTMLDialogElement | null>(null), selected = ref(''), plan = ref<SetupPlan | null>(null), reviewing = ref(false), planError = ref(''), consent = ref(false), directory = ref(''), manualFolder = ref(false)
let reviewVersion = 0, disposed = false
const usable = computed(() => props.state?.installations.filter(item => item.available) || [])
const scanning = computed(() => props.state?.status === 'scanning')
const canPrepare = computed(() => props.connected && !props.busy && !scanning.value && !reviewing.value && consent.value && plan.value?.preparation.canPrepare)
const nativeFolder = typeof window.veltriaDesktop?.chooseEngineDirectory === 'function'
const changeModelFolder = ref(false), modelDirectory = ref('')
watch(() => props.preparation?.storageIssue, issue => { if (issue?.target === 'models') changeModelFolder.value = true }, { immediate: true })
async function saveModelDirectory() {
  consent.value = false; plan.value = null; reviewing.value = true; planError.value = ''
  try { await api.save({ modelsDirectory: modelDirectory.value.trim() }); emit('refresh'); await review() }
  catch (cause) { planError.value = cause instanceof Error ? cause.message : 'No se pudo revisar la propuesta. Vuelve a buscar la instalación.' }
  finally { reviewing.value = false }
}
function name(item: Installation) { return item.kind === 'pinokio' ? item.name : t(item.name) }
async function chooseFolder() {
  if (!nativeFolder) { manualFolder.value = true; await nextTick(); document.getElementById('setup-folder')?.focus(); return }
  try { const path = await window.veltriaDesktop!.chooseEngineDirectory(); if (path) emit('scan', path) }
  catch { planError.value = 'No se pudo abrir el selector de carpetas. Puedes escribir la ubicación.'; manualFolder.value = true }
}
async function review() {
  const version = ++reviewVersion; plan.value = null; planError.value = ''; consent.value = false
  if (!props.state?.scanId || !selected.value || props.state.status !== 'complete') { reviewing.value = false; return }
  reviewing.value = true
  try { const proposal = await api.setupPlan(props.state.scanId, selected.value); if (version === reviewVersion && !disposed) plan.value = proposal }
  catch (cause) { if (version === reviewVersion && !disposed) planError.value = cause instanceof Error ? cause.message : 'No se pudo revisar la propuesta. Vuelve a buscar la instalación.' }
  finally { if (version === reviewVersion && !disposed) reviewing.value = false }
}
watch(() => [props.state?.scanId, props.state?.status] as const, () => {
  const current = usable.value.find(item => item.id === selected.value)
  selected.value = current?.id || usable.value[0]?.id || ''
}, { immediate: true })
watch(() => [selected.value, props.state?.scanId, props.state?.status, props.catalog?.selectedConfigurationId, ownEnvironment.value], () => { if (ownEnvironment.value) { reviewVersion++; plan.value = null; consent.value = false; reviewing.value = false } else void review() }, { immediate: true })
onMounted(() => { if (!props.inline) dialog.value?.showModal() })
onBeforeUnmount(() => { disposed = true; reviewVersion++; if (!props.inline) dialog.value?.close() })
</script>
<template>
  <component :is="inline ? 'section' : 'dialog'" ref="dialog" :class="['setup-dialog', inline ? 'setup-inline' : 'preparation-dialog']" aria-labelledby="setup-title" @cancel="emit('close')">
    <template v-if="!inline">
    <button class="icon-button plan-close" :aria-label="t('Cerrar preparación del equipo')" @click="emit('close')"><X :size="22"/></button>
    <h2 id="setup-title">{{ t('Preparar mi equipo') }}</h2>
    <p>{{ t('Veltria busca lo que ya tienes y reúne lo necesario para crear tu primera imagen.') }}</p>
    </template>
    <h2 v-if="inline" id="setup-title">{{ t('Revisar instalación') }}</h2>
    <section v-if="scanning || !state" class="setup-search" role="status"><Search :size="26"/><strong>{{ t('Buscando herramientas existentes en tu equipo…') }}</strong><progress :aria-label="t('Búsqueda de instalaciones')"></progress><p>{{ t('Sólo estamos revisando archivos. No se está instalando ni descargando nada.') }}</p></section>
    <template v-else>
      <section v-if="hardware" class="setup-image">
        <h3>{{ t('Tu equipo para crear') }}</h3>
        <p>{{ hardware.gpus.map(gpu => gpu.name).join(', ') || hardware.cpu.name }}</p>
        <p>{{ bytes(hardware.ram.total) }} RAM · {{ bytes(hardware.gpus[0]?.vramTotal ?? null) }} {{ t('de memoria gráfica') }}</p>
      </section>
      <section v-if="catalog && !inline" class="setup-image">
        <h3>{{ t('Elige con qué empezar') }}</h3>
        <p>{{ t('Estas opciones se ordenan según los recursos de tu equipo. Puedes cambiar después.') }}</p>
        <fieldset class="setup-installations"><legend>{{ t('Modelos de imágenes') }}</legend>
          <label v-for="item in visibleChoices" :key="item.profile.id">
            <input type="radio" name="setup-model" :checked="catalog.selectedModelId === item.profile.id" :disabled="busy || catalog.busy" @change="chooseModel(item.profile.id)">
            <span>{{ item.profile.model }}<small>{{ t(item.profile.description) }}</small><small>{{ t(item.recommendation.reason) }}</small><small>{{ bytes(item.remainingBytes ?? item.profile.bytes) }} · {{ item.recommendation.level === 'recommended' ? t('Recomendado') : item.recommendation.level === 'limited' ? t('Con limitaciones') : t('Compatibilidad sin confirmar') }}</small></span>
          </label>
        </fieldset>
        <button class="text-button" :aria-expanded="showOthers" @click="showOthers = !showOthers">{{ showOthers ? t('Ver menos opciones') : t('Ver otros modelos') }}</button>
        <p class="helper">{{ t('Video experimental: primero prepara las imágenes. Después podrás revisar sus requisitos y descarga en Crear → Video.') }}</p>
      </section>
      <section v-if="usable.length" class="setup-image">
        <h3>{{ t('Encontramos ComfyUI. ¿Quieres usarlo?') }}</h3>
        <div class="action-row"><button class="secondary-button" :disabled="busy" :aria-pressed="!ownEnvironment" @click="ownEnvironment = false">{{ t('Usar mi instalación') }}</button><button class="text-button" :disabled="busy" :aria-pressed="ownEnvironment" @click="ownEnvironment = true">{{ t('Preparar una instalación propia') }}</button></div>
      </section>
      <fieldset v-if="usable.length > 1" class="setup-installations"><legend>{{ t('¿Qué instalación quieres reutilizar?') }}</legend><label v-for="item in usable" :key="item.id"><input v-model="selected" type="radio" name="setup-installation" :value="item.id" :disabled="busy"><span>{{ name(item) }}<small>{{ item.directory }}</small></span></label></fieldset>
      <template v-if="plan">
        <section class="setup-proposal"><Monitor :size="25" aria-hidden="true"/><div><h3>{{ t('Usaremos lo que ya tienes') }}</h3><p>{{ name(plan.installation) }}</p><p>{{ t('Se conservarán sus modelos y ajustes. Veltria abrirá un proceso propio cuando autorices la preparación.') }}</p></div></section>
        <section class="setup-image"><h3>{{ t('Una opción para empezar') }}</h3><p>{{ plan.profile.model }} · {{ plan.configuration.origin === 'included' ? t(plan.configuration.name) : plan.configuration.name }}</p><p>{{ t(plan.profile.description) }}</p><p class="helper">{{ t(plan.recommendation.reason) }}</p></section>
        <dl class="download-plan"><div><dt>{{ t('Descarga pendiente') }}</dt><dd>{{ bytes(plan.preparation.remainingBytes) }}</dd></div><div><dt>{{ t('Espacio necesario, con margen') }}</dt><dd>{{ bytes(plan.preparation.requiredBytes) }}</dd></div><div><dt>{{ t('Disponible en el disco') }}</dt><dd>{{ bytes(plan.preparation.availableBytes) }}</dd></div><div><dt>{{ t('Ya disponible para comprobar') }}</dt><dd>{{ bytes(plan.preparation.reuseBytes) }}</dd></div></dl>
        <p>{{ t('Al terminar, podrás crear con la descripción que ya escribiste. Preparar no genera una imagen.') }}</p>
        <details class="setup-technical"><summary>{{ t('Ver instalación, ubicación y cambios') }}</summary><p>{{ plan.configuration.steps }} {{ t('pasos') }} · CFG {{ plan.configuration.cfg }}</p><dl><div><dt>ComfyUI</dt><dd>{{ plan.installation.directory }}</dd></div><div><dt>Python</dt><dd>{{ plan.installation.python }}</dd></div><div><dt>{{ t('Archivo de destino') }}</dt><dd>{{ plan.preparation.destination }}</dd></div></dl><ul><li v-for="change in plan.preparation.changes" :key="change">{{ t(change) }}</li></ul><p>{{ t('Los archivos se han localizado; el arranque y la compatibilidad del entorno se comprobarán durante la preparación.') }}</p><a :href="plan.preparation.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a></details>
        <StorageNotice v-for="(issue, index) in plan.preparation.storageIssues || []" :key="index" :issue="issue" :disabled="busy || reviewing || !connected" @recheck="review" @relocate="changeModelFolder = true; consent = false"/>
        <p v-for="blocker in plan.preparation.blockers.filter(message => !plan?.preparation.storageIssues?.some(issue => issue.message === message))" :key="blocker" class="warning">{{ t(blocker) }}</p>
        <p>{{ t('Licencia:') }} <a :href="plan.preparation.licenseUrl" target="_blank" rel="noreferrer">{{ t(plan.preparation.license) }}</a>{{ t(', con condiciones de uso.') }}</p>
        <label class="license-consent"><input v-model="consent" type="checkbox" :disabled="busy">{{ t('He revisado la licencia y autorizo reutilizar esta instalación y preparar los archivos indicados.') }}</label>
        <button class="primary-button full" :disabled="!canPrepare" @click="emit('prepare', plan.revision)"><Download v-if="plan.preparation.remainingBytes" :size="17"/><Check v-else :size="17"/>{{ busy ? t('Iniciando…') : plan.preparation.remainingBytes ? t('Descargar y preparar mi equipo') : t('Comprobar y preparar mi equipo') }}</button>
      </template>
      <p v-else-if="reviewing" role="status">{{ t('Comprobando la propuesta y el espacio disponible…') }}</p>
      <form v-if="changeModelFolder" @submit.prevent="saveModelDirectory"><label for="setup-model-folder">{{ t('Carpeta de modelos en el equipo del servicio') }}</label><input id="setup-model-folder" v-model="modelDirectory" class="text-input" maxlength="1000" :disabled="busy || reviewing" @input="consent = false; plan = null"><button class="secondary-button" :disabled="busy || reviewing || !connected || !modelDirectory.trim()">{{ t('Usar carpeta y revisar el plan') }}</button></form>
      <ManagedSetup v-if="(!usable.length && state.status === 'complete') || ownEnvironment || (managed && managed.status !== 'idle')" :key="`${catalog?.selectedConfigurationId}-${ownEnvironment}`" :separate="ownEnvironment" :state="managed || null" :preparation="preparation" :connected="connected" :busy="busy" @refresh="emit('refresh')" @ready="emit('close')"/>
      <p v-if="planError" class="warning" role="alert">{{ t(planError) }}</p>
      <p v-if="error" class="warning" role="alert">{{ t(error) }}</p>
      <div class="action-row setup-search-actions"><button class="secondary-button" :disabled="busy || !connected" @click="chooseFolder"><FolderOpen :size="16"/>{{ t('Buscar en otra carpeta') }}</button><button class="text-button" :disabled="busy || !connected" @click="emit('scan')"><RefreshCw :size="16"/>{{ t('Volver a buscar') }}</button></div>
      <form v-if="manualFolder" class="setup-manual" @submit.prevent="emit('scan', directory.trim())"><label for="setup-folder">{{ t('Carpeta de la instalación en el equipo que ejecuta Veltria') }}</label><input id="setup-folder" v-model="directory" class="text-input" type="text" maxlength="1000" :disabled="busy" :placeholder="t('Pega la ubicación de la carpeta')"><button class="secondary-button" :disabled="busy || !connected || !directory.trim()">{{ t('Buscar en esta carpeta') }}</button><p>{{ t('En navegador, la ubicación corresponde al equipo del servicio. La app de escritorio ofrece un selector de carpetas.') }}</p></form>
      <details v-if="state.installations.some(item => !item.available)" class="setup-unavailable"><summary>{{ t('Otras instalaciones que requieren atención') }}</summary><div v-for="item in state.installations.filter(item => !item.available)" :key="item.id"><strong>{{ name(item) }}</strong><p>{{ t(item.reason) }}</p><small>{{ item.directory }}</small></div></details>
      <p v-for="note in state.notes" :key="note" class="helper">{{ t(note) }}</p>
      <p class="small-note">{{ t('La búsqueda revisa ubicaciones habituales y carpetas que elijas; no recorre todo el disco.') }}</p>
    </template>
  </component>
</template>
<style scoped>
.setup-inline{margin-top:28px;padding-top:28px;border-top:1px solid var(--line)}.setup-inline>h2{font-size:23px;font-weight:500;line-height:1.4}.setup-inline :deep(.primary-button.full){white-space:normal;line-height:1.5}.setup-inline :deep(dd){overflow-wrap:anywhere}
</style>
