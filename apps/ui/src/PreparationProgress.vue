<script setup lang="ts">
import { computed } from 'vue'
import { bytes, locale, t } from './i18n'
const props = defineProps<{ label: string; received?: number; total?: number; connected: boolean }>()
const measured = computed(() => Number.isFinite(props.total) && props.total! > 0 && Number.isFinite(props.received) && props.received! >= 0)
const received = computed(() => Math.min(props.total || 0, props.received || 0))
const percentage = computed(() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(received.value / (props.total || 1)))
</script>
<template>
  <div class="preparation-progress" :class="{ disconnected: !connected }">
    <div class="progress-heading"><strong>{{ t(label) }}</strong><span v-if="measured" class="progress-percentage">{{ percentage }}</span><span v-else>{{ t('En curso') }}</span></div>
    <progress v-if="measured" :value="received" :max="total" :aria-label="t(label)" :aria-valuetext="percentage"></progress>
    <div v-else class="progress-activity" role="progressbar" :aria-label="t(label)" :aria-valuetext="t('En curso')"><span></span></div>
    <p v-if="measured" class="progress-details">{{ bytes(received) }} {{ t('de') }} {{ bytes(total!) }}</p>
    <p v-else class="progress-details">{{ t('Esta etapa no tiene un porcentaje medible. Kobocraft sigue trabajando.') }}</p>
    <p v-if="!connected" class="progress-details">{{ t('Sin conexión con el servicio. Mostrando el último avance recibido.') }}</p>
  </div>
</template>
<style scoped>
.preparation-progress{margin-block:20px}.progress-heading{display:flex;align-items:baseline;justify-content:space-between;gap:16px;line-height:1.5;font-size:14px}.progress-heading strong{font-weight:500}.progress-heading>span{font-variant-numeric:tabular-nums;color:var(--accent-text);white-space:nowrap}.progress-details{font-size:13px!important;line-height:1.6!important;color:var(--muted);margin:8px 0!important;font-variant-numeric:tabular-nums}.progress-activity{height:9px;margin:14px 0;overflow:hidden;border-radius:8px;background:var(--raised)}.progress-activity span{display:block;width:35%;height:100%;border-radius:inherit;background:var(--accent);animation:preparation-activity 1.6s ease-in-out infinite}.disconnected .progress-activity span{animation-play-state:paused}@keyframes preparation-activity{0%{transform:translateX(-100%)}100%{transform:translateX(390%)}}@media(prefers-reduced-motion:reduce){.progress-activity span{animation:none;transform:translateX(90%)}}
</style>
