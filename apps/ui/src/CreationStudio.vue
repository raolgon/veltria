<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Sparkles, Monitor, Check, Download, Pause, ArrowRight, RefreshCw, X, Info, Image as ImageIcon } from '@lucide/vue'
import type { CreationState, PreparationPlan, ImageJob, ImageQuality } from '@veltria/contracts'
import { bytes, t, date } from './i18n'
import { validImageQuality, profileDimensions, reduceImageQuality } from '@veltria/core'
import ImageQualityControls from './ImageQualityControls.vue'
import IdeaArt from './IdeaArt.vue'
const props = defineProps<{ state: CreationState | null; plan: PreparationPlan | null; job: ImageJob | null; prompt: string; quality: ImageQuality | null; format: 'square' | 'landscape' | 'portrait'; connected: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ 'update:quality': [value: ImageQuality | null]; 'update:prompt': [value: string]; 'update:format': [value: 'square' | 'landscape' | 'portrait']; plan: []; prepare: []; resume: []; pause: []; create: []; cancel: [id: string]; reconcile: [id: string]; closePlan: []; modelsDirectory: [path: string]; device: []; models: []; setup: [] }>()
const dialog = ref<HTMLDialogElement | null>(null), consent = ref(false), location = ref(''), recoveryNotice = ref('')
const preparing = computed(() => !!props.state && ['downloading', 'verifying', 'starting'].includes(props.state.preparation.status))
const activeJob = computed(() => !!props.job && ['queued', 'submitting', 'running', 'saving'].includes(props.job.status))
const image = computed(() => props.job?.imageId ? `/api/v1/artifacts/${props.job.imageId}` : null)
const validQuality = computed(() => !props.quality || validImageQuality(props.quality, props.state?.profile))
const verifiedQuality = computed(() => {
  if (!props.state?.recommendation.verified) return false
  const evidence = props.state.recommendation.evidenceDetails
  const [width, height] = profileDimensions(props.format, props.state.profile)
  const quality = props.quality ?? { width, height, steps: props.state.configuration.steps, cfg: props.state.configuration.cfg }
  return !!evidence && evidence.width === quality.width && evidence.height === quality.height && quality.steps === props.state.configuration.steps && quality.cfg === props.state.configuration.cfg
})
const reducedQuality = computed(() => {
  if (!props.job || props.job.status !== 'failed' || props.job.failure?.kind !== 'memory' || !props.state) return null
  return reduceImageQuality(props.job, props.state.profile, props.state.configuration.steps, props.state.configuration.cfg)
})
const reducedApplied = computed(() => {
  if (!reducedQuality.value || !props.state) return false
  const [width, height] = profileDimensions(props.format, props.state.profile)
  const effective = props.quality ?? { width, height, steps: props.state.configuration.steps, cfg: props.state.configuration.cfg }
  return effective.width === reducedQuality.value.width && effective.height === reducedQuality.value.height && effective.steps === reducedQuality.value.steps && effective.cfg === reducedQuality.value.cfg
})
function applyReducedQuality() {
  if (!reducedQuality.value || !props.job || !props.state) return
  if (props.job.prompt) emit('update:prompt', props.job.prompt)
  emit('update:format', props.job.format)
  const [startWidth, startHeight] = profileDimensions(props.job.format, props.state.profile)
  const isDefault = reducedQuality.value.width === startWidth && reducedQuality.value.height === startHeight && reducedQuality.value.steps === props.state.configuration.steps && reducedQuality.value.cfg === props.state.configuration.cfg
  emit('update:quality', isDefault ? null : { ...reducedQuality.value })
  recoveryNotice.value = 'Ajustes reducidos listos para revisar. Pulsa Crear imagen cuando quieras volver a intentarlo.'
}
watch(() => props.job?.id, () => { recoveryNotice.value = '' })
const canCreate = computed(() => validQuality.value && props.connected && props.state?.canCreate && !preparing.value && !props.busy && !activeJob.value && !!props.prompt.trim())
const mainLabel = computed(() => activeJob.value ? t('Creación en curso') : preparing.value ? t('Preparando tu perfil…') : props.state?.canCreate ? t('Crear imagen') : !props.state?.bound ? t('Preparar mi equipo') : ['paused', 'error'].includes(props.state?.preparation.status || '') ? t('Continuar preparación') : t('Preparar para crear'))
function action() {
  if (!props.state?.bound) emit('setup')
  else if (props.state?.canCreate) emit('create')
  else if (['paused', 'error'].includes(props.state?.preparation.status || '') && props.state?.preparation.revision) emit('resume')
  else emit('plan')
}
watch(() => props.plan, async plan => {
  if (plan) { consent.value = false; location.value = plan.destination.replace(/[\\/]checkpoints[\\/][^\\/]+$/, ''); await nextTick(); if (!dialog.value?.open) dialog.value?.showModal() }
  else dialog.value?.close()
})
</script>

<template>
  <div class="page-heading"><div><h1 tabindex="-1">{{ t('¿Qué vas a imaginar hoy?') }}</h1><p>{{ t('Tú pones la idea. Kobocraft prepara lo necesario.') }}</p></div><span class="private-badge">{{ t('Imágenes en tu PC') }}</span></div>
  <div class="studio-grid first-image-studio">
    <section class="creation-panel" :aria-label="t('Tu idea y su resultado')">
      <div class="canvas-header"><span>{{ image ? t('TU IMAGEN') : t('UN ESPACIO PARA TU IDEA') }}</span><span>{{ job ? `${job.width} × ${job.height}` : t('PRIMERA IMAGEN') }}</span></div>
      <div class="canvas" :class="{ 'result-canvas': image }">
        <img v-if="image" :src="image" :alt="job?.prompt.slice(0, 180) || t('Imagen creada con Kobocraft')" class="generated-image">
        <template v-else><IdeaArt/><div class="canvas-copy"><h2>{{ activeJob ? t('Tu idea está tomando forma.') : t('Todo empieza con una idea.') }}</h2><p>{{ activeJob ? t('El resultado aparecerá aquí cuando termine el motor.') : t('Describe tu imagen y prepara tu primera creación.') }}</p></div><div class="canvas-bottom"><span>{{ t('Ilustración de bienvenida · no es un resultado generado') }}</span></div></template>
      </div>
      <div v-if="job" class="creation-feedback" aria-live="polite">
        <span v-if="job.status === 'failed' && job.failure" class="pill">{{ t({ memory: 'Memoria insuficiente', incompatible: 'Ajustes o modelo incompatibles', 'engine-unavailable': 'Motor no disponible', execution: 'Fallo de ejecución del motor' }[job.failure.kind]) }}</span>
        <strong>{{ t(job.message) }}</strong>
        <progress v-if="activeJob" :max="job.steps" :value="job.step ?? undefined" :aria-label="t('Progreso de creación')"></progress>
        <div v-if="job.status === 'failed'" class="recovery-guide">
          <p v-if="reducedQuality">{{ t('Propuesta para reducir el uso de memoria: {0} × {1} px · {2} pasos · CFG {3} (intento fallido: {4} × {5} px · {6} pasos).', { 0: reducedQuality.width, 1: reducedQuality.height, 2: reducedQuality.steps, 3: reducedQuality.cfg, 4: job.width, 5: job.height, 6: job.steps }) }}</p>
          <p v-if="recoveryNotice" role="status" class="helper">{{ t(recoveryNotice) }}</p>
          <div class="action-row">
            <button v-if="reducedQuality && !reducedApplied" class="secondary-button" :disabled="busy" @click="applyReducedQuality">{{ t('Usar {0} × {1} px ({2} pasos)', { 0: reducedQuality.width, 1: reducedQuality.height, 2: reducedQuality.steps }) }}</button>
            <button v-if="job.failure?.kind === 'memory' || job.failure?.kind === 'incompatible'" class="secondary-button" :disabled="busy" @click="emit('models')">{{ t('Elegir otro modelo') }}</button>
            <button v-if="job.failure?.kind === 'engine-unavailable'" class="secondary-button" :disabled="busy" @click="emit('device')">{{ t('Revisar motor en Mi equipo') }}</button>
          </div>
          <details class="failure-details">
            <summary>{{ t('Ajustes y diagnóstico de este intento') }}</summary>
            <p>{{ t('Intento original') }}: {{ job.width }} × {{ job.height }} px · {{ job.steps }} {{ t('pasos') }} · CFG {{ job.cfg ?? 7 }} · {{ t('Semilla') }} {{ job.seed }}</p>
            <p v-if="job.failure?.node">{{ t('Nodo del motor') }}: {{ job.failure.node }}</p>
            <pre v-if="job.failure?.detail" class="failure-trace">{{ job.failure.detail }}</pre>
          </details>
        </div>
        <div class="action-row"><a v-if="image" :href="image + '?download=1'" class="primary-button" download><Download :size="16"/>{{ t('Guardar imagen') }}</a><button v-if="activeJob && !['submitting', 'saving'].includes(job.status)" class="text-button" :disabled="busy" @click="emit('cancel', job.id)">{{ t('Cancelar esta creación') }}</button><button v-if="job.status === 'interrupted' && job.enginePromptId" class="text-button" :disabled="busy" @click="emit('reconcile', job.id)">{{ t('Comprobar si terminó') }}</button></div>
      </div>
      <div class="prompt-section"><label for="prompt"><Sparkles :size="17"/>{{ t('Describe lo que imaginas') }}</label><textarea id="prompt" :value="prompt" maxlength="4000" :placeholder="t('Un lugar, una escena, algo que todavía no existe…')" @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"></textarea><div class="prompt-bottom"><span>{{ t('Tu descripción se conserva durante la preparación.') }}</span><span>{{ prompt.length }} / 4000</span></div></div>
    </section>
    <aside class="creation-settings" :aria-label="t('Perfil para tu equipo')">
      <div class="section-heading"><h2>{{ t('Tu punto de partida') }}</h2></div>
      <template v-if="state">
        <div class="profile-card"><span class="profile-emblem"><Monitor :size="24"/></span><div><span class="recommendation">{{ verifiedQuality ? t('Comprobado en este equipo') : state.recommendation.level === 'recommended' ? t('Recomendado para empezar') : t('Compatibilidad por revisar') }}</span><strong>{{ t(state.profile.title) }}</strong></div></div>
        <p class="helper configuration-summary">{{ state.configuration.origin === 'included' ? t(state.configuration.name) : state.configuration.name }} · {{ state.configuration.steps }} {{ t('pasos') }} · CFG {{ state.configuration.cfg }}<button class="text-button" :disabled="busy || preparing || activeJob" @click="emit('models')">{{ t('Cambiar modelo o configuración') }}</button></p>
        <p class="helper">{{ t(state.recommendation.reason) }}</p><p v-if="state.recommendation.evidence" class="helper evidence-note">{{ state.recommendation.evidenceDetails ? t('Primera creación comprobada en este equipo: {0} × {1}, {2}.', { 0: state.recommendation.evidenceDetails.width, 1: state.recommendation.evidenceDetails.height, 2: date(state.recommendation.evidenceDetails.at) }) : t(state.recommendation.evidence) }}</p>
        <button v-if="state.bound" class="text-button" :disabled="busy || preparing || activeJob" @click="emit('setup')">{{ t('Revisar instalación') }}</button>
        <div class="option-section"><h2>{{ t('Formato') }}</h2><div class="format-options"><button v-for="option in (['square', 'landscape', 'portrait'] as const)" :key="option" :class="{ selected: format === option }" :aria-pressed="format === option" :disabled="busy || preparing || activeJob" @click="emit('update:format', option)"><span :class="['aspect', { square: option === 'square', tall: option === 'portrait' }]"></span>{{ { square: t('Cuadrado'), landscape: t('Horizontal'), portrait: t('Vertical') }[option] }}</button></div></div>
        <ImageQualityControls :state="state" :format="format" :quality="quality" :locked="busy || preparing || activeJob || !connected" @update:quality="emit('update:quality', $event)"/>
        <details class="profile-details"><summary>{{ t('Modelo y límites de este perfil') }}</summary><p>{{ state.profile.model }} · {{ state.profile.width }} × {{ state.profile.height }} {{ t('como ajuste inicial.') }}</p><p v-for="limitation in state.profile.limitations" :key="limitation">{{ t(limitation) }}</p><a :href="state.profile.source" target="_blank" rel="noreferrer">{{ t('Ver fuente del modelo') }}</a></details>
        <section v-if="state.preparation.status !== 'idle'" class="preparation-feedback" aria-live="polite"><strong>{{ t(state.preparation.message) }}</strong><template v-if="state.preparation.status === 'downloading'"><progress :max="state.preparation.total" :value="state.preparation.received" :aria-label="t('Progreso de descarga')"></progress><span>{{ bytes(state.preparation.received) }} {{ t('de') }} {{ bytes(state.preparation.total) }}</span></template><progress v-else-if="preparing" :aria-label="t('Preparando el perfil')"></progress><button v-if="preparing" class="text-button" :disabled="busy" @click="emit('pause')"><Pause :size="16"/>{{ t('Pausar preparación') }}</button></section>
      </template>
      <p v-else class="helper">{{ connected ? t('Consultando el perfil y los recursos del equipo…') : t('Conecta con el servicio para consultar tu equipo y preparar un perfil.') }}</p>
      <div class="prepare-action studio-main-action"><button class="primary-button full" :disabled="!connected || !state || busy || preparing || activeJob || (state?.canCreate && !canCreate)" @click="action"><Sparkles :size="17"/>{{ mainLabel }}</button><p v-if="state?.canCreate && !prompt.trim()">{{ t('Escribe una descripción para crear.') }}</p><p v-else>{{ t('Preparar el perfil no inicia una generación.') }}</p></div>
    </aside>
  </div>
  <div class="creation-mobile-action"><button class="primary-button" :disabled="!connected || !state || busy || preparing || activeJob || (state?.canCreate && !canCreate)" @click="action">{{ mainLabel }}</button></div>
  <dialog ref="dialog" class="preparation-dialog" aria-labelledby="plan-title" @cancel="emit('closePlan')" @close="emit('closePlan')">
    <template v-if="plan"><button class="icon-button plan-close" :aria-label="t('Cerrar plan de preparación')" @click="emit('closePlan')"><X :size="22"/></button><h2 id="plan-title">{{ t('Preparar tu primera imagen') }}</h2><p v-if="state"><strong>{{ state.profile.model }}</strong> · {{ state.configuration.origin === 'included' ? t(state.configuration.name) : state.configuration.name }} · {{ state.configuration.steps }} {{ t('pasos') }}</p><p>{{ t('Kobocraft descargará y comprobará el perfil completo. Tu descripción se conserva.') }}</p><dl class="download-plan"><div><dt>{{ t('Descarga pendiente') }}</dt><dd>{{ bytes(plan.remainingBytes) }}</dd></div><div><dt>{{ t('Espacio necesario, con margen') }}</dt><dd>{{ bytes(plan.requiredBytes) }}</dd></div><div><dt>{{ t('Disponible en el disco') }}</dt><dd>{{ bytes(plan.availableBytes) }}</dd></div><div><dt>{{ t('Ya disponible para comprobar') }}</dt><dd>{{ bytes(plan.reuseBytes) }}</dd></div><div class="plan-location"><dt>{{ t('Archivo de destino') }}</dt><dd>{{ plan.destination }}</dd></div></dl><details><summary>{{ t('Cambiar ubicación de los modelos') }}</summary><label for="models-location">{{ t('Carpeta para los modelos de Kobocraft') }}</label><input id="models-location" v-model="location" class="text-input" type="text" maxlength="1000"><button class="secondary-button" :disabled="busy || !location.trim()" @click="emit('modelsDirectory', location.trim())">{{ t('Comprobar esta ubicación') }}</button></details><ul class="plan-changes"><li v-for="change in plan.changes" :key="change">{{ t(change) }}</li></ul><p v-for="blocker in plan.blockers" :key="blocker" class="warning">{{ t(blocker) }}</p><p v-if="error" class="warning" role="alert">{{ t(error) }}</p><p>{{ t('Licencia:') }} <a :href="plan.licenseUrl" target="_blank" rel="noreferrer">{{ plan.license }}</a>{{ t(', con condiciones de uso.') }} <a :href="plan.source" target="_blank" rel="noreferrer">{{ t('Fuente del archivo') }}</a>.</p><label class="license-consent"><input v-model="consent" type="checkbox">{{ t('He revisado la licencia y autorizo esta descarga y preparación.') }}</label><button class="primary-button full" :disabled="busy || !plan.canPrepare || !consent" @click="emit('prepare')"><Download :size="17"/>{{ busy ? t('Iniciando…') : plan.remainingBytes ? t('Descargar y preparar') : t('Comprobar y preparar') }}</button></template>
  </dialog>
</template>
