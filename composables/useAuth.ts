import { ref } from 'vue'
import { useRouter } from 'vue-router'

const user = ref<any>(null)
const loading = ref(false)
const error = ref('')

export function useAuth() {
  const router = useRouter()

  const fetchUser = async () => {
    loading.value = true
    error.value = ''
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        user.value = null
        return
      }
      const res = await $fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      user.value = res
    } catch (err: any) {
      user.value = null
      error.value = err?.data?.statusMessage || 'Failed to fetch user.'
    } finally {
      loading.value = false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    user.value = null
    router.push('/login')
  }

  const isLoggedIn = () => !!user.value

  return { user, loading, error, fetchUser, logout, isLoggedIn }
} 