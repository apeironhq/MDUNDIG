import { describe, expect, it } from 'vitest'
import { groupOrderEntries, orderSummary, splitLabel } from '../../shared/orderSections'

// Label sesuai data nyata widget Form Order (Pria:/Wanita:, Akad —, Nama Bank 1, …)
const entries = [
  { key: 'akad_date', label: 'Akad — Hari/Tanggal', value: '' },
  { key: 'akad_time', label: 'Akad — Waktu', value: '08:00' },
  { key: 'bank_name_1', label: 'Nama Bank 1', value: 'BCA' },
  { key: 'bank_account_1', label: 'Nomor Rekening 1', value: '0012' },
  { key: 'bride_phone', label: 'Wanita: No. WhatsApp', value: '0857' },
  { key: 'groom_phone', label: 'Pria: No. WhatsApp', value: '0857' },
  { key: 'bride_full_name', label: 'Wanita: Nama Lengkap', value: 'Sari Dewi' },
  { key: 'groom_full_name', label: 'Pria: Nama Lengkap', value: 'Budi Santoso' },
  { key: 'groom_nickname', label: 'Pria: Nama Panggilan', value: 'Budi' },
  { key: 'customer_name', label: 'Nama Pemesan', value: 'Rina' },
  { key: 'invitation_side', label: 'Undangan dari pihak', value: 'pria' },
  { key: 'music_title', label: 'Musik/Judul Lagu', value: '' },
  { key: 'addons', label: 'Tambahan', value: ['musik', 'galeri'] },
]

describe('orderSections', () => {
  it('memisahkan bagian & nama field', () => {
    expect(splitLabel('bride_phone', 'Wanita: No. WhatsApp')).toEqual({ section: 'Wanita', field: 'No. WhatsApp' })
    expect(splitLabel('akad_time', 'Akad — Waktu')).toEqual({ section: 'Akad', field: 'Waktu' })
    expect(splitLabel('bank_account_1', 'Nomor Rekening 1')).toEqual({ section: 'Rekening 1', field: 'Nomor Rekening' })
    expect(splitLabel('customer_name', 'Nama Pemesan')).toEqual({ section: 'Pemesan', field: 'Nama Pemesan' })
    expect(splitLabel('music_title', 'Musik/Judul Lagu')).toEqual({ section: 'Lainnya', field: 'Musik/Judul Lagu' })
  })
  it('urutan bagian & field rapi: Pemesan, Pria, Wanita, Akad, Rekening, Lainnya; nama sebelum kontak', () => {
    const g = groupOrderEntries(entries)
    expect(g.map((s) => s.title)).toEqual(['Pemesan', 'Pria', 'Wanita', 'Akad', 'Rekening 1', 'Lainnya'])
    expect(g[1]!.fields.map((f) => f.field)).toEqual(['Nama Lengkap', 'Nama Panggilan', 'No. WhatsApp'])
    expect(g[3]!.fields.find((f) => f.key === 'akad_date')!.empty).toBe(true)
  })
  it('ringkasan satu baris mendahulukan pemesan & mempelai, melewati field kosong', () => {
    expect(orderSummary(entries)).toBe('Pemesan: Rina · Pria: Budi · Wanita: Sari Dewi')
    expect(orderSummary([{ key: 'x', label: 'Akad — Waktu', value: '' }, { key: 'y', label: 'Paket', value: 'Gold' }])).toBe('Paket: Gold')
  })
})
