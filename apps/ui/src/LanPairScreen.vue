<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Wifi, Smartphone, ShieldCheck, RefreshCw, AlertTriangle, Sun, Moon } from '@lucide/vue'
import { api } from './api'
import { t, locale } from './i18n'

const props = defineProps<{
  initialToken: string | null
  dark: boolean
}>()

const emit = defineEmits<{
  paired: []
  theme: []
  language: []
}>()

function guessDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPad|Tablet/i.test(ua)) return 'Tablet'
  if (/Android|iPhone|Mobile/i.test(ua)) return 'Teléfono'
  return 'Ordenador en red'
}

const deviceLabel = ref(guessDeviceLabel())
const codeInput = ref('')
const submitting = ref(false)
const requestId = ref('')
const hostName = ref('Kobocraft PC')
const status = ref<'idle' | 'pending' | 'rejected' | 'expired'>('idle')
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | undefined

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

async function pollOnce() {
  if (!requestId.value) return
  try {
    const res = await api.pollLanPair(requestId.value)
    hostName.value = res.hostName || hostName.value
    if (res.status === 'approved') {
      stopPolling()
      emit('paired')
    } else if (res.status === 'rejected' || res.status === 'expired') {
      stopPolling()
      status.value = res.status
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo comprobar la solicitud.'
  }
}

async function submitPair(codeOverride?: string) {
  const raw = (codeOverride ?? codeInput.value).trim()
  if (!raw || submitting.value) return
  submitting.value = true
  error.value = ''
  stopPolling()
  try {
    const res = await api.requestLanPair(raw, deviceLabel.value.trim() || guessDeviceLabel())
    requestId.value = res.requestId
    hostName.value = res.hostName || hostName.value
    status.value = 'pending'
    pollTimer = setInterval(() => { void pollOnce() }, 1200)
  } catch (cause) {
    status.value = 'idle'
    error.value = cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.'
  } finally {
    submitting.value = false
  }
}

function resetPair() {
  stopPolling()
  requestId.value = ''
  status.value = 'idle'
  error.value = ''
}

onMounted(() => {
  if (props.initialToken) {
    void submitPair(props.initialToken)
  }
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="lan-pair-shell">
    <header class="lan-pair-topbar">
      <div class="brand">
        <img class="brand-logo" :src="dark ? '/kobocraft-dark.svg' : '/kobocraft-light.svg'" alt="" width="30" height="30"/>
        <span>KOBOCRAFT</span>
        <span class="brand-dot"></span>
      </div>
      <div class="topbar-right">
        <button type="button" class="secondary-button" @click="emit('language')">
          {{ locale === 'es' ? 'EN' : 'ES' }}
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="dark ? t('Cambiar a modo claro') : t('Cambiar a modo oscuro')"
          @click="emit('theme')"
        >
          <Sun v-if="dark" :size="19"/>
          <Moon v-else :size="19"/>
        </button>
      </div>
    </header>

    <main id="content" class="lan-pair-card">
      <div class="lan-pair-icon">
        <Wifi :size="28"/>
      </div>
      <h1 tabindex="-1">{{ t('Conectar con Kobocraft en red local') }}</h1>
      <p class="lan-pair-subtitle">
        {{ t('Vincula este dispositivo para crear imágenes y videos o explorar la biblioteca usando la potencia del equipo principal.') }}
      </p>

      <div v-if="error" class="service-alert" role="alert">
        <AlertTriangle :size="18"/>
        <span>{{ t(error) }}</span>
      </div>

      <section v-if="status === 'pending'" class="lan-waiting-box" aria-live="polite">
        <RefreshCw :size="24" class="spin-icon"/>
        <h2>{{ t('Esperando confirmación en el equipo principal…') }}</h2>
        <p>
          {{ t('En tu equipo principal') }} (<strong>{{ hostName }}</strong>), {{ t('pulsa «Aprobar dispositivo» en el aviso superior o en Ajustes → Red local.') }}
        </p>
        <button type="button" class="secondary-button" @click="resetPair">
          {{ t('Usar otro código') }}
        </button>
      </section>

      <section v-else-if="status === 'rejected' || status === 'expired'" class="lan-waiting-box" aria-live="polite">
        <h2>{{ status === 'rejected' ? t('Solicitud rechazada en el equipo principal.') : t('La solicitud ha vencido.') }}</h2>
        <p>{{ t('Puedes volver a intentarlo con el código actual de 6 dígitos.') }}</p>
        <button type="button" class="primary-button" @click="resetPair">
          {{ t('Intentar de nuevo') }}
        </button>
      </section>

      <form v-else class="lan-pair-form" @submit.prevent="submitPair()">
        <label for="lan-device-label">{{ t('Nombre de este dispositivo') }}</label>
        <input
          id="lan-device-label"
          v-model="deviceLabel"
          type="text"
          class="text-input"
          maxlength="50"
          :placeholder="t('Ej. Mi teléfono')"
        >

        <label for="lan-pair-code">{{ t('Código de 6 dígitos del equipo principal') }}</label>
        <input
          id="lan-pair-code"
          v-model="codeInput"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          class="text-input lan-code-input"
          maxlength="12"
          placeholder="123 456"
          required
        >
        <p class="small-note">
          {{ t('Encuéntralo en el equipo principal dentro de Ajustes → Red local, o escanea el código QR directamente.') }}
        </p>

        <button type="submit" class="primary-button lan-submit-btn" :disabled="submitting || !codeInput.trim()">
          <Smartphone :size="17"/>
          {{ submitting ? t('Enviando solicitud…') : t('Solicitar acceso') }}
        </button>
      </form>

      <footer class="lan-pair-footer">
        <ShieldCheck :size="15"/>
        <span>{{ t('Conexión directa en tu red privada · Sin servidores externos') }}</span>
      </footer>
    </main>
  </div>
</template>
