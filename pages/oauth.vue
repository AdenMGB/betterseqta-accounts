<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 transition-colors duration-200">
    <div v-if="auth.user.value" class="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h1 class="text-2xl font-semibold text-center mb-6 text-gray-900 dark:text-white">Authorize Application</h1>
      <div class="mb-6 text-center">
        <p class="text-lg text-gray-700 dark:text-gray-200 font-medium">App <span class="text-primary-500">ExampleApp</span> is requesting access to your BetterSEQTA+ Account.</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">You are logged in as <span class="font-medium text-primary-500">{{ auth.user.value.email }}</span>.</p>
      </div>
      <button
        @click="onAuthorize"
        class="w-full bg-primary-500 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        :disabled="loading"
      >
        <span v-if="loading">Authorizing...</span>
        <span v-else>Authorize</span>
      </button>
      <div v-if="token" class="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-sm break-all">
        <div class="font-semibold mb-2">Access Token:</div>
        <code>{{ token }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useRouter } from 'vue-router'

const auth = useAuth()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const token = ref('')

onMounted(async () => {
  await auth.fetchUser()
  if (!auth.user.value) {
    router.push('/login?redirect=/oauth')
  }
})

const onAuthorize = async () => {
  error.value = ''
  token.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    token.value = res.access_token
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Authorization failed.'
  } finally {
    loading.value = false
  }
}
</script> 