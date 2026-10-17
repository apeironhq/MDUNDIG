import { RE } from '../../../../lib/contract'

// Pemetaan owner_id (dikirim WordPress) → akun pelanggan, per website.
// Hanya owner_id yang sudah pernah diterima dari WordPress yang dapat dipetakan (mencegah salah ketik).
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readJson(event)
  const websiteId = uuidParam(body.website_id, 'website_id')
  const userId = uuidParam(body.user_id, 'user_id')
  const owner = typeof body.external_owner_id === 'string' ? body.external_owner_id.trim() : ''
  if (!RE.ownerId.test(owner)) throw badRequest('ID pemilik tidak valid.')
  const known = await user.db.from('invitations').select('id').eq('website_id', websiteId).eq('owner_external_id', owner).limit(1)
  if (known.error) throw dbError(known.error)
  if (!known.data?.length) throw badRequest('ID pemilik ini belum pernah dikirim WordPress untuk website tersebut.')
  const { data, error } = await user.db.from('owner_mappings')
    .insert({ website_id: websiteId, external_owner_id: owner, user_id: userId, created_by: user.id })
    .select('id').single()
  if (error) throw dbError(error)
  await audit(user, 'mapping.create', data.id, { website_id: websiteId, user_id: userId })
  setResponseStatus(event, 201)
  return data
})
