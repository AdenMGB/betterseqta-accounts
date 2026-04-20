<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

definePageMeta({ layout: false })

const router = useRouter()
const route = useRoute()
const auth = useAuth()
const error = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
  const token = route.query.token as string | undefined
  
  if (!token) {
    error.value = 'No token received from Discord login.'
    loading.value = false
    setTimeout(() => {
      router.push('/login')
    }, 3000)
    return
  }

  try {
    auth.setStoredToken(token)
    await auth.fetchUser()
    
    // Redirect to the post-login destination, or home
    const redirect = route.query.redirect as string || '/'
    router.replace(redirect)
  } catch (err: any) {
    console.error('Discord login error:', err)
    error.value = 'Failed to complete Discord login. Please try again.'
    loading.value = false
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="text-center">
      <div v-if="loading" class="space-y-4">
        <LoadingSpinner size="lg" />
        <p class="text-zinc-600 dark:text-zinc-400">Completing Discord login...</p>
      </div>
      <div v-else-if="error" class="space-y-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p class="text-red-500 dark:text-red-400">{{ error }}</p>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">Redirecting to login page...</p>
      </div>
    </div>
  </div>
</template> 