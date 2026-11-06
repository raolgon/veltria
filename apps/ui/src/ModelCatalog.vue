<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { Download, Upload, ArrowRight, Layers3, Pause, Film } from '@lucide/vue'
import type { Catalog, CreationState, ImageConfiguration } from '@veltria/contracts'
import { verifiedChoice, localPriority, remotePriority, purpose, suitability, startingSize } from './catalog-guidance'
import DownloadManager from './DownloadManager.vue'
import { api } from './api'
import type { DiscoveryResult } from '@veltria/contracts'
import { bytes, t } from './i18n'
const props = defineProps<{ catalog: Catalog | null; state: CreationState | null; busy: boolean; connected: boolean }>()
const emit = defineEmits<{ select: [id: string, prepare: boolean]; import: [configuration: unknown]; pause: []; video: [] }>()
const selected = ref<Record<string, string>>({}), fileInput = ref<HTMLInputElement | null>(null), importError = ref(''), preview = ref<{ value: unknown; filename: string } | null>(null)
const storageOpen=ref(false)
function useStored(id:string){const modelId=props.catalog?.configurations.find(item=>item.id===id)?.configuration.modelId;emit('select',id,props.catalog?.models.find(item=>item.profile.id===modelId)?.status!=='prepared')}
const ordering = ref('recommended')
const loraStrength = ref(0.7), loraBase = ref('sd15-starter')
const query = ref(''), view = ref('team'), intent = ref(''), kind = ref('all'), searching = ref(false), searchError = ref(''), remote = ref<DiscoveryResult[] | null>(null), partial = ref(false)
const resultsHeading = ref<HTMLHeadingElement | null>(null)
const browsing = ref(false), nextCursor = ref<string | null>(null), browseKind = ref('all'), hardwareReason = ref<string | null>(null)
const discoveryState=computed(()=>{const recommendation=props.catalog?.models.find(item=>item.profile.id==='sd15-starter')?.recommendation;return recommendation?{recommendation}:props.state})
const remoteFiles = ref<Record<string, string>>({})
const intents = ['Fotografía', 'Ilustración', 'Anime', 'Personajes']
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
const visibleModels = computed(() => (props.catalog?.models || []).filter(item => {
  if (kind.value === 'lora' && !item.profile.adaptation || kind.value === 'model' && item.profile.adaptation) return false
  if (view.value === 'downloaded' && !['downloaded', 'prepared'].includes(item.status)) return false
  if (view.value === 'team' && ['unknown', 'unsupported'].includes(item.recommendation.level)) return false
  const terms = normalize(query.value).split(/\s+/).filter(Boolean)
  const text = normalize([item.profile.model, item.profile.description, t(item.profile.description), ...entries(item.profile.id).map(entry => entry.configuration.name), item.profile.id === 'dreamshaper-8' ? 'ilustración illustration anime personajes character' : item.profile.id === 'sd15-starter' ? 'fotografía photography realistic retratos portrait' : ''].join(' '))
  return terms.every(term => text.includes(term))
}).sort((a,b) => ordering.value === 'recommended' && props.catalog ? localPriority(a, choice(a.profile.id), props.catalog) - localPriority(b, choice(b.profile.id), props.catalog) : 0))
function remoteState(item:DiscoveryResult){const model=props.catalog?.models.find(model=>model.profile.source===item.source && !model.profile.adaptation);return model?{recommendation:model.recommendation}:discoveryState.value}
function remoteSize(item:DiscoveryResult){return props.catalog?.models.find(model=>model.profile.source===item.source && !model.profile.adaptation)?.profile.width||512}
const visibleRemote = computed(() => (remote.value || []).filter(item => (kind.value === 'all' || kind.value === item.kind) && (view.value !== 'team' || item.supported && !!remoteState(item) && ['recommended', 'limited'].includes(remoteState(item)!.recommendation.level))).sort((a,b) => (ordering.value === 'recommended' ? remotePriority(a, props.catalog) - remotePriority(b, props.catalog) : 0) || (b.downloads ?? -1) - (a.downloads ?? -1)))
async function searchOnline() {
  if (searching.value) return
  browsing.value = false; nextCursor.value = null; hardwareReason.value = null
  searching.value = true; searchError.value = ''; remote.value = null
  try { const result = await api.discover(query.value || intent.value, kind.value); remote.value = result.results; partial.value = result.partial }
  catch (error) { searchError.value = error instanceof Error ? error.message : String(error) }
  finally { searching.value = false }
}
async function browse(more = false) {
  if (searching.value) return
  searching.value = true; searchError.value = ''; hardwareReason.value = null
  if (!more) { browseKind.value = kind.value; remote.value = null; nextCursor.value = null; query.value = ''; intent.value = ''; view.value = 'team' }
  browsing.value = true
  try {
    const result = await api.browseCompatible(browseKind.value, more ? nextCursor.value || undefined : undefined)
    const items = new Map((more ? remote.value || [] : []).map(item => [item.repository, item]))
    for (const item of result.results) items.set(item.repository, item)
    remote.value = [...items.values()].sort((a,b) => (b.downloads ?? -1) - (a.downloads ?? -1))
    nextCursor.value = result.nextCursor || null; partial.value = result.partial; hardwareReason.value = result.hardwareReason || null
    await nextTick(); if (!more) resultsHeading.value?.focus()
  } catch (error) { searchError.value = error instanceof Error ? error.message : String(error) }
  finally { searching.value = false }
}
async function adopt(item: DiscoveryResult) {
  searching.value = true; searchError.value = ''
  try { const entry = await api.adoptModel(item.repository, remoteFiles.value[item.repository] || item.files[0].name, loraStrength.value, loraBase.value); emit('select', entry.id, true) }
  catch (error) { searchError.value = error instanceof Error ? error.message : String(error) }
  finally { searching.value = false }
}
function chooseIntent(value: string) { intent.value = value; query.value = t(value); remote.value = null }
const locked = computed(() => props.busy || !props.connected || props.catalog?.busy)
const working = computed(() => props.state && ['downloading', 'verifying', 'starting'].includes(props.state.preparation.status))
function entries(modelId: string) { return props.catalog?.configurations.filter(entry => entry.configuration.modelId === modelId) || [] }
function choice(modelId: string) { return selected.value[modelId] || (props.catalog?.selectedModelId === modelId ? props.catalog.selectedConfigurationId : entries(modelId)[0]?.id) || '' }
function label(id: string) { const entry = props.catalog?.configurations.find(item => item.id === id); return entry ? entry.origin === 'included' ? t(entry.configuration.name) : entry.configuration.name : '' }
function configuration(id: string): ImageConfiguration | undefined { return props.catalog?.configurations.find(item => item.id === id)?.configuration }
async function readConfiguration(event: Event) {
  importError.value = ''; preview.value = null
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return
  try {
    if (file.size > 32768) throw new Error('La configuración supera el límite de 32 KiB.')
    preview.value = { filename: file.name, value: JSON.parse(await file.text()) }
  } catch { importError.value = file.size > 32768 ? 'La configuración supera el límite de 32 KiB.' : 'No se pudo leer ese JSON. Elige una configuración exportada por Veltria.' }
  finally { input.value = '' }
}
const suggested = computed(() => visibleModels.value.find(item => ['recommended','limited'].includes(item.recommendation.level)))
function install() { if (preview.value) { emit('import', preview.value.value); preview.value = null } }
</script>
<template>
  <div class="page-heading"><div><h1 tabindex="-1">{{ t('Modelos') }}</h1><p>{{ t('Elige qué quieres usar. Veltria prepara los archivos y los ajustes.') }}</p></div></div>
  <p v-if="!catalog" role="status">{{ connected ? t('Consultando el catálogo local…') : t('Conecta con el servicio para consultar los modelos.') }}</p>
  <template v-else>
    <div class="storage-toggle"><button class="secondary-button" @click="storageOpen=!storageOpen">{{ storageOpen?t('Volver al catálogo'):t('Gestionar descargas') }}</button></div>
    <DownloadManager v-if="storageOpen" :connected="connected" :busy="busy" :selected-configuration-id="catalog.selectedConfigurationId" @use="useStored"/>
    <div v-show="!storageOpen">
    <section v-if="working && state" class="catalog-progress" aria-live="polite"><strong>{{ t(state.profile.title) }}</strong><p>{{ t(state.preparation.message) }}</p><progress :max="state.preparation.total" :value="state.preparation.status === 'downloading' ? state.preparation.received : undefined" :aria-label="t('Progreso de descarga')"></progress><div class="action-row"><span>{{ bytes(state.preparation.received) }} {{ t('de') }} {{ bytes(state.preparation.total) }}</span><button class="text-button" :disabled="busy || !connected" @click="emit('pause')"><Pause :size="16"/>{{ t('Pausar preparación') }}</button></div></section>
    <div class="catalog-intro"><h2>{{ t('Para crear imágenes') }}</h2><p>{{ t('El catálogo se puede consultar sin Internet. La descarga requiere conexión; los modelos preparados se usan localmente.') }}</p></div>
    <section class="discovery-search" :aria-label="t('Buscar modelos')">
      <label for="model-search">{{ t('¿Qué quieres crear?') }}</label>
      <form class="discovery-form" @submit.prevent="searchOnline"><input id="model-search" v-model="query" type="search" :disabled="searching" maxlength="100" class="text-input" :placeholder="t('Buscar modelos, estilos o efectos')"><button class="primary-button" :disabled="searching || !connected">{{ searching ? t('Buscando…') : t('Buscar en Internet') }}</button></form>
      <div class="discovery-tabs"><button v-for="value in intents" :key="value" class="text-button" :aria-pressed="intent === value" @click="chooseIntent(value)">{{ t(value) }}</button></div>
      <div class="discovery-tabs"><button v-for="tab in [{ id: 'team', label: 'Para mi equipo' }, { id: 'all', label: 'Explorar todo' }, { id: 'downloaded', label: 'Descargados' }]" :key="tab.id" class="secondary-button" :aria-pressed="view === tab.id" @click="view = tab.id">{{ t(tab.label) }}</button></div>
      <div class="compatible-browse"><button class="primary-button" :disabled="searching || !connected" @click="browse()">{{ t('Ver modelos para mi equipo') }}</button><p>{{ t('Sin escribir una búsqueda. Opciones que Veltria puede preparar, con los más descargados primero.') }}</p></div>
      <label for="catalog-order">{{ t('Ordenar por') }}</label><select id="catalog-order" v-model="ordering" class="text-input"><option value="recommended">{{ t('Recomendación de Veltria') }}</option><option value="popular">{{ t('Popularidad') }}</option></select>
      <details><summary>{{ t('Más filtros') }}</summary><label for="model-kind">{{ t('Tipo de componente') }}</label><select id="model-kind" v-model="kind" :disabled="searching" class="text-input"><option value="all">{{ t('Modelos y adaptaciones') }}</option><option value="model">{{ t('Modelos y finetunes') }}</option><option value="lora">{{ t('Adaptaciones (LoRA)') }}</option></select><p>{{ t('La búsqueda externa consulta Hugging Face al pulsar Buscar. No envía tus descripciones ni datos del equipo.') }}</p></details>
      <p v-if="searchError" role="alert" class="warning">{{ t(searchError) }}</p>
    </section>
    <section v-if="suggested && ordering === 'recommended'" class="catalog-guidance" :aria-label="t('Tu punto de partida')"><h2>{{ t('Tu punto de partida') }}: {{ suggested.profile.model }}</h2><p>{{ t('Priorizamos lo comprobado con los ajustes elegidos y lo que ya tienes preparado. No es una comparación de calidad entre modelos.') }}</p><p>{{ t(suggested.recommendation.reason) }}</p><button class="primary-button" :disabled="locked" @click="emit('select', choice(suggested.profile.id), suggested.status !== 'prepared')">{{ t('Usar esta propuesta') }}</button></section>
    <p v-else-if="state && ordering === 'recommended'" role="status">{{ t(state.recommendation.reason) }}</p>
    <p v-if="!visibleModels.length" role="status">{{ t('No hay coincidencias en tu catálogo. Prueba otra búsqueda o explora todo.') }}</p>
    <section class="model-list" :aria-label="t('Modelos de imagen')">
      <article v-for="item in visibleModels" :key="item.profile.id" class="model-row" :aria-label="t(item.profile.title)">
        <div class="model-description"><figure v-if="['sd15-starter', 'dreamshaper-8', 'sdxl-base'].includes(item.profile.id)" class="catalog-example"><img :src="`/catalog/${item.profile.id}.png`" :alt="t('Ejemplo real con la configuración Equilibrada')" width="512" height="512" loading="lazy"><figcaption>{{ t('Ejemplo real · Equilibrada') }}</figcaption></figure><Layers3 v-else :size="27" class="model-icon" aria-hidden="true"/><div><div class="model-heading"><h3>{{ item.profile.model }}</h3><span v-if="catalog.selectedModelId === item.profile.id" class="pill">{{ t('Seleccionado') }}</span></div><p>{{ t(purpose(item.profile.id, !!item.profile.adaptation)) }}</p><p class="model-evidence">{{ t(item.profile.description) }}</p><small>{{ t('Descarga pendiente') }}: {{ bytes(item.remainingBytes ?? Math.max(0, item.profile.bytes - item.received)) }} · {{ item.profile.width }} {{ t('píxeles') }} · {{ item.profile.family==='sdxl'?'NVIDIA 6 GB / RAM 16 GB':'NVIDIA 4 GB / RAM 8 GB' }}</small><p class="model-status">{{ { missing: t('Sin descargar'), partial: t('Descarga parcial'), downloaded: t('Descargado · falta comprobar'), prepared: t('Preparado para crear') }[item.status] }}<span v-if="item.status === 'partial'"> · {{ bytes(item.received) }}</span></p><p class="model-evidence">{{ verifiedChoice(item, choice(item.profile.id), catalog) ? t('Comprobado con los ajustes elegidos') : ['unknown', 'unsupported'].includes(item.recommendation.level) ? t('Compatibilidad por revisar') : t('Cumple los mínimos estimados · ejecución sin comprobar') }}</p></div></div>
        <div class="model-actions"><p class="starting-settings">{{ t('Punto de partida') }}: {{ startingSize(configuration(choice(item.profile.id))?.parameters.format,item.profile.family).join(' × ') }} · {{ label(choice(item.profile.id)) }}</p><label :for="`configuration-${item.profile.id}`">{{ t('Configuración') }}</label><select :id="`configuration-${item.profile.id}`" class="text-input" :value="choice(item.profile.id)" :disabled="locked" @change="selected[item.profile.id] = ($event.target as HTMLSelectElement).value"><option v-for="entry in entries(item.profile.id)" :key="entry.id" :value="entry.id">{{ label(entry.id) }}{{ entry.origin === 'imported' ? ' · ' + t('Importada') : '' }}</option></select><small v-if="configuration(choice(item.profile.id))">{{ configuration(choice(item.profile.id))!.parameters.steps }} {{ t('pasos') }} · CFG {{ configuration(choice(item.profile.id))!.parameters.cfg }}</small><button class="primary-button" :disabled="locked" @click="emit('select', choice(item.profile.id), item.status !== 'prepared')"><Download v-if="item.status === 'missing' || item.status === 'partial'" :size="16"/><ArrowRight v-else :size="16"/>{{ item.status === 'prepared' ? t('Usar en Crear') : item.status === 'missing' ? t('Revisar descarga') : item.status === 'partial' ? t('Continuar preparación') : t('Comprobar y usar') }}</button><a :href="`/api/v1/catalog/configurations/${choice(item.profile.id)}`" class="text-button" download><Download :size="15"/>{{ t('Guardar configuración') }}</a></div>
        <details class="model-details"><summary>{{ t('Detalles técnicos') }}</summary><p>{{ item.profile.model }} · {{ item.profile.family==='sdxl'?'SDXL · 768 × 768 · lowvram':t('Familia SD 1.5 · receta de imagen a 512 píxeles') }}</p><p>{{ t(item.recommendation.reason) }}</p><p v-for="limitation in item.profile.limitations" :key="limitation">{{ t(limitation) }}</p><div class="action-row"><a :href="item.profile.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a><a :href="item.profile.licenseUrl" target="_blank" rel="noreferrer">{{ item.profile.license }}</a></div><p>{{ t('La descarga comprueba SHA-256. Preparado significa que los archivos y el motor están listos; comprobado requiere terminar una creación real.') }}</p></details>
      </article>
    </section>
    <section v-if="remote !== null && view !== 'downloaded'" class="discovery-results" :aria-label="t('Resultados de Internet')"><h2 ref="resultsHeading" tabindex="-1">{{ browsing ? t('Modelos para tu equipo') : t('Resultados de Internet') }}</h2><p v-if="browsing">{{ ordering === 'popular' ? t('Ordenados por descargas en Hugging Face. La compatibilidad es estimada hasta crear una imagen en este equipo.') : t('Primero las opciones que ya puedes reutilizar; después, por descargas. La primera creación comprobará los ajustes en tu equipo.') }}</p><p v-if="hardwareReason" role="status">{{ t(hardwareReason) }}</p><p v-if="partial" role="status">{{ t('Algunos resultados no se pudieron comprobar. Puedes volver a buscar.') }}</p><p v-if="!visibleRemote.length" role="status">{{ t('No hay resultados compatibles con estos filtros. Explora todo para ver otras opciones.') }}</p><article v-for="item in visibleRemote" :key="item.repository" class="model-row"><div><h3>{{ item.repository.split('/')[1] }}</h3><p>{{ t(purpose('', item.kind === 'lora')) }}</p><p>{{ t(item.supported ? suitability(remoteState(item)) : 'Compatibilidad por revisar') }}</p><p>{{ t(item.reason) }}</p><p v-if="item.downloads != null">{{ item.downloads.toLocaleString() }} {{ t('descargas en Hugging Face') }}</p><small>{{ item.family }} · {{ t('Sin comprobar en este equipo') }}</small></div><div class="model-actions"><p>{{ t('Punto de partida') }}: {{ remoteSize(item) }} × {{ remoteSize(item) }} · {{ t('Equilibrada') }}</p><p v-if="item.kind === 'lora'">{{ t('Necesita un modelo base compatible. El plan reúne ambos componentes y muestra la descarga pendiente real.') }}</p><p v-if="item.files.length">{{ t('Archivo elegido') }}: {{ bytes(item.files.find(file => file.name === remoteFiles[item.repository])?.bytes ?? item.files[0].bytes) }}</p><button v-if="item.supported" class="primary-button" :disabled="locked || searching" @click="adopt(item)">{{ t('Preparar y usar') }}</button><p v-else>{{ t('Soporte de esta receta pendiente') }}</p></div><details class="model-details"><summary>{{ t('Detalles técnicos') }}</summary><p>{{ item.repository }} · {{ item.revision }}</p><label :for="'file-' + item.repository">{{ t('Variante de descarga') }}</label><select v-if="item.files.length" :id="'file-' + item.repository" v-model="remoteFiles[item.repository]" class="text-input"><option :value="undefined">{{ item.files[0].name }} · {{ bytes(item.files[0].bytes) }}</option><option v-for="file in item.files.slice(1)" :key="file.name" :value="file.name">{{ file.name }} · {{ bytes(file.bytes) }}</option></select><p>{{ item.kind === 'lora' ? t('Usa SD 1.5 como base e intensidad inicial 0,7. El plan incluye ambos componentes si faltan.') : t('Se proponen ajustes iniciales de 512 píxeles. La compatibilidad procede de metadatos; se comprobará al crear.') }}</p><div v-if="item.kind === 'lora'"><label :for="'strength-' + item.repository">{{ t('Intensidad de la adaptación') }}: {{ loraStrength }}</label><input :id="'strength-' + item.repository" v-model.number="loraStrength" type="range" min="0" max="1.5" step="0.05"><label :for="'base-' + item.repository">{{ t('Modelo base') }}</label><select :id="'base-' + item.repository" v-model="loraBase" class="text-input"><option v-for="base in catalog.models.filter(model => !model.profile.adaptation && model.profile.family!=='sdxl')" :key="base.profile.id" :value="base.profile.id">{{ base.profile.model }}</option></select></div><a :href="item.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a></details></article><button v-if="browsing && nextCursor" class="secondary-button" :disabled="searching || !connected" @click="browse(true)">{{ searching ? t('Buscando…') : t('Ver más modelos') }}</button><p v-if="browsing && nextCursor">{{ t('Puedes seguir explorando aunque esta página no tenga coincidencias compatibles.') }}</p></section>
    <section class="configuration-import" aria-labelledby="import-title"><div><h2 id="import-title">{{ t('Traer una configuración') }}</h2><p>{{ t('Un archivo pequeño con el modelo y sus ajustes. Si faltan los pesos, Veltria te pedirá revisar su descarga antes de crear.') }}</p><p class="small-note">{{ t('Admite JSON de Veltria para los modelos del catálogo. Las adaptaciones se preparan desde la búsqueda; los workflows externos siguen pendientes.') }}</p></div><input ref="fileInput" type="file" accept=".json,application/json" :aria-label="t('Archivo de configuración')" @change="readConfiguration"><button class="secondary-button" :disabled="busy || !connected" @click="fileInput?.click()"><Upload :size="16"/>{{ t('Elegir archivo JSON') }}</button><div v-if="preview" class="import-review"><p>{{ preview.filename }}</p><p>{{ t('Veltria validará el modelo, la receta y los límites de los ajustes antes de guardarla. No se descargarán pesos al importar.') }}</p><div class="action-row"><button class="primary-button" :disabled="busy || !connected" @click="install">{{ t('Importar configuración') }}</button><button class="text-button" @click="preview = null">{{ t('Cancelar') }}</button></div></div><p v-if="importError" class="warning" role="alert">{{ t(importError) }}</p></section>
    <section class="catalog-video"><Film :size="25" aria-hidden="true"/><div><h2>{{ t('Tu modelo de video') }}</h2><p>{{ t('Revisa y usa el MiniMax H3 existente desde Crear → Video. La descarga de sus componentes desde el catálogo sigue pendiente.') }}</p></div><button class="secondary-button" @click="emit('video')">{{ t('Abrir video') }}<ArrowRight :size="16"/></button></section>
    </div>
  </template>
</template>
