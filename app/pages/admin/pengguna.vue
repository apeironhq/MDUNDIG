<script setup lang="ts">
import { ArrowLeft, ArrowRight, Gift, KeyRound, Pencil, Trash2, UserPlus, UserRound, Users } from 'lucide-vue-next'

definePageMeta({ admin: true })
useHead({ title: 'Pengguna & Akses — MDUNDIG' })

interface UserRow { id: string; username: string | null; email: string; display_name: string; role: 'admin' | 'customer'; created_at: string; access_count?: number }
interface InvitationOption { id: string; title: string; website_name: string | null }

const api = useApi()
const toast = useToast()
const auth = useAuth()
const q = ref('')
const filters = computed(() => ({ q: q.value || undefined }))
const users = usePagedList<UserRow>('/api/app/admin/users', filters, 50)
const label = (u: { username?: string | null; display_name?: string; email?: string }) =>
  [u.username, u.display_name].filter(Boolean).join(' — ') || u.email || '—'

// Semua undangan yang tercatat dari WordPress (dimuat per 100) sebagai pilihan akses.
const invitations = ref<InvitationOption[]>([])
const invitationsLoading = ref(false)
let invitationsLoaded = false
async function loadInvitations(force = false) {
  if ((invitationsLoaded && !force) || invitationsLoading.value) return
  invitationsLoading.value = true
  try {
    const all: InvitationOption[] = []
    for (let page = 1; page <= 50; page++) {
      const res = await api.request<{ items: InvitationOption[]; total: number }>('/api/app/invitations', { query: { per_page: 100, page } })
      all.push(...res.items)
      if (all.length >= res.total || !res.items.length) break
    }
    invitations.value = all
    invitationsLoaded = true
  } catch (err) {
    toast.error(errorMessage(err, 'Daftar undangan gagal dimuat.'))
  } finally {
    invitationsLoading.value = false
  }
}
onMounted(() => { void users.load() })

// ---- 1. Akun
const createOpen = ref(false)
const account = reactive({ username: '', display_name: '', email: '', password: '', confirm: '', invitation_ids: [] as string[] })
const creating = ref(false)
const createError = ref('')
// Tambah akun dua langkah: 1) data akun, 2) akses undangan (opsional).
const createStep = ref<1 | 2>(1)
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/
function openCreate() { createError.value = ''; createStep.value = 1; createOpen.value = true; void loadInvitations() }
function nextStep() {
  createError.value = ''
  if (!USERNAME_RE.test(account.username.trim().toLowerCase())) { createError.value = 'Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.'; return }
  createError.value = passwordError(account.password, account.confirm)
  if (createError.value) return
  createStep.value = 2
}
async function createAccount() {
  if (creating.value) return
  if (createStep.value === 1) { nextStep(); return }
  createError.value = passwordError(account.password, account.confirm)
  if (createError.value) { createStep.value = 1; return }
  creating.value = true
  try {
    const res = await api.request<{ username: string; granted: number; access_failed: boolean }>('/api/app/admin/users', {
      method: 'POST', body: { username: account.username, display_name: account.display_name, email: account.email, password: account.password, invitation_ids: account.invitation_ids },
    })
    if (res.access_failed) toast.error(`Akun ${res.username} dibuat, tetapi akses undangan gagal disimpan. Atur lewat tombol Akses.`)
    else toast.success(res.granted ? `Akun ${res.username} dibuat dengan akses ke ${res.granted} undangan.` : `Akun ${res.username} dibuat. Atur undangannya lewat tombol Akses.`)
    createOpen.value = false
    Object.assign(account, { username: '', display_name: '', email: '', password: '', confirm: '', invitation_ids: [] })
    await users.load()
  } catch (err) {
    createError.value = errorMessage(err, 'Akun gagal dibuat.')
    // Kesalahan data akun (mis. username/email sudah dipakai) diperbaiki di langkah 1.
    if (/username|email|password/i.test(createError.value)) createStep.value = 1
  } finally {
    creating.value = false
  }
}
const resetTarget = ref<UserRow | null>(null)
const newPassword = ref('')
const resetting = ref(false)
const resetError = ref('')
function openReset(u: UserRow) { resetTarget.value = u; newPassword.value = ''; resetError.value = '' }
async function resetPassword() {
  if (!resetTarget.value || resetting.value) return
  resetError.value = passwordError(newPassword.value)
  if (resetError.value) return
  resetting.value = true
  try {
    await api.request(`/api/app/admin/users/${resetTarget.value.id}/password`, { method: 'POST', body: { password: newPassword.value } })
    toast.success('Password diperbarui. Sampaikan password baru kepada pengguna secara aman.')
    resetTarget.value = null
    newPassword.value = ''
  } catch (err) {
    resetError.value = errorMessage(err, 'Password gagal diperbarui.')
  } finally {
    resetting.value = false
  }
}

// ---- Ubah & hapus akun
const editTarget = ref<UserRow | null>(null)
const editForm = reactive({ username: '', display_name: '', email: '', role: 'customer' as 'admin' | 'customer' })
const editSaving = ref(false)
const editError = ref('')
const isSelf = (u: UserRow | null) => !!u && u.id === auth.me.value?.id
function openEditUser(u: UserRow) {
  editTarget.value = u
  editError.value = ''
  Object.assign(editForm, { username: u.username ?? '', display_name: u.display_name, email: u.email, role: u.role })
}
async function saveUser() {
  if (!editTarget.value || editSaving.value) return
  editSaving.value = true
  editError.value = ''
  try {
    const self = isSelf(editTarget.value)
    const body: Record<string, unknown> = { username: editForm.username, display_name: editForm.display_name, email: editForm.email }
    if (!self) body.role = editForm.role
    await api.request(`/api/app/admin/users/${editTarget.value.id}`, { method: 'PATCH', body })
    toast.success('Akun diperbarui.')
    editTarget.value = null
    await users.load()
    if (self) await auth.loadMe()
  } catch (err) {
    editError.value = errorMessage(err, 'Akun gagal diperbarui.')
  } finally {
    editSaving.value = false
  }
}
const deleteUser = ref<UserRow | null>(null)
const deletingUser = ref(false)
async function confirmDeleteUser() {
  if (!deleteUser.value || deletingUser.value) return
  deletingUser.value = true
  try {
    await api.request(`/api/app/admin/users/${deleteUser.value.id}`, { method: 'DELETE' })
    toast.success('Akun dihapus.')
    deleteUser.value = null
    await users.load()
  } catch (err) {
    deleteUser.value = null
    toast.error(errorMessage(err, 'Akun gagal dihapus.'))
  } finally {
    deletingUser.value = false
  }
}

// ---- Atur akses undangan per akun pelanggan
const accessTarget = ref<UserRow | null>(null)
const accessIds = ref<string[]>([])
const accessLoading = ref(false)
const accessSaving = ref(false)
const accessError = ref('')
async function openAccess(u: UserRow) {
  accessTarget.value = u
  accessIds.value = []
  accessError.value = ''
  accessLoading.value = true
  try {
    const [res] = await Promise.all([
      api.request<{ invitation_ids: string[] }>(`/api/app/admin/users/${u.id}/access`),
      loadInvitations(true),
    ])
    accessIds.value = res.invitation_ids
  } catch (err) {
    accessError.value = errorMessage(err, 'Akses akun gagal dimuat.')
  } finally {
    accessLoading.value = false
  }
}
async function saveAccess() {
  if (!accessTarget.value || accessSaving.value || accessLoading.value) return
  accessSaving.value = true
  accessError.value = ''
  try {
    const res = await api.request<{ granted: number; revoked: number; total: number }>(`/api/app/admin/users/${accessTarget.value.id}/access`, {
      method: 'PUT', body: { invitation_ids: accessIds.value },
    })
    toast.success(res.granted || res.revoked ? `Akses disimpan: ${res.total} undangan.` : 'Tidak ada perubahan akses.')
    accessTarget.value = null
    await users.load()
  } catch (err) {
    accessError.value = errorMessage(err, 'Akses gagal disimpan.')
  } finally {
    accessSaving.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Pengguna &amp; Akses</h1><p class="text-caption">Buat akun pelanggan dan atur undangan yang boleh mereka lihat dan unduh.</p></div>
      <button class="btn btn-primary" type="button" @click="openCreate"><UserPlus :size="16" /> Tambah akun</button>
    </div>

    <!-- 1. Akun -->
    <section class="card" aria-labelledby="users-title">
      <div class="card-header">
        <div>
          <h2 id="users-title" class="flex items-center gap-2"><Users :size="18" /> Akun</h2>
          <p class="text-caption">Akun admin &amp; pelanggan yang dapat masuk ke MDUNDIG</p>
        </div>
        <span v-if="users.total.value" class="badge">{{ users.total.value }} akun</span>
      </div>
      <div class="card-body border-b border-line"><SearchInput v-model="q" label="Cari akun" placeholder="Cari username, nama, atau email" /></div>
      <p v-if="users.error.value" class="alert tone-err m-5" role="alert">{{ users.error.value }}</p>
      <LoadingRows v-if="users.loading.value && !users.items.value.length" :rows="3" />
      <EmptyState v-else-if="!users.items.value.length" title="Belum ada akun" />
      <div v-else class="table-wrap" tabindex="0" role="region" aria-label="Tabel akun">
        <table v-stack class="table table-stack">
          <thead><tr><th scope="col">Username</th><th scope="col">Nama</th><th scope="col">Email</th><th scope="col">Peran</th><th scope="col">Undangan</th><th scope="col">Dibuat</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead>
          <tbody>
            <tr v-for="u in users.items.value" :key="u.id">
              <td class="cell-strong text-mono whitespace-nowrap cell-primary">{{ u.username || '—' }}</td>
              <td>{{ u.display_name || '—' }}</td>
              <td class="whitespace-nowrap">{{ u.email || '—' }}</td>
              <td><span class="badge">{{ u.role === 'admin' ? 'Admin platform' : 'Pelanggan' }}</span></td>
              <td class="whitespace-nowrap">
                <span v-if="u.role === 'admin'" class="text-caption">Semua</span>
                <span v-else :class="{ 'text-caption': !u.access_count }">{{ u.access_count ? `${u.access_count} undangan` : 'Belum ada' }}</span>
              </td>
              <td class="whitespace-nowrap">{{ formatDate(u.created_at) }}</td>
              <td class="cell-actions">
                <div class="flex gap-1 justify-end">
                  <button v-if="u.role === 'customer'" class="btn btn-secondary btn-sm" type="button" :aria-label="`Atur akses undangan ${u.username || u.email}`" @click="openAccess(u)"><Gift :size="15" /> Akses</button>
                  <button class="btn btn-ghost btn-sm btn-icon" type="button" title="Ubah akun" :aria-label="`Ubah akun ${u.username || u.email}`" @click="openEditUser(u)"><Pencil :size="15" /></button>
                  <button class="btn btn-ghost btn-sm btn-icon" type="button" title="Atur ulang password" :aria-label="`Atur ulang password ${u.username || u.email}`" @click="openReset(u)"><KeyRound :size="15" /></button>
                  <button v-if="!isSelf(u)" class="btn btn-danger-ghost btn-sm btn-icon" type="button" title="Hapus akun" :aria-label="`Hapus akun ${u.username || u.email}`" @click="deleteUser = u"><Trash2 :size="15" /></button>
                  <span v-else class="btn-icon btn-sm inline-block" aria-hidden="true" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar :page="users.page.value" :per-page="users.perPage" :total="users.total.value" :disabled="users.loading.value" @change="users.setPage" />
    </section>

    <ModalDialog :open="createOpen" :icon="UserPlus" title="Tambah akun pelanggan" subtitle="Akun langsung aktif. Sampaikan username dan password kepada pelanggan secara aman." :closable="!creating" @close="createOpen = false">
      <ol class="steps" aria-label="Langkah tambah akun">
        <li :class="{ active: createStep === 1, done: createStep === 2 }" :aria-current="createStep === 1 ? 'step' : undefined"><span class="step-icon"><UserRound :size="16" /></span><span>1. Data akun</span></li>
        <li :class="{ active: createStep === 2 }" :aria-current="createStep === 2 ? 'step' : undefined"><span class="step-icon"><Gift :size="16" /></span><span>2. Akses undangan</span></li>
      </ol>
      <form id="account-form" class="flex flex-col gap-5" autocomplete="off" novalidate @submit.prevent="createAccount">
        <template v-if="createStep === 1">
          <div class="field">
            <label for="a-username" class="field-label">Username</label>
            <input id="a-username" v-model="account.username" class="input text-mono" maxlength="32" autocapitalize="none" spellcheck="false" required>
            <p class="field-hint">3–32 karakter: huruf kecil, angka, titik, garis bawah, tanda hubung.</p>
          </div>
          <div class="grid gap-5 sm:grid-cols-2">
            <div class="field"><label for="a-name" class="field-label">Nama tampilan (opsional)</label><input id="a-name" v-model="account.display_name" class="input" maxlength="120"></div>
            <div class="field"><label for="a-email" class="field-label">Email (opsional)</label><input id="a-email" v-model="account.email" class="input" type="email"></div>
          </div>
          <div class="field">
            <div class="grid gap-5 sm:grid-cols-2">
              <div class="field"><label for="a-pw" class="field-label">Password</label><input id="a-pw" v-model="account.password" class="input" type="password" autocomplete="new-password" required></div>
              <div class="field"><label for="a-pw2" class="field-label">Ulangi password</label><input id="a-pw2" v-model="account.confirm" class="input" type="password" autocomplete="new-password" required></div>
            </div>
            <p class="field-hint" data-testid="password-rule">{{ PASSWORD_RULE }}</p>
          </div>
        </template>
        <fieldset v-else class="field">
          <legend class="field-label">Undangan yang boleh dilihat <span class="text-caption">(opsional — bisa diatur nanti lewat tombol Akses)</span></legend>
          <InvitationPicker v-model="account.invitation_ids" :options="invitations" :loading="invitationsLoading" id-prefix="new-inv" />
        </fieldset>
        <p v-if="createError" class="alert tone-err" role="alert">{{ createError }}</p>
      </form>
      <template #footer>
        <button v-if="createStep === 1" class="btn btn-secondary" type="button" :disabled="creating" @click="createOpen = false">Batal</button>
        <button v-else class="btn btn-secondary" type="button" :disabled="creating" @click="createStep = 1; createError = ''"><ArrowLeft :size="16" /> Kembali</button>
        <button v-if="createStep === 1" class="btn btn-primary" type="submit" form="account-form">Berikutnya <ArrowRight :size="16" /></button>
        <AsyncButton v-else type="submit" form="account-form" :loading="creating"><UserPlus :size="16" /> Buat akun</AsyncButton>
      </template>
    </ModalDialog>

    <ModalDialog :open="!!editTarget" :icon="Pencil" title="Ubah akun" :subtitle="editTarget ? label(editTarget) : ''" :closable="!editSaving" @close="editTarget = null">
      <form id="edit-user-form" class="flex flex-col gap-5" novalidate @submit.prevent="saveUser">
        <div class="field">
          <label for="e-username" class="field-label">Username</label>
          <input id="e-username" v-model="editForm.username" class="input text-mono" maxlength="32" autocapitalize="none" spellcheck="false">
        </div>
        <div class="field"><label for="e-name" class="field-label">Nama tampilan</label><input id="e-name" v-model="editForm.display_name" class="input" maxlength="120"></div>
        <div class="field">
          <label for="e-email" class="field-label">Email (opsional)</label>
          <input id="e-email" v-model="editForm.email" class="input" type="email">
        </div>
        <div class="field">
          <label for="e-role" class="field-label">Peran</label>
          <select id="e-role" v-model="editForm.role" class="select" :disabled="isSelf(editTarget)">
            <option value="customer">Pelanggan — hanya Daftar Hadiah undangan yang diberi akses</option>
            <option value="admin">Admin platform — akses penuh</option>
          </select>
          <p v-if="isSelf(editTarget)" class="field-hint">Anda tidak dapat mengubah peran akun Anda sendiri.</p>
        </div>
        <p v-if="editError" class="alert tone-err" role="alert">{{ editError }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="editSaving" @click="editTarget = null">Batal</button>
        <AsyncButton type="submit" form="edit-user-form" :loading="editSaving">Simpan</AsyncButton>
      </template>
    </ModalDialog>
    <ConfirmDialog :open="!!deleteUser" title="Hapus akun?" :loading="deletingUser"
      :message="deleteUser ? `Akun ${label(deleteUser)} dihapus permanen beserta akses undangannya. Data undangan dan reservasi tidak terhapus.` : ''"
      @close="deleteUser = null" @confirm="confirmDeleteUser" />
    <ModalDialog :open="!!accessTarget" :icon="Gift" title="Atur akses undangan" :subtitle="accessTarget ? `${label(accessTarget)} hanya melihat dan mengunduh undangan yang dicentang.` : ''"
      :closable="!accessSaving" @close="accessTarget = null">
      <form id="access-form" class="flex flex-col gap-4" novalidate data-testid="access-form" @submit.prevent="saveAccess">
        <InvitationPicker v-model="accessIds" :options="invitations" :loading="accessLoading || invitationsLoading" id-prefix="acc-inv" />
        <p v-if="accessError" class="alert tone-err" role="alert">{{ accessError }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="accessSaving" @click="accessTarget = null">Batal</button>
        <AsyncButton type="submit" form="access-form" :loading="accessSaving" :disabled="accessLoading">Simpan akses</AsyncButton>
      </template>
    </ModalDialog>
    <ModalDialog :open="!!resetTarget" :icon="KeyRound" title="Atur ulang password" :subtitle="resetTarget ? label(resetTarget) : ''" size="sm" :closable="!resetting" @close="resetTarget = null">
      <form id="reset-form" class="flex flex-col gap-4" novalidate @submit.prevent="resetPassword">
        <div class="field">
          <label for="r-pw" class="field-label">Password baru</label>
          <input id="r-pw" v-model="newPassword" class="input" type="password" autocomplete="new-password" required>
          <p class="field-hint">{{ PASSWORD_RULE }}</p>
        </div>
        <p v-if="resetError" class="alert tone-err" role="alert">{{ resetError }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="resetting" @click="resetTarget = null">Batal</button>
        <AsyncButton type="submit" form="reset-form" :loading="resetting">Simpan password</AsyncButton>
      </template>
    </ModalDialog>
  </div>
</template>

<style scoped>
.steps { display: flex; gap: 0.5rem; list-style: none; margin: 0 0 1.25rem; padding: 0; }
.steps li { flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--r); font-size: var(--fs-label); color: var(--text-muted); }
.steps li.active { border-color: var(--brand); color: var(--text-heading); font-weight: var(--fw-medium); }
.steps li.done { color: var(--text-body); }
.step-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--r-sm); background: var(--n-100); color: var(--n-500); flex-shrink: 0; }
.steps li.active .step-icon, .steps li.done .step-icon { color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); }
fieldset.field { border: 0; margin: 0; padding: 0; min-width: 0; }
</style>
