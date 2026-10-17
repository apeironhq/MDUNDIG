import type { SessionUser } from './supabase'

/** Daftar invitation_id dari body (unik, UUID valid, maks. 500). */
export function invitationIdsParam(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw badRequest('invitation_ids harus berupa daftar.')
  const ids = [...new Set(value.map((v) => uuidParam(v, 'invitation_ids')))]
  if (ids.length > 500) throw badRequest('Maksimal 500 undangan sekaligus.')
  return ids
}

/**
 * Menyamakan akses eksplisit satu akun pelanggan dengan `ids`: yang belum ada diberikan, yang tidak dipilih dicabut.
 * Berjalan dengan klien JWT admin, jadi kebijakan RLS invitation_access (khusus admin) tetap berlaku.
 */
export async function syncUserAccess(admin: SessionUser, userId: string, ids: string[]) {
  const current = await admin.db.from('invitation_access').select('invitation_id').eq('user_id', userId)
  if (current.error) throw dbError(current.error)
  const have = new Set((current.data ?? []).map((r) => r.invitation_id as string))
  const want = new Set(ids)
  const add = ids.filter((id) => !have.has(id))
  const remove = [...have].filter((id) => !want.has(id))
  if (add.length) {
    const found = await admin.db.from('invitations').select('id').in('id', add)
    if (found.error) throw dbError(found.error)
    if ((found.data ?? []).length !== add.length) throw badRequest('Sebagian undangan tidak ditemukan. Muat ulang halaman lalu coba lagi.')
    const { error } = await admin.db.from('invitation_access')
      .insert(add.map((invitation_id) => ({ invitation_id, user_id: userId, granted_by: admin.id })))
    if (error) throw dbError(error)
  }
  if (remove.length) {
    const { error } = await admin.db.from('invitation_access').delete().eq('user_id', userId).in('invitation_id', remove)
    if (error) throw dbError(error)
  }
  for (const id of add) await audit(admin, 'access.grant', id, { user_id: userId })
  for (const id of remove) await audit(admin, 'access.revoke', id, { user_id: userId })
  return { granted: add.length, revoked: remove.length, total: ids.length }
}
