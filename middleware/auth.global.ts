export default defineNuxtRouteMiddleware(async (to, from) => {
  // Public pages - these don't require authentication
  // Check BEFORE calling useAuth() to avoid any side effects
  const publicPages = ['/login', '/register', '/reset-password']
  
  // In Nuxt/Vue Router, to.path doesn't include query params
  // So we can check directly
  if (publicPages.includes(to.path) || to.path.startsWith('/oauth')) {
    return // Early return for public pages - no auth check needed
  }

  // Only call useAuth() for protected pages
  const { user, fetchUser } = useAuth()

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

