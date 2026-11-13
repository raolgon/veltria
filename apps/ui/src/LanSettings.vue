<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Wifi, QrCode, Smartphone, ShieldCheck, RefreshCw, Check, X, Copy, PowerOff } from '@lucide/vue'
import type { LanState } from '@veltria/contracts'
import { qrSvgPath } from '@veltria/core'
import { t, date } from './i18n'

const props = defineProps<{
  state: LanState | null
  busy: boolean
  connected: boolean
  modal?: boolean
}>()

const emit = defineEmits<{
  enable: [address: string]
  disable: []
  refreshCode: []
  decide: [requestId: string, approve: boolean]
  revoke: [deviceId: string]
  close: []
}>()

const selectedAddress = ref('')
const copied = ref(false)

watch(
  () => [props.state?.selectedAddress, props.state?.interfaces] as const,
  ([current, list]) => {
    if (current) selectedAddress.value = current
    else if (!selectedAddress.value && list?.length) selectedAddress.value = list[0].address
  },
  { immediate: true }
)

const qrCode = computed(() => {
  const url = props.state?.pairingUrl
  if (!url) return null
  try {
    return qrSvgPath(url)
  } catch {
    return null
  }
})

const formattedCode = computed(() => {
  const raw = props.state?.pairingCode
  if (!raw) return '--- ---'
  return raw.length === 6 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw
})

async function copyAddress() {
  if (!props.state?.origin) return
  try {
    await navigator.clipboard.writeText(props.state.origin)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2200)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section :class="[modal ? 'modal wide-modal lan-modal-card' : 'settings-card lan-settings-card']" aria-labelledby="lan-settings-title">
    <button v-if="modal" type="button" class="icon-button modal-close" :aria-label="t('Cerrar aviso')" @click="emit('close')">
      <X :size="18"/>
    </button>

    <div class="lan-header">
      <div>
        <h2 id="lan-settings-title"><Wifi :size="20"/>{{ t('Red local') }}</h2>
        <p>{{ t('Usa Kobocraft desde tu teléfono, tablet u otro ordenador conectado al mismo Wi-Fi o red local. El equipo principal ejecuta los modelos.') }}</p>
      </div>
      <span :class="['lan-badge', { active: state?.enabled }]">
        <ShieldCheck :size="15"/>
        {{ state?.enabled ? t('Activo en red local') : t('Sólo este equipo') }}
      </span>
    </div>

    <p v-if="state?.warning" class="warning">{{ t(state.warning) }}</p>

    <div class="lan-controls">
      <div class="lan-field">
        <label :for="modal ? 'lan-interface-modal' : 'lan-interface-select'">{{ t('Interfaz de red privada') }}</label>
        <select
          :id="modal ? 'lan-interface-modal' : 'lan-interface-select'"
          v-model="selectedAddress"
          class="text-input"
          :disabled="!connected || busy || !state?.interfaces.length"
        >
          <option v-for="item in state?.interfaces || []" :key="item.address" :value="item.address">
            {{ item.name }} · {{ item.address }}{{ item.wsl ? ' (WSL2)' : '' }}
          </option>
          <option v-if="!state?.interfaces.length" value="">{{ t('Sin interfaces privadas detectadas') }}</option>
        </select>
      </div>

      <div class="lan-actions">
        <button
          v-if="!state?.enabled"
          type="button"
          class="primary-button"
          :disabled="!connected || busy || !selectedAddress"
          @click="emit('enable', selectedAddress)"
        >
          <Wifi :size="16"/>
          {{ t('Activar en mi red local') }}
        </button>
        <template v-else>
          <button
            v-if="selectedAddress && selectedAddress !== state.selectedAddress"
            type="button"
            class="secondary-button"
            :disabled="!connected || busy"
            @click="emit('enable', selectedAddress)"
          >
            {{ t('Cambiar interfaz') }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="!connected || busy"
            @click="emit('disable')"
          >
            <PowerOff :size="16"/>
            {{ t('Detener acceso en red') }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="state?.enabled && state.origin" class="lan-pairing-grid">
      <div class="lan-qr-box" aria-label="QR">
        <div class="lan-qr-frame">
          <svg
            v-if="qrCode"
            :viewBox="`-2 -2 ${qrCode.size + 4} ${qrCode.size + 4}`"
            width="260"
            height="260"
            class="lan-qr-svg"
            role="img"
            :aria-label="t('Código QR para conectar desde otro dispositivo')"
          >
            <rect x="-2" y="-2" :width="qrCode.size + 4" :height="qrCode.size + 4" fill="#ffffff"/>
            <path :d="qrCode.path" fill="#121316"/>
          </svg>
          <div v-else class="lan-qr-placeholder">
            <QrCode :size="64"/>
          </div>
        </div>
        <span class="small-note">{{ t('Escanea con la cámara de tu móvil') }}</span>
      </div>

      <div class="lan-pairing-details">
        <div class="lan-step">
          <span class="lan-step-label">{{ t('1. O abre esta dirección en el navegador de tu otro dispositivo:') }}</span>
          <div class="lan-url-row">
            <code class="lan-origin-code">{{ state.origin }}</code>
            <button type="button" class="secondary-button" @click="copyAddress">
              <Check v-if="copied" :size="15"/>
              <Copy v-else :size="15"/>
              {{ copied ? t('Copiado') : t('Copiar enlace') }}
            </button>
          </div>
        </div>

        <div class="lan-step">
          <span class="lan-step-label">{{ t('2. Introduce este código de 6 dígitos si no usas el QR:') }}</span>
          <div class="lan-code-row">
            <strong class="lan-six-code" aria-live="polite">{{ formattedCode }}</strong>
            <button type="button" class="secondary-button" :disabled="busy" @click="emit('refreshCode')">
              <RefreshCw :size="15"/>
              {{ t('Nuevo código') }}
            </button>
          </div>
          <p v-if="state.pairingExpiresAt" class="small-note">
            {{ t('Código temporal válido hasta:') }} {{ date(state.pairingExpiresAt) }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="state?.pendingRequests.length" class="lan-section" aria-live="polite">
      <h3>{{ t('Solicitudes esperando tu aprobación') }} ({{ state.pendingRequests.length }})</h3>
      <ul class="lan-device-list">
        <li v-for="req in state.pendingRequests" :key="req.id" class="lan-device-item pending">
          <div class="lan-device-meta">
            <Smartphone :size="18"/>
            <div>
              <strong>{{ req.label }}</strong>
              <small>{{ req.address }} · {{ date(req.requestedAt) }}</small>
            </div>
          </div>
          <div class="action-row">
            <button type="button" class="primary-button" :disabled="busy" @click="emit('decide', req.id, true)">
              <Check :size="15"/>
              {{ t('Aprobar dispositivo') }}
            </button>
            <button type="button" class="secondary-button" :disabled="busy" @click="emit('decide', req.id, false)">
              <X :size="15"/>
              {{ t('Rechazar') }}
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="state?.enabled" class="lan-section">
      <h3>{{ t('Dispositivos conectados') }} ({{ state.devices.length }})</h3>
      <p v-if="!state.devices.length" class="small-note">
        {{ t('Ningún dispositivo externo conectado todavía.') }}
      </p>
      <ul v-else class="lan-device-list">
        <li v-for="dev in state.devices" :key="dev.id" class="lan-device-item">
          <div class="lan-device-meta">
            <Smartphone :size="18"/>
            <div>
              <strong>{{ dev.label }}</strong>
              <small>{{ dev.address }} · {{ t('Última actividad:') }} {{ date(dev.lastSeenAt) }}</small>
            </div>
          </div>
          <button type="button" class="secondary-button" :disabled="busy" @click="emit('revoke', dev.id)">
            {{ t('Desconectar') }}
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
