// Guard UI. Otorisasi sesungguhnya tetap di server (requireUser/requireAdmin) dan RLS database.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  await auth.init()
  const isPublic = to.meta.public === true
  if (!auth.session.value) {
    if (isPublic) return
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} })
  }
  if (!auth.me.value) await auth.loadMe()
  if (to.path === '/login') return navigateTo('/')
  if (to.meta.admin === true && auth.me.value?.role !== 'admin') return navigateTo('/tidak-berhak')
})
