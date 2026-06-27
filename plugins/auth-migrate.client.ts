export default defineNuxtPlugin(async () => {
  if (!process.client) return

  const legacyToken = localStorage.getItem('token')
  if (!legacyToken) return

  try {
    await $fetch('/api/auth/migrate-session', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${legacyToken}` },
    })
  } catch {
    // Invalid or expired legacy token — drop it below.
  } finally {
    localStorage.removeItem('token')
  }
})
