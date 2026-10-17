// Statistik dashboard (satu panggilan database). RLS membatasi pelanggan ke datanya sendiri;
// bagian admin (order, website, audit) hanya dikembalikan untuk admin platform.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const days = Number(getQuery(event).days)
  const { data, error } = await user.db.rpc('dashboard_stats', { p_days: [7, 14, 30, 90].includes(days) ? days : 7 })
  if (error) throw dbError(error)
  return data
})
