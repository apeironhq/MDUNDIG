// URL yang ditempel ke konektor ApeironKit. Bukan rahasia; tetap khusus admin.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const base = appBaseUrl(event)
  return {
    daftar_hadiah_url: `${base}/api/daftar-hadiah`,
    form_order_url: `${base}/api/form-order`,
    https: base.startsWith('https://'),
  }
})
