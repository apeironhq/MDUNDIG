import type { SessionUser } from './supabase'

/** Daftar invitation_id dari body (unik, UUID valid, maks. 500). */
export function invitationIdsParam(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw badRequest('invitation_ids harus berupa daftar.')
  const ids = [...new Set(value.map((v) => uuidParam(v, 'invitation_ids')))]
  if (ids.length > 500) throw badRequest('Maksimal 500 undangan sekaligus.')
  return ids
}

export const ONE_INVITATION_MESSAGE = 'Satu akun pelanggan hanya dapat mengakses satu undangan.'

/** Akses yang sudah dimiliki akun (undangan eksplisit atau pemetaan otomatis), untuk pesan yang jelas. */
export async function existingAccess(admin: SessionUser, userId: string): Promise<{ invitationId: string | null; title: string | null; mapped: boolean }> {
  const [acc, map] = await Promise.all([
    admin.db.from('invitation_access').select('invitation_id, invitations(title)').eq('user_id', userId).maybeSingle(),
    admin.db.from('owner_mappings').select('id').eq('user_id', userId).maybeSingle(),
  ])
  if (acc.error) throw dbError(acc.error)
  if (map.error) throw dbError(map.error)
  const title = (acc.data?.invitations as { title?: string } | null)?.title
  return { invitationId: (acc.data?.invitation_id as string | undefined) ?? null, title: acc.data ? (title || 'Tanpa judul') : null, mapped: !!map.data }
}

/**
 * Menyamakan akses eksplisit satu akun pelanggan dengan `ids` (maksimal satu undangan): akses lama dicabut dulu,
 * lalu undangan baru diberikan. Berjalan dengan klien JWT admin, jadi RLS invitation_access (khusus admin) tetap berlaku.
 */
export async function syncUserAccess(admin: SessionUser, userId: string, ids: string[]) {
  if (ids.length > 1) throw badRequest(ONE_INVITATION_MESSAGE + ' Pilih salah satu.')
  const current = await admin.db.from('invitation_access').select('invitation_id').eq('user_id', userId)
  if (current.error) throw dbError(current.error)
  const have = new Set((current.data ?? []).map((r) => r.invitation_id as string))
  const want = new Set(ids)
  const add = ids.filter((id) => !have.has(id))
  const remove = [...have].filter((id) => !want.has(id))
  if (add.length) {
    const found = await admin.db.from('invitations').select('id').in('id', add)
    if (found.error) throw dbError(found.error)
    if ((found.data ?? []).length !== add.length) throw badRequest('Undangan tidak ditemukan. Muat ulang halaman lalu coba lagi.')
    const mapped = await admin.db.from('owner_mappings').select('id').eq('user_id', userId).maybeSingle()
    if (mapped.error) throw dbError(mapped.error)
    if (mapped.data) throw createError({ statusCode: 409, statusMessage: 'user_has_access', data: { message: 'Akun ini sudah mendapat undangan lewat pemetaan otomatis (menu Koneksi). ' + ONE_INVITATION_MESSAGE } })
  }
  // Cabut dulu, baru beri: satu akun hanya boleh memegang satu baris akses.
  if (remove.length) {
    const { error } = await admin.db.from('invitation_access').delete().eq('user_id', userId).in('invitation_id', remove)
    if (error) throw dbError(error)
  }
  if (add.length) {
    const { error } = await admin.db.from('invitation_access')
      .insert(add.map((invitation_id) => ({ invitation_id, user_id: userId, granted_by: admin.id })))
    if (error) throw dbError(error)
  }
  for (const id of add) await audit(admin, 'access.grant', id, { user_id: userId })
  for (const id of remove) await audit(admin, 'access.revoke', id, { user_id: userId })
  return { granted: add.length, revoked: remove.length, total: ids.length }
}
