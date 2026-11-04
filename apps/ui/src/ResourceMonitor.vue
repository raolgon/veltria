<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Cpu, MemoryStick, CircuitBoard, HardDrive } from '@lucide/vue'
import type { Resources } from '@veltria/contracts'
import { bytes, t } from './i18n'
import { api } from './api'

const props = defineProps<{ connected: boolean }>()
const sample = ref<Resources | null>(null), failed = ref(false), now = ref(Date.now())
let timer: ReturnType<typeof setTimeout> | undefined, disposed = false, pending = false
const live = computed(() => props.connected && !failed.value && !!sample.value && now.value - Date.parse(sample.value.sampledAt) < 12_000)
const state = computed(() => !props.connected ? t('Sin conexión') : failed.value || sample.value && !live.value ? t('Lectura no disponible') : sample.value ? t('En vivo · cada 3 s') : t('Consultando…'))
const percent = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value)} %`
function memoryLabel(memory: Resources['ram'] | undefined) {
  if (!live.value || !memory || memory.used === null || memory.total === null) return t('Sin lectura')
  return `${bytes(memory.used)} / ${bytes(memory.total)}`
}
function memoryPercent(memory: Resources['ram'] | undefined) {
  return live.value && memory?.used != null && memory.total ? Math.min(100, memory.used / memory.total * 100) : null
}
const rows = computed(() => [
  { key: 'cpu', label: 'CPU', icon: Cpu, value: live.value ? percent(sample.value?.cpu.percent) : '—', usage: live.value ? sample.value?.cpu.percent ?? null : null, detail: sample.value?.wsl ? t('Uso del procesador del entorno WSL') : t('Uso del procesador de todo el equipo') },
  { key: 'ram', label: 'RAM', icon: MemoryStick, value: memoryLabel(sample.value?.ram), usage: memoryPercent(sample.value?.ram), detail: live.value ? t("{0} disponibles", { 0: bytes(sample.value!.ram.available) }) : t('Memoria del equipo') },
  ...(sample.value?.gpus.length ? sample.value.gpus : [null]).flatMap((gpu, index) => [
    { key: `gpu-${index}`, label: (sample.value?.gpus.length ?? 0) > 1 ? `GPU ${index + 1}` : 'GPU', icon: CircuitBoard, value: live.value ? percent(gpu?.percent) : '—', usage: live.value ? gpu?.percent ?? null : null, detail: gpu?.name || t('Uso gráfico no disponible en este equipo') },
    ...(gpu ? [{ key: `vram-${index}`, label: 'VRAM', icon: MemoryStick, value: memoryLabel(gpu.memory), usage: memoryPercent(gpu.memory), detail: live.value ? t("{0} disponibles · {1}", { 0: bytes(gpu.memory.available), 1: gpu.name }) : t('Memoria gráfica') }] : [])
  ])
])
async function update() {
  clearTimeout(timer)
  if (disposed || pending || !props.connected || document.hidden) return
  pending = true
  try { sample.value = await api.resources(); failed.value = false }
  catch { failed.value = true }
  finally {
    pending = false; now.value = Date.now()
    if (!disposed && props.connected && !document.hidden) timer = setTimeout(update, 3000)
  }
}
function visibilityChanged() { clearTimeout(timer); now.value = Date.now(); if (!document.hidden) void update() }
watch(() => props.connected, () => { now.value = Date.now(); clearTimeout(timer); if (props.connected) void update() })
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); void update() })
onBeforeUnmount(() => { disposed = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visibilityChanged) })
</script>

<template>
  <section class="resource-monitor" :aria-label="t('Recursos del equipo')">
    <div class="resource-heading"><strong>{{ t('Tu equipo') }}</strong><span class="resource-live" :class="{ live }" :title="state"><i aria-hidden="true"></i><span>{{ state }}</span></span></div>
    <div class="resource-rows">
      <div v-for="row in rows" :key="row.key" class="resource-row" :title="row.detail" :aria-label="`${row.label}: ${row.value}. ${row.detail}`">
        <div class="resource-reading"><span><component :is="row.icon" :size="12" aria-hidden="true"/>{{ row.label }}</span><span class="resource-value">{{ row.value }}</span><span class="resource-compact-value">{{ percent(row.usage) }}</span></div>
        <meter v-if="row.usage !== null" min="0" max="100" :value="row.usage" :aria-label="t('{0} en uso', { 0: row.label })"/>
        <div v-else class="resource-no-reading" aria-hidden="true"></div>
      </div>
    </div>
    <p class="resource-disk" :title="sample?.disk.path"><HardDrive :size="12" aria-hidden="true"/><span>{{ live && sample?.disk.available !== null ? t("{0} libres", { 0: bytes(sample?.disk.available ?? null) }) : t('Disco sin lectura') }}</span></p>
    <p class="resource-scope">{{ sample?.wsl ? t('Uso del entorno WSL') : t('Uso de todo el equipo') }}<span>{{ t('Disco de datos de Veltria') }}</span></p>
  </section>
</template>
