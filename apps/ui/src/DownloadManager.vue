<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { z } from 'zod'
import type { storageSchema, removalPlanSchema, StoredFile } from '@veltria/contracts'
import { api } from './api'
import { bytes, t } from './i18n'
const props=defineProps<{connected:boolean;busy:boolean;selectedConfigurationId:string}>()
const emit=defineEmits<{use:[id:string]}>()
const inventory=ref<z.infer<typeof storageSchema>|null>(null), plan=ref<z.infer<typeof removalPlanSchema>|null>(null), working=ref(false), error=ref(''), notice=ref(''), acceptShared=ref(false), heading=ref<HTMLElement|null>(null), listHeading=ref<HTMLElement|null>(null)
let timer:ReturnType<typeof setInterval>, trigger:HTMLElement|null=null, loading=false
async function load(){if(loading||working.value||!props.connected)return;loading=true;error.value='';try{inventory.value=await api.storage()}catch(cause){error.value=cause instanceof Error?cause.message:String(cause)}finally{loading=false}}
async function review(file:StoredFile){if(working.value)return;trigger=document.activeElement as HTMLElement;working.value=true;error.value='';notice.value='';try{plan.value=await api.removalPlan(file.id);acceptShared.value=false;await nextTick();heading.value?.focus()}catch(cause){error.value=cause instanceof Error?cause.message:String(cause)}finally{working.value=false}}
function cancel(){plan.value=null;if(trigger?.isConnected)trigger.focus()}
async function remove(){if(!plan.value||working.value)return;working.value=true;error.value='';try{inventory.value=await api.removeFile(plan.value.file.id,plan.value.revision,acceptShared.value);plan.value=null;notice.value='Se retiró el archivo. Tus creaciones y configuraciones se conservan.';await nextTick();listHeading.value?.focus()}catch(cause){error.value=cause instanceof Error?cause.message:String(cause)}finally{working.value=false}}
function use(file:StoredFile){const profile=file.profiles.find(item=>item.configurationId===props.selectedConfigurationId)||file.profiles[0];if(profile)emit('use',profile.configurationId)}
onMounted(()=>{void load();timer=setInterval(()=>{if(document.visibilityState==='visible'&&!plan.value)void load()},3000)})
onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <section class="download-manager" :aria-label="t('Lo descargado')">
    <div class="action-row"><h2 ref="listHeading" tabindex="-1">{{ t('Lo descargado') }}</h2><button class="secondary-button" :disabled="working||!connected" @click="cancel();load()">{{ t('Actualizar lista') }}</button></div>
    <p>{{ t('Archivos del catálogo en la ubicación de modelos de Veltria. Los archivos ajenos al catálogo no se modifican.') }}</p>
    <p v-if="error" role="alert" class="warning">{{ t(error) }}</p><p v-if="notice" role="status">{{ t(notice) }}</p>
    <p v-if="!inventory" role="status">{{ connected?t('Leyendo los archivos…'):t('Conecta con el servicio para ver lo descargado.') }}</p>
    <template v-else>
      <p class="storage-summary">{{ inventory.files.length }} {{ t(inventory.files.length===1?'archivo':'archivos') }} · {{ bytes(inventory.totalBytes) }} · {{ t('En descargas parciales') }}: {{ bytes(inventory.partialBytes) }}</p>
      <details><summary>{{ t('Ubicación de modelos') }}</summary><p class="storage-path">{{ inventory.directory }}</p></details>
      <p v-if="!inventory.files.length">{{ t('Todavía no hay archivos del catálogo en esta ubicación. Puedes prepararlos desde Modelos.') }}</p>
      <section v-if="plan" class="removal-review" aria-labelledby="remove-title">
        <h3 id="remove-title" ref="heading" tabindex="-1">{{ t('Revisar retirada') }}</h3><p>{{ plan.file.name }} · {{ bytes(plan.file.bytes) }}</p><p class="storage-path">{{ plan.file.path }}</p>
        <p>{{ t('Se elimina sólo este archivo. No se eliminan otros componentes, creaciones ni configuraciones. Para usarlo otra vez habrá que prepararlo de nuevo.') }}</p>
        <p v-if="plan.file.kind!=='partial'">{{ t('Comprobaremos que es el archivo correcto antes de retirarlo. Si cambió, se conservará.') }}</p>
        <p>{{ t('Perfiles que usan este archivo') }}:</p><ul><li v-for="profile in plan.file.profiles" :key="profile.id">{{ profile.name }}</li></ul>
        <label v-if="plan.shared" class="show-checkbox"><input v-model="acceptShared" type="checkbox" :disabled="working">{{ t('Entiendo que estos perfiles necesitarán preparar este archivo de nuevo.') }}</label>
        <p v-if="plan.file.protectedReason" class="warning">{{ t(plan.file.protectedReason) }}</p>
        <div class="action-row"><button class="secondary-button" :disabled="working" @click="cancel">{{ t('Cancelar') }}</button><button class="primary-button" :disabled="working||!connected||busy||!plan.canRemove||(plan.shared&&!acceptShared)" @click="remove">{{ working?t('Comprobando y retirando…'):t('Retirar archivo') }}</button></div>
      </section>
      <article v-for="file in inventory.files" :key="file.id" class="stored-file">
        <div><h3>{{ file.profiles[0]?.name||file.name }}</h3><p>{{ file.kind==='partial'?t('Descarga parcial'):file.kind==='lora'?t('Adaptación (LoRA)'):t('Modelo') }} · {{ bytes(file.bytes) }}<span v-if="file.kind==='partial'"> {{ t('de') }} {{ bytes(file.expectedBytes) }}</span></p><p v-if="file.profiles.length>1">{{ t('Compartido por perfiles') }}: {{ file.profiles.length }}</p><p v-if="file.protectedReason">{{ t(file.protectedReason) }}</p><details><summary>{{ t('Detalles del archivo') }}</summary><p>{{ file.name }}</p><p class="storage-path">{{ file.path }}</p></details></div>
        <div class="action-row"><button class="secondary-button" :disabled="working||busy||inventory.busy||!connected" @click="use(file)">{{ file.kind==='partial'?t('Continuar preparación'):t('Usar este archivo') }}</button><button class="text-button" :disabled="working||busy||inventory.busy||!connected||!!file.protectedReason" @click="review(file)">{{ t('Revisar retirada') }}</button></div>
      </article>
    </template>
  </section>
</template>
