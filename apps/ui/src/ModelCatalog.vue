<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Upload, ArrowRight, Layers3, Pause, Film } from '@lucide/vue'
import type { Catalog, CreationState, ImageConfiguration } from '@veltria/contracts'
import { bytes, t } from './i18n'
const props = defineProps<{ catalog: Catalog | null; state: CreationState | null; busy: boolean; connected: boolean }>()
const emit = defineEmits<{ select: [id: string, prepare: boolean]; import: [configuration: unknown]; pause: []; video: [] }>()
const selected = ref<Record<string, string>>({}), fileInput = ref<HTMLInputElement | null>(null), importError = ref(''), preview = ref<{ value: unknown; filename: string } | null>(null)
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
function install() { if (preview.value) { emit('import', preview.value.value); preview.value = null } }
</script>
<template>
  <div class="page-heading"><div><h1 tabindex="-1">{{ t('Modelos') }}</h1><p>{{ t('Elige qué quieres usar. Veltria prepara los archivos y los ajustes.') }}</p></div></div>
  <p v-if="!catalog" role="status">{{ connected ? t('Consultando el catálogo local…') : t('Conecta con el servicio para consultar los modelos.') }}</p>
  <template v-else>
    <section v-if="working && state" class="catalog-progress" aria-live="polite"><strong>{{ t(state.profile.title) }}</strong><p>{{ t(state.preparation.message) }}</p><progress :max="state.preparation.total" :value="state.preparation.status === 'downloading' ? state.preparation.received : undefined" :aria-label="t('Progreso de descarga')"></progress><div class="action-row"><span>{{ bytes(state.preparation.received) }} {{ t('de') }} {{ bytes(state.preparation.total) }}</span><button class="text-button" :disabled="busy || !connected" @click="emit('pause')"><Pause :size="16"/>{{ t('Pausar preparación') }}</button></div></section>
    <div class="catalog-intro"><h2>{{ t('Para crear imágenes') }}</h2><p>{{ t('El catálogo se puede consultar sin Internet. La descarga requiere conexión; los modelos preparados se usan localmente.') }}</p></div>
    <section class="model-list" :aria-label="t('Modelos de imagen')">
      <article v-for="item in catalog.models" :key="item.profile.id" class="model-row" :aria-label="t(item.profile.title)">
        <div class="model-description"><Layers3 :size="27" class="model-icon" aria-hidden="true"/><div><div class="model-heading"><h3>{{ item.profile.model }}</h3><span v-if="catalog.selectedModelId === item.profile.id" class="pill">{{ t('Seleccionado') }}</span></div><p>{{ t(item.profile.description) }}</p><small>{{ bytes(item.profile.bytes) }} · {{ item.profile.width }} {{ t('píxeles') }} · NVIDIA 4 GB / RAM 8 GB</small><p class="model-status">{{ { missing: t('Sin descargar'), partial: t('Descarga parcial'), downloaded: t('Descargado · falta comprobar'), prepared: t('Preparado para crear') }[item.status] }}<span v-if="item.status === 'partial'"> · {{ bytes(item.received) }}</span></p><p class="model-evidence">{{ item.recommendation.verified ? t('Comprobado en este equipo') : ['unknown', 'unsupported'].includes(item.recommendation.level) ? t('Compatibilidad por revisar') : t('Cumple los mínimos estimados · ejecución sin comprobar') }}</p></div></div>
        <div class="model-actions"><label :for="`configuration-${item.profile.id}`">{{ t('Configuración') }}</label><select :id="`configuration-${item.profile.id}`" class="text-input" :value="choice(item.profile.id)" :disabled="locked" @change="selected[item.profile.id] = ($event.target as HTMLSelectElement).value"><option v-for="entry in entries(item.profile.id)" :key="entry.id" :value="entry.id">{{ label(entry.id) }}{{ entry.origin === 'imported' ? ' · ' + t('Importada') : '' }}</option></select><small v-if="configuration(choice(item.profile.id))">{{ configuration(choice(item.profile.id))!.parameters.steps }} {{ t('pasos') }} · CFG {{ configuration(choice(item.profile.id))!.parameters.cfg }}</small><button class="primary-button" :disabled="locked" @click="emit('select', choice(item.profile.id), item.status !== 'prepared')"><Download v-if="item.status === 'missing' || item.status === 'partial'" :size="16"/><ArrowRight v-else :size="16"/>{{ item.status === 'prepared' ? t('Usar en Crear') : item.status === 'missing' ? t('Revisar descarga') : item.status === 'partial' ? t('Continuar preparación') : t('Comprobar y usar') }}</button><a :href="`/api/v1/catalog/configurations/${choice(item.profile.id)}`" class="text-button" download><Download :size="15"/>{{ t('Guardar configuración') }}</a></div>
        <details class="model-details"><summary>{{ t('Fuente, licencia y límites') }}</summary><p v-for="limitation in item.profile.limitations" :key="limitation">{{ t(limitation) }}</p><div class="action-row"><a :href="item.profile.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a><a :href="item.profile.licenseUrl" target="_blank" rel="noreferrer">{{ item.profile.license }}</a></div><p>{{ t('La descarga comprueba SHA-256. Preparado significa que los archivos y el motor están listos; comprobado requiere terminar una creación real.') }}</p></details>
      </article>
    </section>
    <section class="configuration-import" aria-labelledby="import-title"><div><h2 id="import-title">{{ t('Traer una configuración') }}</h2><p>{{ t('Un archivo pequeño con el modelo y sus ajustes. Si faltan los pesos, Veltria te pedirá revisar su descarga antes de crear.') }}</p><p class="small-note">{{ t('Admite JSON de Veltria para los modelos del catálogo. Workflows de ComfyUI, LoRA y modelos por URL: pendientes.') }}</p></div><input ref="fileInput" type="file" accept=".json,application/json" :aria-label="t('Archivo de configuración')" @change="readConfiguration"><button class="secondary-button" :disabled="busy || !connected" @click="fileInput?.click()"><Upload :size="16"/>{{ t('Elegir archivo JSON') }}</button><div v-if="preview" class="import-review"><p>{{ preview.filename }}</p><p>{{ t('Veltria validará el modelo, la receta y los límites de los ajustes antes de guardarla. No se descargarán pesos al importar.') }}</p><div class="action-row"><button class="primary-button" :disabled="busy || !connected" @click="install">{{ t('Importar configuración') }}</button><button class="text-button" @click="preview = null">{{ t('Cancelar') }}</button></div></div><p v-if="importError" class="warning" role="alert">{{ t(importError) }}</p></section>
    <section class="catalog-video"><Film :size="25" aria-hidden="true"/><div><h2>{{ t('Tu modelo de video') }}</h2><p>{{ t('Revisa y usa el MiniMax H3 existente desde Crear → Video. La descarga de sus componentes desde el catálogo sigue pendiente.') }}</p></div><button class="secondary-button" @click="emit('video')">{{ t('Abrir video') }}<ArrowRight :size="16"/></button></section>
  </template>
</template>
