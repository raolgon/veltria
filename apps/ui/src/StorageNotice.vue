<script setup lang="ts">
import type { StorageIssue } from '@veltria/contracts'
import { t, bytes } from './i18n'
defineProps<{ issue: StorageIssue; disabled?: boolean }>()
defineEmits<{ recheck: []; relocate: [] }>()
</script>
<template>
  <aside class="storage-notice" :role="issue.severity === 'error' ? 'alert' : 'status'">
    <strong>{{ t(issue.code === 'low-space' ? 'Queda poco espacio' : issue.code === 'permission-denied' ? 'Revisa los permisos de la carpeta' : issue.code === 'read-only' ? 'La carpeta es de sólo lectura' : issue.code === 'quota' ? 'Se alcanzó la cuota de almacenamiento' : issue.code === 'space-unknown' ? 'No se pudo comprobar el espacio' : 'Hace falta espacio libre') }}</strong>
    <p>{{ t(issue.message) }}</p>
    <p class="storage-path">{{ t(issue.target === 'environment' ? 'Entorno' : issue.target === 'models' ? 'Modelos' : 'Datos de Kobocraft') }}: {{ issue.path }}</p>
    <p v-if="issue.requiredBytes !== null">{{ t('Necesario') }}: {{ bytes(issue.requiredBytes) }} · {{ t('Disponible') }}: {{ bytes(issue.availableBytes) }}</p>
    <div><button class="secondary-button" :disabled="disabled" @click="$emit('recheck')">{{ t('Volver a comprobar') }}</button><button v-if="issue.target !== 'data'" class="secondary-button" :disabled="disabled" @click="$emit('relocate')">{{ t('Cambiar carpeta') }}</button></div>
  </aside>
</template>
<style scoped>
.storage-notice { border: 1px solid var(--line); border-left: 3px solid var(--accent); padding: 1rem; margin-block: 1rem; border-radius: 10px; }
.storage-notice p { margin-block: .65rem; line-height: 1.6; }
.storage-path { overflow-wrap: anywhere; color: var(--muted); font-size: 13px; }
.storage-notice div { display: flex; flex-wrap: wrap; gap: .5rem; }
</style>
