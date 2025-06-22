<template>
  <div class="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 transition-colors duration-200">
    <div v-if="auth.user.value" class="w-full max-w-md p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700">
      <div class="flex items-center gap-2 mb-6">
        <UserCircleIcon class="w-8 h-8 text-primary-500" />
        <h1 class="text-2xl font-semibold text-zinc-900 dark:text-white font-display">API Access Token</h1>
      </div>
      
      <div class="mb-6">
        <p class="text-lg text-zinc-700 dark:text-zinc-200 font-medium mb-4">Generate an access token to authorize third-party applications to access your BetterSEQTA+ account.</p>
        
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">What apps can do with this token:</h3>
          <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Access your profile information</li>
            <li>• Upload and manage your files</li>
            <li>• Send and receive messages</li>
            <li>• Manage your friend connections</li>
            <li>• View your account statistics</li>
          </ul>
        </div>
        
        <p class="text-sm text-zinc-500 dark:text-zinc-400">You are logged in as <span class="font-medium text-primary-500">{{ auth.user.value.email }}</span>.</p>
      </div>
      
      <button
        @click="onAuthorize"
        class="w-full bg-primary-500 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="loading"
      >
        <span v-if="loading" class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Generating Token...
        </span>
        <span v-else>Generate Access Token</span>
      </button>
      
      <div v-if="error" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
      </div>
      
      <div v-if="token" class="mt-4 p-4 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
        <div class="font-semibold mb-2 text-zinc-900 dark:text-white">Your Access Token:</div>
        <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-2">Share this token with the app you want to authorize. Keep it secure and don't share it publicly.</p>
        <code class="text-sm text-zinc-800 dark:text-zinc-200 break-all bg-zinc-200 dark:bg-zinc-600 px-2 py-1 rounded block">{{ token }}</code>
      </div>
    </div>
    
    <div v-else class="flex items-center justify-center">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useRouter } from 'vue-router'
import { UserCircleIcon } from '@heroicons/vue/24/outline'

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