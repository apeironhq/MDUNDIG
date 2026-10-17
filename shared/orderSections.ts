/**
 * Penyusunan isi Order Undangan untuk tampilan manusia (murni, dipakai server & dashboard).
 * Label dari widget Form Order berpola "Pria: Nama Lengkap", "Akad — Waktu", "Nomor Rekening 1", dst.
 */
export interface OrderEntry { key: string; label: string; value: string | string[] }
export interface OrderField extends OrderEntry { field: string; empty: boolean }
export interface OrderSection { title: string; fields: OrderField[] }

export const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)

export function displayValue(v: string | string[]): string {
  return Array.isArray(v) ? v.join(', ') : v
}

export function splitLabel(key: string, label: string): { section: string; field: string } {
  const bank = /^bank_(name|account|owner)_(\d+)$/.exec(key)
  if (bank) return { section: `Rekening ${bank[2]}`, field: label.replace(/\s*\d+$/, '') }
  const colon = /^(.{1,40}?):\s+(.+)$/.exec(label)
  if (colon) return { section: colon[1]!.trim(), field: colon[2]!.trim() }
  const dash = /^(.{1,40}?)\s+[—–-]\s+(.+)$/.exec(label)
  if (dash) return { section: dash[1]!.trim(), field: dash[2]!.trim() }
  if (key.startsWith('customer_') || key === 'invitation_side') return { section: 'Pemesan', field: label }
  return { section: 'Lainnya', field: label }
}

const SECTION_ORDER = ['Pemesan', 'Pria', 'Wanita', 'Akad', 'Resepsi', 'Ngunduh Mantu']
const FIELD_ORDER = ['customer_name', 'customer_phone', 'customer_email', 'invitation_side', 'full_name', 'nickname', 'child_order', 'father', 'mother',
  'domicile', 'phone', 'instagram', 'date', 'time', 'address', 'maps', 'bank_name', 'bank_account', 'bank_owner']

function fieldRank(key: string): number {
  const i = FIELD_ORDER.findIndex((s) => key === s || key.endsWith('_' + s) || key.startsWith(s))
  return i === -1 ? FIELD_ORDER.length : i
}

function sectionRank(title: string): number {
  const i = SECTION_ORDER.indexOf(title)
  if (i !== -1) return i
  if (title.startsWith('Rekening')) return 100 + Number(title.replace(/\D/g, '') || 0)
  if (title === 'Lainnya') return 1000
  return 50
}

export function groupOrderEntries(entries: OrderEntry[]): OrderSection[] {
  const map = new Map<string, OrderField[]>()
  for (const e of entries) {
    const { section, field } = splitLabel(e.key, e.label)
    const list = map.get(section) ?? []
    list.push({ ...e, field, empty: isEmptyValue(e.value) })
    map.set(section, list)
  }
  return [...map.entries()]
    .map(([title, fields]) => ({ title, fields: fields.sort((a, b) => fieldRank(a.key) - fieldRank(b.key) || a.field.localeCompare(b.field, 'id')) }))
    .sort((a, b) => sectionRank(a.title) - sectionRank(b.title) || a.title.localeCompare(b.title, 'id'))
}

/** Ringkasan satu baris: pemesan & mempelai dulu, lalu field terisi lainnya. Field kosong dilewati. */
export function orderSummary(entries: OrderEntry[], max = 3): string {
  const byKey = new Map(entries.map((e) => [e.key, e]))
  const parts: string[] = []
  const used = new Set<string>()
  const pick = (keys: string[], label: string) => {
    for (const k of keys) {
      const e = byKey.get(k)
      if (e && !isEmptyValue(e.value)) { parts.push(`${label}: ${displayValue(e.value)}`); used.add(k); return }
    }
  }
  pick(['customer_name'], 'Pemesan')
  pick(['groom_nickname', 'groom_full_name'], 'Pria')
  pick(['bride_nickname', 'bride_full_name'], 'Wanita')
  for (const e of entries) {
    if (parts.length >= max) break
    if (used.has(e.key) || isEmptyValue(e.value)) continue
    parts.push(`${splitLabel(e.key, e.label).field}: ${displayValue(e.value)}`)
  }
  return parts.slice(0, max).join(' · ')
}

export function filledCount(entries: OrderEntry[]): number {
  return entries.filter((e) => !isEmptyValue(e.value)).length
}
