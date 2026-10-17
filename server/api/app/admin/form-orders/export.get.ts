import { formatWib, toCsv } from '../../../../lib/csv'
import { ORDER_STATUS } from '../../../../lib/reports'

// CSV Form Order khusus admin. Header = label field, key internal dipertahankan dalam kurung.
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const orders = await fetchOrdersForExport(event, user)
  const keys: string[] = []
  const labelOf = new Map<string, string>()
  for (const o of orders) {
    for (const key of Object.keys(o.fields)) {
      if (!labelOf.has(key)) { keys.push(key); labelOf.set(key, o.labels[key] || key) }
    }
  }
  const header = ['Waktu (WIB)', 'Status', 'Website', 'Halaman', 'ID Post', 'ID Permintaan',
    ...keys.map((k) => (labelOf.get(k) === k ? k : `${labelOf.get(k)} (${k})`))]
  const rows = orders.map((o) => [formatWib(o.created_at), ORDER_STATUS[o.status] ?? o.status, o.site, o.post_title, o.post_id, o.request_id,
    ...keys.map((k) => { const v = o.fields[k]; return Array.isArray(v) ? v.join(', ') : (v ?? '') })])
  return sendCsv(event, `order-undangan-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows))
})
