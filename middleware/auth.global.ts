export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, fetchUser } = useAuth()
  
  // Public pages
  const publicPages = ['/login', '/register']
  
  // Allow oauth page but it handles its own logic inside
  if (publicPages.includes(to.path) || to.path.startsWith('/oauth')) return

  // If user is not loaded, try to fetch
  if (!user.value) {
    // Only fetch if we have a token
    if (process.client && localStorage.getItem('token')) {
        await fetchUser()
    }
  }

  // If still not logged in, redirect to login
  if (!user.value) {
    return navigateTo('/login')
  }
})

