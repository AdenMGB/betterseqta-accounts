export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, fetchUser } = useAuth()
  
  // Public pages - these don't require authentication
  const publicPages = ['/login', '/register', '/reset-password']
  
  // Allow oauth page but it handles its own logic inside
  // Check exact path match (without query params) for public pages
  const pathWithoutQuery = to.path.split('?')[0]
  if (publicPages.includes(pathWithoutQuery) || to.path.startsWith('/oauth')) {
    return // Early return for public pages - no auth check needed
  }

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

