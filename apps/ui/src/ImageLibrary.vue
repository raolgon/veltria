<script setup lang="ts">
import { computed } from 'vue'
import { t, date } from './i18n'
import { Image as ImageIcon, Download, ArrowRight } from '@lucide/vue'
import type { ImageJob } from '@veltria/contracts'
defineProps<{ jobs: ImageJob[]; total: number; busy: boolean }>()
const emit = defineEmits<{ reuse: [job: ImageJob]; more: []; create: [] }>()
const status = computed(() => ({ queued: t('En espera'), submitting: t('Enviando'), running: t('Creando'), saving: t('Guardando'), completed: t('Creada'), cancelled: t('Cancelada'), failed: t('Requiere atención'), interrupted: t('Interrumpida') }))
</script>
<template>
  <div class="page-heading"><div><h1 tabindex="-1">{{ t('Tu biblioteca') }}</h1><p>{{ t('Tus imágenes y sus descripciones, guardadas en este equipo.') }}</p></div></div>
  <section v-if="!jobs.length" class="empty-state"><ImageIcon :size="38"/><h2>{{ t('Tu primera imagen empieza con una idea.') }}</h2><p>{{ t('Cuando crees una imagen, aparecerá aquí con sus ajustes.') }}</p><button class="primary-button" @click="emit('create')">{{ t('Crear una imagen') }} <ArrowRight :size="16"/></button></section>
  <section v-else class="image-library" :aria-label="t('Creaciones guardadas')"><article v-for="job in jobs" :key="job.id" class="library-entry"><button v-if="job.imageId" class="library-image" :aria-label="t('Abrir creación: ') + job.prompt.slice(0, 100)" @click="emit('reuse', job)"><img :src="`/api/v1/artifacts/${job.imageId}`" :alt="job.prompt.slice(0, 180)" loading="lazy"></button><div v-else class="library-pending"><ImageIcon :size="32"/><span>{{ status[job.status] }}</span></div><div class="library-copy"><span class="pill">{{ status[job.status] }}</span><p>{{ job.prompt }}</p><small>{{ job.width }} × {{ job.height }} · {{ date(job.createdAt) }}</small><p v-if="job.status !== 'completed'" class="job-description">{{ t(job.message) }}</p><div class="action-row"><a v-if="job.imageId" :href="`/api/v1/artifacts/${job.imageId}?download=1`" class="secondary-button" download><Download :size="16"/>{{ t('Guardar') }}</a><button class="text-button" @click="emit('reuse', job)">{{ t('Usar descripción') }} <ArrowRight :size="15"/></button></div><details><summary>{{ t('Ajustes de la creación') }}</summary><p>{{ t('Semilla') }} {{ job.seed }} · {{ job.steps }} {{ t('pasos ·') }} {{ job.profileId }}<br><template v-if="job.configurationName">{{ job.configurationOrigin === 'included' ? t(job.configurationName) : job.configurationName }} · CFG {{ job.cfg }} · {{ job.sampler }} / {{ job.scheduler }}<br></template>{{ t('Motor') }} {{ job.engineVersion || t('No informado') }}</p></details></div></article></section>
  <button v-if="jobs.length < total" class="secondary-button" :disabled="busy" @click="emit('more')">{{ t('Cargar más creaciones') }}</button>
</template>
