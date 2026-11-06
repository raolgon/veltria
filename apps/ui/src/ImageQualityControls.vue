<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CreationState, ImageQuality } from '@veltria/contracts'
import { imageQualityLimits, profileDimensions, qualityDimensions, validImageQuality } from '@veltria/core'
import { t } from './i18n'
const props = defineProps<{ state: CreationState; format: 'square' | 'landscape' | 'portrait'; quality: ImageQuality | null; locked: boolean }>()
const emit = defineEmits<{ 'update:quality': [value: ImageQuality | null] }>()
const advanced = ref(false)
const limits = computed(() => imageQualityLimits(props.state.profile))
const effective = computed<ImageQuality>(() => {
  const [width, height] = profileDimensions(props.format, props.state.profile)
  return props.quality ?? { width, height, steps: props.state.configuration.steps, cfg: props.state.configuration.cfg }
})
const sizes = computed(() => limits.value.sizes.map(size => ({ size, dimensions: qualityDimensions(size, props.format) })))
const selectedSize = computed(() => sizes.value.find(item => item.dimensions[0] === effective.value.width && item.dimensions[1] === effective.value.height)?.size ?? 'custom')
const valid = computed(() => validImageQuality(effective.value, props.state.profile))
const changed = computed(() => !!props.quality)
const demanding = computed(() => effective.value.width * effective.value.height > props.state.profile.width * props.state.profile.height)
function patch(value: Partial<ImageQuality>) { emit('update:quality', { ...effective.value, ...value }) }
function sizeChanged(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'custom') { advanced.value = true; return }
  const [width, height] = qualityDimensions(Number(value), props.format)
  patch({ width, height })
}
watch(() => props.format, format => {
  if (props.quality) {
    const [width, height] = qualityDimensions(Math.max(effective.value.width, effective.value.height), format)
    patch({ width, height })
  }
})
</script>

<template>
  <section class="option-section image-quality" :aria-label="t('Calidad de imagen')">
    <h2>{{ t('Calidad de imagen') }}</h2>
    <fieldset :disabled="locked">
      <label for="image-size">{{ t('Tamaño de imagen') }}</label>
      <select id="image-size" class="text-input" :value="selectedSize" @change="sizeChanged">
        <option v-for="item in sizes" :key="item.size" :value="item.size">{{ item.dimensions.join(' × ') }} px{{ item.size === limits.defaultSize ? ' · ' + t('Punto de partida') : '' }}</option>
        <option value="custom">{{ t('Tamaño personalizado') }}</option>
      </select>
      <label for="image-effort">{{ t('Esfuerzo de generación') }}</label>
      <select id="image-effort" class="text-input" :value="[12, state.configuration.steps, 30].includes(effective.steps) ? effective.steps : 'custom'" @change="($event.target as HTMLSelectElement).value === 'custom' ? advanced = true : patch({ steps: Number(($event.target as HTMLSelectElement).value) })">
        <option :value="12">{{ t('Rápido') }} · 12 {{ t('pasos') }}</option>
        <option v-if="state.configuration.steps !== 12 && state.configuration.steps !== 30" :value="state.configuration.steps">{{ t('Según configuración') }} · {{ state.configuration.steps }} {{ t('pasos') }}</option>
        <option :value="30">{{ t('Más elaboración') }} · 30 {{ t('pasos') }}</option>
        <option value="custom">{{ t('Pasos personalizados') }}</option>
      </select>
      <p class="helper">{{ t('Más píxeles requieren más memoria. Más pasos tardan más y no siempre mejoran la imagen.') }}</p>
      <details :open="advanced" @toggle="advanced = ($event.target as HTMLDetailsElement).open">
        <summary>{{ t('Ajustar manualmente') }}</summary>
        <p class="helper">{{ t('El ancho y alto manuales definen el formato final.') }}</p>
        <div class="quality-fields">
          <label for="image-width">{{ t('Ancho (px)') }}<input id="image-width" class="text-input" type="number" :min="limits.min" :max="limits.max" step="64" :value="effective.width" @input="patch({ width: Number(($event.target as HTMLInputElement).value) })"></label>
          <label for="image-height">{{ t('Alto (px)') }}<input id="image-height" class="text-input" type="number" :min="limits.min" :max="limits.max" step="64" :value="effective.height" @input="patch({ height: Number(($event.target as HTMLInputElement).value) })"></label>
          <label for="image-steps">{{ t('Pasos') }}<input id="image-steps" class="text-input" type="number" min="1" max="60" step="1" :value="effective.steps" @input="patch({ steps: Number(($event.target as HTMLInputElement).value) })"></label>
          <label for="image-cfg">CFG<input id="image-cfg" class="text-input" type="number" min="1" max="15" step="0.1" :value="effective.cfg" @input="patch({ cfg: Number(($event.target as HTMLInputElement).value) })"></label>
        </div>
        <p class="helper">{{ t('Límites de esta receta: {0}–{1} px por lado, múltiplos de 64; 1–60 pasos; CFG 1–15.', { 0: limits.min, 1: limits.max }) }}</p>
        <p class="helper">{{ t('CFG controla cuánto sigue el modelo tu descripción. Un valor alto puede producir defectos.') }}</p>
      </details>
      <button v-if="changed" class="text-button" @click="emit('update:quality', null)">{{ t('Restablecer ajustes del modelo') }}</button>
    </fieldset>
    <p class="helper quality-summary" aria-live="polite">{{ effective.width }} × {{ effective.height }} px · {{ effective.steps }} {{ t('pasos') }} · CFG {{ effective.cfg }}</p>
    <p v-if="!valid" class="warning" role="alert">{{ t('Revisa los valores: usa los límites indicados y dimensiones múltiplos de 64.') }}</p>
    <p v-else-if="demanding" class="warning">{{ t('Este tamaño supera el punto de partida para tu equipo. Puede tardar más o agotar la memoria; puedes intentarlo o reducir el tamaño.') }}</p>
    <p v-if="changed" class="helper">{{ t('Estos ajustes se aplican a la siguiente imagen; la configuración guardada no cambia.') }}</p>
  </section>
</template>
