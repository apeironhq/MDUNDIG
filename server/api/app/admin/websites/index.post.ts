import { normalizeSiteUrl } from '../../../../lib/contract'

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const body = await readJson(event)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const siteUrl = typeof body.site_url === 'string' ? normalizeSiteUrl(body.site_url) : null
  if (!name || name.length > 120) throw badRequest('Nama website wajib diisi (maksimal 120 karakter).')
  if (!siteUrl) throw badRequest('URL website tidak valid. Gunakan alamat beranda WordPress, misalnya https://domain.com/.')
  const { data, error } = await user.db.from('websites')
    .insert({ name, site_url: siteUrl, created_by: user.id })
    .select('id, name, site_url, external_site_id, bound_at, status, created_at').single()
  if (error) throw dbError(error)
  await audit(user, 'website.create', data.id, { site_url: siteUrl })
  setResponseStatus(event, 201)
  return data
})
