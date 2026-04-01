export default defineNuxtRouteMiddleware(async (to, from) => {
  // Public pages - these don't require authentication
  // Check BEFORE calling useAuth() to avoid any side effects
  const publicPages = ['/login', '/register', '/reset-password']
  
  // Normalize path (remove trailing slashes and query params)
  const normalizedPath = to.path.split('?')[0].replace(/\/$/, '')
  
  // Early return for public pages - no auth check needed
  // Allow OAuth and auth callback pages (e.g., /oauth/authorize, /auth/discord/callback)
  if (publicPages.includes(normalizedPath) || to.path.startsWith('/oauth') || to.path.startsWith('/auth')) {
    return
  }

  // Only run auth checks on client side
  if (!process.client) {
    return
  }

  // Only call useAuth() for protected pages
  const { user, fetchUser } = useAuth()

  // If user is not loaded, try to restore or refresh the session
  if (!user.value) {
    await fetchUser()
  }

  // If still not logged in, redirect to login
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})

