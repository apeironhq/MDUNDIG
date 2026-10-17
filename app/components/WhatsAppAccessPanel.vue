<script setup lang="ts">
import { Copy, MessageCircle, TriangleAlert } from 'lucide-vue-next'
import { resolveAppBase } from '../../shared/appUrl'
import { buildAccessMessage, formatWhatsapp, normalizeWhatsapp, whatsappLink } from '../../shared/whatsapp'

// Kirim akses akun ke pelanggan lewat WhatsApp: pesan rapi siap kirim (bisa disunting), tombol buka WhatsApp & salin.
// Password hanya ada di layar ini (tidak disimpan sistem), jadi panel muncul tepat setelah akun dibuat / password diatur ulang.
const props = defineProps<{ name: string; username: string; password: string; whatsapp: string | null; invitationTitle?: string | null; sender?: string | null }>()
const toast = useToast()
const config = useRuntimeConfig()
const phoneInput = ref(formatWhatsapp(props.whatsapp))
const phone = computed(() => normalizeWhatsapp(phoneInput.value))
const loginUrl = computed(() => {
  const base = resolveAppBase(config.public.appUrl, window.location.origin).base
  return `${base}/login?u=${encodeURIComponent(props.username)}`
})
const message = ref('')
watchEffect(() => {
  message.value = buildAccessMessage({
    name: props.name, username: props.username, password: props.password, loginUrl: loginUrl.value,
    invitationTitle: props.invitationTitle, sender: props.sender,
  })
})
const link = computed(() => (phone.value ? whatsappLink(phone.value, message.value) : ''))

async function copy() {
  try {
    await navigator.clipboard.writeText(message.value)
    toast.success('Pesan disalin.')
  } catch {
    const area = document.createElement('textarea')
    area.value = message.value
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (ok) toast.success('Pesan disalin.')
    else toast.error('Pesan gagal disalin. Pilih teks lalu salin manual.')
  }
}
</script>

<template>
  <div class="wa" data-testid="wa-panel">
    <p class="alert"><TriangleAlert :size="16" /> <span>Password hanya tampil sekarang dan tidak disimpan di sistem. Kirim atau salin pesan ini sebelum menutup.</span></p>
    <div class="field">
      <label for="wa-phone" class="field-label">Kirim ke WhatsApp</label>
      <input id="wa-phone" v-model="phoneInput" class="input" inputmode="tel" autocomplete="off" placeholder="0812-3456-7890">
      <p v-if="phoneInput && !phone" class="field-hint err" role="alert">Nomor WhatsApp tidak valid.</p>
    </div>
    <div class="field">
      <label for="wa-message" class="field-label">Pesan <span class="text-caption">(bisa disunting sebelum dikirim)</span></label>
      <textarea id="wa-message" v-model="message" class="textarea mono-ish" rows="9" />
    </div>
    <div class="wa-actions">
      <button class="btn btn-secondary" type="button" @click="copy"><Copy :size="16" /> Salin pesan</button>
      <a class="btn btn-primary" :class="{ disabled: !link }" :href="link || undefined" :aria-disabled="!link" target="_blank" rel="noopener noreferrer" data-testid="wa-send">
        <MessageCircle :size="16" /> Kirim lewat WhatsApp
      </a>
    </div>
  </div>
</template>

<style scoped>
.wa { display: flex; flex-direction: column; gap: 1rem; }
.mono-ish { font-size: var(--fs-label); line-height: 1.55; white-space: pre-wrap; }
.wa-actions { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; }
.btn.disabled { pointer-events: none; opacity: 0.5; }
.err { color: var(--err); }
@media (max-width: 480px) { .wa-actions > * { flex: 1 1 100%; } }
</style>
