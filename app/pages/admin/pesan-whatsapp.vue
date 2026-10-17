<script setup lang="ts">
import { MessageSquareText, RotateCcw } from 'lucide-vue-next'
import {
  ACCESS_PLACEHOLDERS, ACCESS_REQUIRED, RECAP_PLACEHOLDERS, RECAP_REQUIRED, TEMPLATE_MAX, buildAccessMessage, buildRecapMessage, missingPlaceholders,
} from '../../../shared/whatsapp'

definePageMeta({ admin: true })
useHead({ title: 'Pesan WhatsApp — MDUNDIG' })

interface Settings { access_template: string | null; recap_template: string | null; defaults: { access: string; recap: string } }
const api = useApi()
const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const defaults = ref({ access: '', recap: '' })
const form = reactive({ access: '', recap: '' })
const accessArea = ref<HTMLTextAreaElement | null>(null)
const recapArea = ref<HTMLTextAreaElement | null>(null)

// Contoh data untuk pratinjau.
const preview = computed(() => ({
  access: buildAccessMessage({ name: 'Rina', username: 'rina.doni', password: 'Contoh-123', loginUrl: `${window.location.origin}/login?u=rina.doni`, invitationTitle: 'Rina & Doni', sender: 'Apeiron.ID' }, form.access),
  // Contoh 115 reservasi: pesan menyebut jumlahnya + 6 terbaru, sisanya diarahkan ke web.
  recap: buildRecapMessage({ name: 'Rina', invitationTitle: 'Rina & Doni', total: 115, loginUrl: `${window.location.origin}/login?u=rina.doni`, sender: 'Apeiron.ID',
    latest: ['Rice Cooker|Budi', 'Blender|Siti', 'Dispenser|Andi', 'Setrika|Dewi', 'Kipas Angin|Rudi', 'Mixer|Nina'].map((s) => ({ gift: s.split('|')[0]!, guest: s.split('|')[1]! })) }, form.recap),
}))
const missing = computed(() => ({ access: missingPlaceholders(form.access, ACCESS_REQUIRED), recap: missingPlaceholders(form.recap, RECAP_REQUIRED) }))
const invalid = computed(() => missing.value.access.length > 0 || missing.value.recap.length > 0 || form.access.length > TEMPLATE_MAX || form.recap.length > TEMPLATE_MAX)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const s = await api.request<Settings>('/api/app/admin/settings/whatsapp')
    defaults.value = s.defaults
    form.access = s.access_template ?? s.defaults.access
    form.recap = s.recap_template ?? s.defaults.recap
  } catch (err) {
    error.value = errorMessage(err, 'Template gagal dimuat.')
  } finally {
    loading.value = false
  }
}
onMounted(load)

function insert(which: 'access' | 'recap', key: string) {
  const area = which === 'access' ? accessArea.value : recapArea.value
  const token = `{${key}}`
  if (!area) { form[which] += token; return }
  const start = area.selectionStart ?? form[which].length
  const end = area.selectionEnd ?? start
  form[which] = form[which].slice(0, start) + token + form[which].slice(end)
  void nextTick(() => { area.focus(); area.setSelectionRange(start + token.length, start + token.length) })
}
function reset(which: 'access' | 'recap') { form[which] = defaults.value[which] }

async function save() {
  if (saving.value || invalid.value) return
  saving.value = true
  try {
    // Sama dengan bawaan → disimpan sebagai "bawaan" (null) agar ikut pembaruan template bawaan berikutnya.
    await api.request('/api/app/admin/settings/whatsapp', {
      method: 'PUT',
      body: {
        access_template: form.access.trim() === defaults.value.access.trim() ? null : form.access,
        recap_template: form.recap.trim() === defaults.value.recap.trim() ? null : form.recap,
      },
    })
    toast.success('Template pesan disimpan.')
    void useWaTemplates().load(true)
  } catch (err) {
    toast.error(errorMessage(err, 'Template gagal disimpan.'))
  } finally {
    saving.value = false
  }
}
/** Tampilan placeholder, mis. {nama}. (Ditulis di skrip: "}}" di template dibaca Vue sebagai akhir interpolasi.) */
const tok = (k: string) => '{' + k + '}'
const HELP: Record<string, string> = {
  nama: 'Nama pelanggan', username: 'Username akun', password: 'Password (atau "sama seperti sebelumnya")', link_login: 'Tautan masuk',
  undangan: 'Judul undangan', pengirim: 'Nama website pengirim', jumlah_reservasi: 'Jumlah reservasi', daftar_hadiah: 'Daftar hadiah & nama tamu',
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Pesan WhatsApp</h1><p class="text-caption">Atur isi pesan yang dikirim ke pelanggan. Klik nama data untuk menyisipkannya.</p></div>
      <AsyncButton :loading="saving" :disabled="loading || invalid" @click="save">Simpan template</AsyncButton>
    </div>
    <p v-if="error" class="alert tone-err" role="alert">{{ error }}</p>
    <LoadingRows v-if="loading" :rows="4" />
    <template v-else>
      <section v-for="t in ([
        { id: 'access', title: 'Pesan akses akun', desc: 'Dikirim saat akun dibuat, password diatur ulang, atau dari tombol WhatsApp di Pengguna', keys: ACCESS_PLACEHOLDERS, area: 'accessArea' },
        { id: 'recap', title: 'Pesan rekap reservasi', desc: 'Dikirim dari detail undangan ke pelanggan pemegang undangan', keys: RECAP_PLACEHOLDERS, area: 'recapArea' },
      ] as const)" :key="t.id" class="card" :aria-labelledby="`tpl-${t.id}`" :data-testid="`tpl-${t.id}`">
        <div class="card-header">
          <div><h2 :id="`tpl-${t.id}`" class="flex items-center gap-2"><MessageSquareText :size="18" /> {{ t.title }}</h2><p class="text-caption">{{ t.desc }}</p></div>
          <button class="btn btn-ghost btn-sm" type="button" @click="reset(t.id)"><RotateCcw :size="15" /> Kembalikan bawaan</button>
        </div>
        <div class="card-body tpl-grid">
          <div class="field">
            <label :for="`tpl-area-${t.id}`" class="field-label">Template</label>
            <div class="chips" role="group" :aria-label="`Sisipkan data ke ${t.title}`">
              <button v-for="k in t.keys" :key="k" type="button" class="chip-btn" :title="HELP[k]" @click="insert(t.id, k)">{{ tok(k) }}</button>
            </div>
            <textarea :id="`tpl-area-${t.id}`" :ref="(el) => { if (t.id === 'access') accessArea = el as HTMLTextAreaElement; else recapArea = el as HTMLTextAreaElement }"
              v-model="form[t.id]" class="textarea mono-ish" rows="14" :maxlength="TEMPLATE_MAX" />
            <p v-if="missing[t.id].length" class="field-hint err" role="alert">Wajib memuat {{ missing[t.id].map(tok).join(', ') }}.</p>
            <p v-else class="field-hint">{{ form[t.id].length }}/{{ TEMPLATE_MAX }} karakter · *teks* = tebal di WhatsApp</p>
          </div>
          <div class="field">
            <span class="field-label">Pratinjau</span>
            <div class="bubble" :data-testid="`preview-${t.id}`">{{ preview[t.id] }}</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tpl-grid { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1024px) { .tpl-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.chip-btn { padding: 0.2rem 0.55rem; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-subtle); font-family: var(--font-mono, monospace); font-size: 12px; color: var(--text-body); cursor: pointer; }
.chip-btn:hover { border-color: var(--brand); color: var(--brand); }
.mono-ish { font-size: var(--fs-label); line-height: 1.55; white-space: pre-wrap; }
.bubble { padding: 0.85rem 1rem; border-radius: var(--r); background: #e7f8ee; color: #1f2d24; font-size: var(--fs-label); line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 420px; overflow-y: auto; }
.err { color: var(--err); }
</style>
