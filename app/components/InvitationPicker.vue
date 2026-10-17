<script setup lang="ts">
import { Search } from 'lucide-vue-next'

// Daftar centang undangan (tercatat otomatis dari WordPress) untuk memberi akses ke satu akun.
interface Option { id: string; title: string; website_name: string | null }
const props = withDefaults(defineProps<{ options: Option[]; loading?: boolean; idPrefix?: string }>(), { loading: false, idPrefix: 'inv' })
const model = defineModel<string[]>({ required: true })
const q = ref('')
const shown = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return props.options
  return props.options.filter((o) => `${o.title} ${o.website_name ?? ''}`.toLowerCase().includes(term))
})
const selected = computed(() => new Set(model.value))
function toggle(id: string, on: boolean) {
  model.value = on ? [...model.value, id] : model.value.filter((x) => x !== id)
}
const allShown = computed(() => shown.value.length > 0 && shown.value.every((o) => selected.value.has(o.id)))
function toggleShown(on: boolean) {
  const ids = new Set(shown.value.map((o) => o.id))
  model.value = on ? [...new Set([...model.value, ...ids])] : model.value.filter((x) => !ids.has(x))
}
</script>

<template>
  <div class="picker">
    <div class="picker-top">
      <label class="search">
        <Search :size="16" aria-hidden="true" />
        <span class="sr-only">Cari undangan</span>
        <input v-model="q" class="input" type="search" placeholder="Cari judul undangan atau website" :disabled="!options.length">
      </label>
      <span class="text-caption whitespace-nowrap" aria-live="polite">{{ model.length }} dipilih</span>
    </div>
    <LoadingRows v-if="loading" :rows="3" />
    <p v-else-if="!options.length" class="picker-empty">Belum ada undangan dari WordPress. Undangan tercatat otomatis saat widget Daftar Hadiah dibuka.</p>
    <template v-else>
      <label class="row row-all">
        <input type="checkbox" :checked="allShown" :disabled="!shown.length" @change="toggleShown(($event.target as HTMLInputElement).checked)">
        <span>{{ q ? 'Pilih semua hasil pencarian' : 'Pilih semua undangan' }}</span>
      </label>
      <ul class="list" role="group" aria-label="Undangan">
        <li v-for="o in shown" :key="o.id">
          <label class="row" :for="`${idPrefix}-${o.id}`">
            <input :id="`${idPrefix}-${o.id}`" type="checkbox" :checked="selected.has(o.id)" @change="toggle(o.id, ($event.target as HTMLInputElement).checked)">
            <span class="min-w-0">
              <span class="block truncate title">{{ o.title || 'Tanpa judul' }}</span>
              <span class="block truncate text-caption">{{ o.website_name || '—' }}</span>
            </span>
          </label>
        </li>
        <li v-if="!shown.length" class="picker-empty">Tidak ada undangan yang cocok.</li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.picker { display: flex; flex-direction: column; gap: 0.5rem; }
.picker-top { display: flex; align-items: center; gap: 0.75rem; }
.search { position: relative; flex: 1; }
.search svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search .input { padding-left: 2.25rem; }
.list { list-style: none; margin: 0; padding: 0; max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--r); }
.list li + li { border-top: 1px solid var(--border); }
.row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.85rem; cursor: pointer; }
.row:hover { background: var(--bg-subtle); }
.row input { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--brand); }
.row-all { padding-left: 0.85rem; font-size: var(--fs-label); color: var(--text-body); }
.title { font-size: var(--fs-label); font-weight: var(--fw-medium); color: var(--text-heading); }
.picker-empty { padding: 0.85rem; font-size: var(--fs-label); color: var(--text-muted); }
</style>
