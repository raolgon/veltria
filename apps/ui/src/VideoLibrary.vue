<script setup lang="ts">
import type { VideoJob } from '@veltria/contracts'
import { Clapperboard, Download, ArrowRight } from '@lucide/vue'
import { t, date } from './i18n'
defineProps<{ jobs: VideoJob[]; total: number; busy: boolean }>()
const emit = defineEmits<{ reuse: [job: VideoJob]; more: []; create: [] }>()
const status = (job: VideoJob) => t({ queued: 'En espera', submitting: 'Enviando', running: 'Creando', saving: 'Guardando', completed: 'Creado', cancelled: 'Cancelado', failed: 'Requiere atención', interrupted: 'Interrumpido' }[job.status])
</script>
<template>
  <div class="page-heading"><div><h1 tabindex="-1">{{ t('Tus videos') }}</h1><p>{{ t('Videos y descripciones guardados en este equipo.') }}</p></div></div>
  <section v-if="!jobs.length" class="empty-state"><Clapperboard :size="38"/><h2>{{ t('Tu primer video empieza con una escena.') }}</h2><p>{{ t('Los videos que crees aparecerán aquí con sus ajustes.') }}</p><button class="primary-button" @click="emit('create')">{{ t('Crear un video') }} <ArrowRight :size="16"/></button></section>
  <section v-else class="image-library" :aria-label="t('Videos guardados')"><article v-for="job in jobs" :key="job.id" class="library-entry"><video v-if="job.artifactId" :src="`/api/v1/video/artifacts/${job.artifactId}`" controls playsinline preload="none" class="library-video" :aria-label="t('Video guardado')"></video><div v-else class="library-pending"><Clapperboard :size="32"/><span>{{ status(job) }}</span></div><div class="library-copy"><span class="pill">{{ status(job) }}</span><p>{{ job.prompt }}</p><small>{{ job.width }} × {{ job.height }} · {{ date(job.createdAt) }}</small><p v-if="job.status !== 'completed'" class="job-description">{{ t(job.message) }}</p><div class="action-row"><a v-if="job.artifactId" :href="`/api/v1/video/artifacts/${job.artifactId}?download=1`" class="secondary-button" download><Download :size="16"/>{{ t('Guardar video') }}</a><button class="text-button" @click="emit('reuse', job)">{{ t('Usar descripción') }} <ArrowRight :size="15"/></button></div><details><summary>{{ t('Ajustes del video') }}</summary><p>{{ t('Semilla') }} {{ job.seed }} · {{ job.steps }} {{ t('pasos ·') }} {{ job.frames }} / {{ job.fps }} fps · MiniMax H3</p><p v-if="job.metadata">{{ job.metadata.codec }} · {{ job.metadata.duration.toFixed(2) }} s · {{ job.metadata.audio ? t('Con audio') : t('Sin audio') }}</p></details></div></article></section>
  <button v-if="jobs.length < total" class="secondary-button" :disabled="busy" @click="emit('more')">{{ t('Cargar más videos') }}</button>
</template>
