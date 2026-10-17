/**
 * WhatsApp (murni, dipakai server & dashboard).
 * - Normalisasi nomor sama seperti plugin (DaftarHadiahController): 08… → 628…, tanpa spasi/tanda.
 * - Pesan akses akun pelanggan yang rapi (format tebal WhatsApp *…*) + tautan wa.me.
 */
const WHATSAPP_RE = /^[1-9][0-9]{7,14}$/

export function normalizeWhatsapp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\+?[0-9\s().-]+$/.test(value.trim())) return null
  let phone = value.trim().replace(/^\+/, '').replace(/[\s().-]/g, '')
  if (phone.startsWith('0')) phone = '62' + phone.slice(1)
  return WHATSAPP_RE.test(phone) ? phone : null
}

/** 6281234567890 → 0812-3456-7890 (tampilan). */
export function formatWhatsapp(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const local = digits.startsWith('62') ? '0' + digits.slice(2) : digits
  return local.length < 9 ? local : `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`
}

export interface AccessMessageInput {
  name: string
  username: string
  /** null = password tidak dikirim ulang (pelanggan memakai password yang sudah diberikan). */
  password: string | null
  loginUrl: string
  invitationTitle?: string | null
  sender?: string | null
}

/** Pesan akses untuk pelanggan: sapaan, data akun, tautan masuk, panduan singkat, pengingat keamanan. */
export function buildAccessMessage(i: AccessMessageInput): string {
  const name = i.name.trim() || i.username
  const lines = [
    `Halo, *${name}* 👋`,
    '',
    i.invitationTitle
      ? `Terima kasih telah mempercayakan undangan digital Anda kepada kami. Berikut akun untuk melihat *Daftar Hadiah* undangan *${i.invitationTitle}*:`
      : 'Terima kasih telah mempercayakan undangan digital Anda kepada kami. Berikut akun untuk melihat *Daftar Hadiah* undangan Anda:',
    '',
    `👤 *Username:* ${i.username}`,
    i.password ? `🔑 *Password:* ${i.password}` : '🔑 *Password:* sama seperti yang sudah kami berikan sebelumnya',
    '',
    '🔗 *Masuk di sini:*',
    i.loginUrl,
    '',
    'Setelah masuk, Anda dapat melihat hadiah yang dipilih tamu beserta ucapannya, dan mengunduh laporannya (PDF/CSV).',
    '',
    '🔒 Demi keamanan, mohon simpan pesan ini dan jangan bagikan kepada orang lain. Password dapat diganti kapan saja di menu *Profil* setelah masuk.',
    '',
    'Terima kasih 🙏',
  ]
  if (i.sender?.trim()) lines.push(`*${i.sender.trim()}*`)
  return lines.join('\n')
}

/** Tautan wa.me yang membuka chat ke nomor tersebut dengan pesan terisi. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
