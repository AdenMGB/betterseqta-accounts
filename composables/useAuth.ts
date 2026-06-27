import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AUTH_FETCH } from '~/composables/useAuthFetch'

const user = ref<any>(null)
const loading = ref(false)
const error = ref('')
const refreshPromise = ref<Promise<boolean> | null>(null)

export function useAuth() {
  const router = useRouter()

  const refreshAccessToken = async () => {
    if (!process.client) return false
    if (refreshPromise.value) {
      return refreshPromise.value
    }

    refreshPromise.value = $fetch<any>('/api/auth/refresh', {
      method: 'POST',
      ...AUTH_FETCH,
    })
      .then((res) => {
        if (res?.user) {
          user.value = res.user
        }
        return true
      })
      .catch((err: any) => {
        const status = err?.status || err?.response?.status
        if (status === 401) {
          user.value = null
        }
        throw err
      })
      .finally(() => {
        refreshPromise.value = null
      })

    return refreshPromise.value
  }

  const fetchUser = async () => {
    loading.value = true
    error.value = ''
    try {
      const res = await $fetch('/api/auth/me', AUTH_FETCH)
      user.value = res
      return res
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      if (status === 401) {
        try {
          await refreshAccessToken()
          const res = await $fetch('/api/auth/me', AUTH_FETCH)
          user.value = res
          return res
        } catch (refreshErr: any) {
          const refreshStatus = refreshErr?.status || refreshErr?.response?.status
          error.value = refreshErr?.data?.error || 'Session expired.'
          if (refreshStatus === 401) {
            user.value = null
          }
          return null
        }
      }

      error.value = err?.data?.error || err?.data?.statusMessage || 'Failed to fetch user.'
      return user.value
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        ...AUTH_FETCH,
      })
    } catch {
      // Ignore errors during logout
    } finally {
      user.value = null
      router.push('/login')
      loading.value = false
    }
  }

  const isLoggedIn = () => !!user.value

  return {
    user,
    loading,
    error,
    fetchUser,
    refreshAccessToken,
    logout,
    isLoggedIn,
  }
}
