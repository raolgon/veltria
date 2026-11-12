<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ManagedState, ManagedPlan, Preparation } from '@veltria/contracts'
import PreparationProgress from './PreparationProgress.vue'
import StorageNotice from './StorageNotice.vue'
import { api } from './api'
import { t, bytes } from './i18n'
const props = defineProps<{ state: ManagedState | null; preparation?: Preparation; separate?: boolean; connected: boolean; busy: boolean }>()
const emit = defineEmits<{ refresh: []; ready: [] }>()
const plan = ref<ManagedPlan | null>(null), consent = ref(false), pending = ref(false), error = ref('')
const directory = ref('')
const modelDirectory = ref(''), location = ref<'environment' | 'models' | null>(null)
function relocate(target: 'environment' | 'models' | 'data') { consent.value = false; if (target !== 'data') location.value = target }
function changeModels() { consent.value = false; plan.value = null; void action(async () => { await api.save({ modelsDirectory: modelDirectory.value.trim() }); plan.value = await api.managedPlan(directory.value.trim() || undefined, props.separate) }) }
const nativeFolder = typeof window.veltriaDesktop?.chooseEngineDirectory === 'function'
const active = computed(() => ['downloading', 'installing', 'preparing'].includes(props.state?.status || ''))
async function action(work: () => Promise<unknown>) {
  if (pending.value) return
  pending.value = true; error.value = ''
  try { await work(); emit('refresh') } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo revisar la instalación.' }
  finally { pending.value = false }
}
function review() { consent.value = false; plan.value = null; void action(async () => { plan.value = await api.managedPlan(directory.value.trim() || undefined, props.separate) }) }
async function chooseDirectory() {
  if (!window.veltriaDesktop?.chooseEngineDirectory) return
  const path = await window.veltriaDesktop.chooseEngineDirectory()
  if (path) { directory.value = path; consent.value = false; plan.value = await api.managedPlan(path, props.separate) }
}
function prepare() { if (plan.value && consent.value) void action(async () => { await api.prepareManaged(plan.value!.revision); plan.value = null; consent.value = false }) }
watch(() => [props.connected, props.busy], () => { if (props.connected && !props.busy && !pending.value && !plan.value && (!props.state || props.state.status === 'idle')) review() }, { immediate: true })
</script>
<template>
  <section class="managed-setup" aria-labelledby="managed-title">
    <h3 id="managed-title">{{ t('Instalación propia de Kobocraft') }}</h3>
    <p>{{ t('Kobocraft instalará lo necesario en una carpeta propia para crear en tu PC.') }}</p>
    <template v-if="state && state.status !== 'idle'">
      <StorageNotice v-if="state.storageIssue && !plan" :issue="state.storageIssue" :disabled="pending || busy || !connected" @recheck="review" @relocate="relocate(state.storageIssue.target)"/>
      <p v-else-if="!state.storageIssue" role="status">{{ t(state.message) }}</p>
      <PreparationProgress v-if="state.status === 'downloading'" label="Descarga del entorno" :received="state.received" :total="state.total" :connected="connected"/>
      <template v-else-if="state.status === 'preparing'">
        <p v-if="preparation" role="status">{{ t(preparation.message) }}</p>
        <PreparationProgress v-if="preparation?.status === 'downloading'" label="Descarga del modelo" :received="preparation.received" :total="preparation.total" :connected="connected"/>
        <PreparationProgress v-else :label="preparation?.status === 'verifying' ? 'Comprobando los archivos' : 'Comprobando el modelo y el motor'" :connected="connected"/>
      </template>
      <PreparationProgress v-else-if="state.status === 'installing'" label="Instalando el entorno" :connected="connected"/>
      <button v-if="active" class="secondary-button" :disabled="pending || !connected" @click="action(() => api.pauseManaged())">{{ t('Pausar instalación') }}</button>
      <button v-if="state.status === 'ready'" class="primary-button" @click="emit('ready')">{{ t('Volver a Crear') }}</button>
    </template>
    <template v-if="!active && state?.status !== 'ready'">
      <div v-if="location === 'models'" class="model-location"><label for="managed-model-directory">{{ t('Carpeta de modelos en el equipo del servicio') }}</label><input id="managed-model-directory" v-model="modelDirectory" class="text-input" maxlength="1000" :disabled="pending || busy" @input="plan = null; consent = false"><button class="secondary-button" :disabled="pending || busy || !connected || !modelDirectory.trim()" @click="changeModels">{{ t('Usar carpeta y revisar el plan') }}</button><p>{{ t('Los archivos de la ubicación anterior se conservan. Cambiar de carpeta requiere revisar y autorizar otro plan.') }}</p></div>
      <details :open="location === 'environment'"><summary>{{ t('Cambiar la ubicación del entorno') }}</summary><label for="managed-directory">{{ t('Carpeta del entorno en el equipo del servicio') }}</label><input id="managed-directory" v-model="directory" class="text-input" maxlength="1000" :disabled="pending || busy" @input="plan = null; consent = false"><button v-if="nativeFolder" class="secondary-button" :disabled="pending || busy" @click="action(chooseDirectory)">{{ t('Elegir carpeta') }}</button><p>{{ t('Los archivos de la ubicación anterior se conservan. Cambiar de carpeta requiere revisar y autorizar otro plan.') }}</p></details>
      <button class="secondary-button" :disabled="pending || busy || !connected" @click="review">{{ pending ? t('Comprobando…') : t('Revisar instalación y continuar') }}</button>
      <template v-if="plan">
        <StorageNotice v-for="(issue, index) in plan.storageIssues || []" :key="index" :issue="issue" :disabled="pending || busy || !connected" @recheck="review" @relocate="relocate(issue.target)"/>
        <p v-if="plan.separateInstallation">{{ t('Se instalará un entorno separado. Tu instalación anterior y sus modelos se conservan.') }}</p>
        <p>{{ plan.model }} · {{ t(plan.configuration) }}</p>
        <dl class="download-plan"><div><dt>{{ t('Descarga pendiente del entorno') }}</dt><dd>{{ bytes(plan.remainingBytes) }}</dd></div><div><dt>{{ t('Espacio necesario para el entorno') }}</dt><dd>{{ bytes(plan.requiredBytes) }}</dd></div><div><dt>{{ t('Disponible en el disco del entorno') }}</dt><dd>{{ bytes(plan.availableBytes) }}</dd></div><div><dt>{{ t('Descarga pendiente del modelo') }}</dt><dd>{{ bytes(plan.preparation.remainingBytes) }}</dd></div><div><dt>{{ t('Espacio necesario para el modelo') }}</dt><dd>{{ bytes(plan.preparation.requiredBytes) }}</dd></div></dl>
        <p>{{ t('Se conservan los archivos descargados para poder reparar o continuar. Preparar no genera una imagen.') }}</p>
        <details><summary>{{ t('Ver instalación, fuentes y licencias') }}</summary><p>{{ plan.recipe }}</p><p class="managed-path">{{ plan.directory }}</p><p class="managed-path">{{ plan.preparation.destination }}</p><ul><li v-for="source in plan.sources" :key="source" class="managed-path">{{ source }}</li><li v-for="license in plan.licenses" :key="license">{{ license }}</li></ul><p>{{ plan.preparation.license }} · {{ plan.preparation.licenseUrl }}</p><p>{{ t('Sólo se instalará código de las fuentes fijadas en el plan. No se modifican otras instalaciones ni controladores.') }}</p></details>
        <p v-for="blocker in plan.blockers.filter(message => !plan?.storageIssues?.some(issue => issue.message === message))" :key="blocker" class="warning">{{ t(blocker) }}</p>
        <label class="license-consent"><input v-model="consent" type="checkbox" :disabled="pending || busy || !plan.canPrepare">{{ t('He revisado las fuentes, licencias, descarga y ubicación. Autorizo instalar este entorno y preparar el modelo.') }}</label>
        <button class="primary-button full" :disabled="pending || busy || !connected || !consent || !plan.canPrepare" @click="prepare">{{ t('Instalar y preparar mi equipo') }}</button>
      </template>
    </template>
    <p v-if="error" class="warning" role="alert">{{ t(error) }}</p>
  </section>
</template>
<style scoped>
.managed-setup { margin-block: 1.5rem; }
.managed-setup > p { font-size: 14px; line-height: 1.7; color: var(--muted); margin-block: 12px; }
.managed-setup > button { margin-block: 8px; }
.managed-setup progress { width: 100%; }
.managed-setup details { margin-block: 1rem; }
.managed-path { overflow-wrap: anywhere; }
</style>
