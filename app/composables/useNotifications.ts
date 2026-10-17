export interface NotificationItem {
  id: string; kind: 'order' | 'reservation'; title: string; body: string; link: string; read_at: string | null; created_at: string
}

// Jumlah notifikasi belum dibaca, dibagikan lonceng (topbar) & menu samping.
export function useNotifications() {
  const unread = useState('notif-unread', () => 0)
  const api = useApi()
  async function refresh() {
    try {
      unread.value = (await api.request<{ unread: number }>('/api/app/notifications/count')).unread
    } catch {
      // Gagal sesekali (mis. jaringan) tidak perlu mengganggu pengguna; angka lama dipertahankan sampai pembaruan berikutnya.
    }
  }
  async function markRead(ids: string[] | 'all') {
    await api.request('/api/app/notifications/read', { method: 'POST', body: ids === 'all' ? { all: true } : { ids } })
    await refresh()
  }
  return { unread, refresh, markRead }
}
