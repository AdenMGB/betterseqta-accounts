<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900 px-4">
    <div class="w-full max-w-md">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center animate-fade-in">
        <ShieldExclamationIcon class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 class="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Authorization Error</h2>
        <p class="text-zinc-600 dark:text-zinc-300">{{ error }}</p>
      </div>

      <!-- Consent UI -->
      <div v-else class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8 animate-fade-in">
        <div class="text-center mb-8">
            <UserCircleIcon class="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-white font-display mb-2">Authorize Access</h1>
            <p class="text-zinc-600 dark:text-zinc-400">
                <strong class="text-zinc-900 dark:text-white">{{ clientName }}</strong> wants to access your BetterSEQTA+ account.
            </p>
        </div>

        <div class="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-4 mb-8 border border-zinc-100 dark:border-zinc-700/50">
            <h3 class="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Permissions</h3>
            <ul class="space-y-3">
                <li class="flex items-start gap-3">
                    <CheckCircleIcon class="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span class="text-sm text-zinc-700 dark:text-zinc-300">Read your public profile (username, display name, avatar)</span>
                </li>
                <li class="flex items-start gap-3">
                    <CheckCircleIcon class="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span class="text-sm text-zinc-700 dark:text-zinc-300">Confirm your identity</span>
                </li>
            </ul>
        </div>

        <div class="flex flex-col gap-3">
            <button 
                @click="approve" 
                :disabled="processing"
                class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <LoadingSpinner v-if="processing" size="sm" class="mr-2" />
                Authorize
            </button>
            <button 
                @click="deny" 
                :disabled="processing"
                class="w-full py-3 px-4 bg-transparent border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200"
            >
                Cancel
            </button>
        </div>
        
        <div class="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Signed in as <span class="font-medium text-zinc-600 dark:text-zinc-300">{{ auth.user.value?.username }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { ShieldExclamationIcon, CheckCircleIcon, UserCircleIcon } from '@heroicons/vue/24/solid'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const loading = ref(true)
const processing = ref(false)
const error = ref('')
const clientName = ref('')

const clientId = route.query.client_id as string
const redirectUri = route.query.redirect_uri as string

const approve = async () => {
    processing.value = true
    try {
        const res = await $fetch<{ redirectUrl: string }>('/api/oauth/approve', {
            method: 'POST',
            body: { client_id: clientId, redirect_uri: redirectUri },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        window.location.href = res.redirectUrl
    } catch (e) {
        error.value = 'Failed to authorize request.'
        processing.value = false
    }
}

const deny = () => {
    if (redirectUri) {
        const url = new URL(redirectUri)
        url.searchParams.set('error', 'access_denied')
        window.location.href = url.toString()
    } else {
        router.push('/')
    }
}

onMounted(async () => {
    // 1. Check Params
    if (!clientId || !redirectUri) {
        error.value = 'Missing client_id or redirect_uri parameters.'
        loading.value = false
        return
    }

    // 2. Check Auth
    if (!auth.isLoggedIn()) {
        await auth.fetchUser() // Try to restore session
        if (!auth.isLoggedIn()) {
            router.push({ 
                path: '/login', 
                query: { redirect: route.fullPath } 
            })
            return
        }
    }

    // 3. Fetch Client Info
    try {
        const client = await $fetch<{ name: string }>('/api/oauth/client', {
            params: { client_id: clientId }
        })
        clientName.value = client.name
    } catch (e) {
        error.value = 'Invalid Client ID.'
    } finally {
        loading.value = false
    }
})
</script>

