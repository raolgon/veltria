<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Monitor, Search, FolderOpen, X, Download, Check, RefreshCw } from '@lucide/vue'
import type { SetupState, SetupPlan, Installation } from '@veltria/contracts'
import { api } from './api'
import { t, bytes } from './i18n'
const props = defineProps<{ state: SetupState | null; connected: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; scan: [directory?: string]; prepare: [revision: string] }>()
const dialog = ref<HTMLDialogElement | null>(null), selected = ref(''), plan = ref<SetupPlan | null>(null), reviewing = ref(false), planError = ref(''), consent = ref(false), directory = ref(''), manualFolder = ref(false)
let reviewVersion = 0, disposed = false
const usable = computed(() => props.state?.installations.filter(item => item.available) || [])
const scanning = computed(() => props.state?.status === 'scanning')
const canPrepare = computed(() => props.connected && !props.busy && !scanning.value && !reviewing.value && consent.value && plan.value?.preparation.canPrepare)
const nativeFolder = typeof window.veltriaDesktop?.chooseEngineDirectory === 'function'
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
watch(() => [selected.value, props.state?.scanId, props.state?.status], () => { void review() }, { immediate: true })
onMounted(() => { dialog.value?.showModal() })
onBeforeUnmount(() => { disposed = true; reviewVersion++; dialog.value?.close() })
</script>
<template>
  <dialog ref="dialog" class="preparation-dialog setup-dialog" aria-labelledby="setup-title" @cancel="emit('close')">
    <button class="icon-button plan-close" :aria-label="t('Cerrar preparación del equipo')" @click="emit('close')"><X :size="22"/></button>
    <h2 id="setup-title">{{ t('Preparar mi equipo') }}</h2>
    <p>{{ t('Veltria busca lo que ya tienes y reúne lo necesario para crear tu primera imagen.') }}</p>
    <section v-if="scanning || !state" class="setup-search" role="status"><Search :size="26"/><strong>{{ t('Buscando herramientas existentes en tu equipo…') }}</strong><progress :aria-label="t('Búsqueda de instalaciones')"></progress><p>{{ t('Sólo estamos revisando archivos. No se está instalando ni descargando nada.') }}</p></section>
    <template v-else>
      <p class="setup-result" role="status">{{ t(state.message) }}</p>
      <fieldset v-if="usable.length > 1" class="setup-installations"><legend>{{ t('¿Qué instalación quieres reutilizar?') }}</legend><label v-for="item in usable" :key="item.id"><input v-model="selected" type="radio" name="setup-installation" :value="item.id" :disabled="busy"><span>{{ name(item) }}<small>{{ item.directory }}</small></span></label></fieldset>
      <template v-if="plan">
        <section class="setup-proposal"><Monitor :size="25" aria-hidden="true"/><div><h3>{{ t('Usaremos lo que ya tienes') }}</h3><p>{{ name(plan.installation) }}</p><p>{{ t('Se conservarán sus modelos y ajustes. Veltria abrirá un proceso propio cuando autorices la preparación.') }}</p></div></section>
        <section class="setup-image"><h3>{{ t('Una opción para empezar') }}</h3><p>{{ plan.profile.model }} · {{ plan.configuration.origin === 'included' ? t(plan.configuration.name) : plan.configuration.name }}</p><p>{{ t(plan.profile.description) }}</p><p class="helper">{{ t(plan.recommendation.reason) }}</p></section>
        <dl class="download-plan"><div><dt>{{ t('Descarga pendiente') }}</dt><dd>{{ bytes(plan.preparation.remainingBytes) }}</dd></div><div><dt>{{ t('Espacio necesario, con margen') }}</dt><dd>{{ bytes(plan.preparation.requiredBytes) }}</dd></div><div><dt>{{ t('Disponible en el disco') }}</dt><dd>{{ bytes(plan.preparation.availableBytes) }}</dd></div><div><dt>{{ t('Ya disponible para comprobar') }}</dt><dd>{{ bytes(plan.preparation.reuseBytes) }}</dd></div></dl>
        <p>{{ t('Al terminar, podrás crear con la descripción que ya escribiste. Preparar no genera una imagen.') }}</p>
        <details class="setup-technical"><summary>{{ t('Ver instalación, ubicación y cambios') }}</summary><p>{{ plan.configuration.steps }} {{ t('pasos') }} · CFG {{ plan.configuration.cfg }}</p><dl><div><dt>ComfyUI</dt><dd>{{ plan.installation.directory }}</dd></div><div><dt>Python</dt><dd>{{ plan.installation.python }}</dd></div><div><dt>{{ t('Archivo de destino') }}</dt><dd>{{ plan.preparation.destination }}</dd></div></dl><ul><li v-for="change in plan.preparation.changes" :key="change">{{ t(change) }}</li></ul><p>{{ t('Los archivos se han localizado; el arranque y la compatibilidad del entorno se comprobarán durante la preparación.') }}</p><a :href="plan.preparation.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a></details>
        <p v-for="blocker in plan.preparation.blockers" :key="blocker" class="warning">{{ t(blocker) }}</p>
        <p>{{ t('Licencia:') }} <a :href="plan.preparation.licenseUrl" target="_blank" rel="noreferrer">{{ t(plan.preparation.license) }}</a>{{ t(', con condiciones de uso.') }}</p>
        <label class="license-consent"><input v-model="consent" type="checkbox" :disabled="busy">{{ t('He revisado la licencia y autorizo reutilizar esta instalación y preparar los archivos indicados.') }}</label>
        <button class="primary-button full" :disabled="!canPrepare" @click="emit('prepare', plan.revision)"><Download v-if="plan.preparation.remainingBytes" :size="17"/><Check v-else :size="17"/>{{ busy ? t('Iniciando…') : plan.preparation.remainingBytes ? t('Descargar y preparar mi equipo') : t('Comprobar y preparar mi equipo') }}</button>
      </template>
      <p v-else-if="reviewing" role="status">{{ t('Comprobando la propuesta y el espacio disponible…') }}</p>
      <div v-if="!usable.length && state.status === 'complete'" class="setup-empty"><FolderOpen :size="30"/><h3>{{ t('Indica dónde está tu instalación') }}</h3><p>{{ t('Elige la carpeta de ComfyUI, su versión portable o Pinokio. Veltria buscará el entorno sin pedirte la ruta de Python.') }}</p><p>{{ t('Si aún no tienes una instalación compatible, su instalación desde Veltria sigue pendiente.') }}</p></div>
      <p v-if="planError" class="warning" role="alert">{{ t(planError) }}</p>
      <p v-if="error" class="warning" role="alert">{{ t(error) }}</p>
      <div class="action-row setup-search-actions"><button class="secondary-button" :disabled="busy || !connected" @click="chooseFolder"><FolderOpen :size="16"/>{{ t('Buscar en otra carpeta') }}</button><button class="text-button" :disabled="busy || !connected" @click="emit('scan')"><RefreshCw :size="16"/>{{ t('Volver a buscar') }}</button></div>
      <form v-if="manualFolder" class="setup-manual" @submit.prevent="emit('scan', directory.trim())"><label for="setup-folder">{{ t('Carpeta de la instalación en el equipo que ejecuta Veltria') }}</label><input id="setup-folder" v-model="directory" class="text-input" type="text" maxlength="1000" :disabled="busy" :placeholder="t('Pega la ubicación de la carpeta')"><button class="secondary-button" :disabled="busy || !connected || !directory.trim()">{{ t('Buscar en esta carpeta') }}</button><p>{{ t('En navegador, la ubicación corresponde al equipo del servicio. La app de escritorio ofrece un selector de carpetas.') }}</p></form>
      <details v-if="state.installations.some(item => !item.available)" class="setup-unavailable"><summary>{{ t('Otras instalaciones que requieren atención') }}</summary><div v-for="item in state.installations.filter(item => !item.available)" :key="item.id"><strong>{{ name(item) }}</strong><p>{{ t(item.reason) }}</p><small>{{ item.directory }}</small></div></details>
      <p v-for="note in state.notes" :key="note" class="helper">{{ t(note) }}</p>
      <p class="small-note">{{ t('La búsqueda revisa ubicaciones habituales y carpetas que elijas; no recorre todo el disco.') }}</p>
    </template>
  </dialog>
</template>
