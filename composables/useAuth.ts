import { ref } from 'vue'
import { useRouter } from 'vue-router'

const user = ref<any>(null)
const loading = ref(false)
const error = ref('')
const accessToken = ref<string | null>(null)
const refreshPromise = ref<Promise<string | null> | null>(null)

function getStoredToken() {
  if (!process.client) return null
  return accessToken.value || localStorage.getItem('token')
}

function setStoredToken(token: string | null) {
  accessToken.value = token
  if (!process.client) return
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function useAuth() {
  const router = useRouter()

  const refreshAccessToken = async () => {
    if (!process.client) return null
    if (refreshPromise.value) {
      return refreshPromise.value
    }

    refreshPromise.value = $fetch<any>('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => {
        const nextToken = res?.token || null
        if (nextToken) {
          setStoredToken(nextToken)
        }
        if (res?.user) {
          user.value = res.user
        }
        return nextToken
      })
      .catch((err: any) => {
        const status = err?.status || err?.response?.status
        if (status === 401) {
          setStoredToken(null)
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
      let token = getStoredToken()
      if (!token) {
        token = await refreshAccessToken().catch(() => null)
      }
      if (!token) {
        user.value = null
        return null
      }

      const res = await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      user.value = res
      return res
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      if (status === 401) {
        try {
          const refreshedToken = await refreshAccessToken()
          if (!refreshedToken) {
            user.value = null
            return null
          }
          const res = await $fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${refreshedToken}` },
            credentials: 'include',
          })
          user.value = res
          return res
        } catch (refreshErr: any) {
          const refreshStatus = refreshErr?.status || refreshErr?.response?.status
          error.value = refreshErr?.data?.error || 'Session expired.'
          if (refreshStatus === 401) {
            setStoredToken(null)
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
      const token = getStoredToken()
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch (e) {
      // Ignore errors during logout
    } finally {
      setStoredToken(null)
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
    accessToken,
    fetchUser,
    refreshAccessToken,
    setStoredToken,
    logout,
    isLoggedIn,
  }
}
