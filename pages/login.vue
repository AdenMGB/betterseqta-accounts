<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="w-full max-w-md animate-fade-in">
      <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display">Welcome Back</h1>
          <p class="text-zinc-600 dark:text-zinc-400">Sign in to your BetterSEQTA+ Account</p>
        </div>
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div>
            <label for="login" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Email or Username</label>
            <div class="mt-1">
              <input
                v-model="login"
                id="login"
                name="login"
                type="text"
                required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Password</label>
            <div class="mt-1">
              <input
                v-model="password"
                id="password"
                name="password"
                type="password"
                required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
              >
            </div>
          </div>

          <div v-if="error" class="text-red-500 dark:text-red-400 text-sm text-center">
            {{ error }}
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:bg-primary-500/50 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
            >
              <LoadingSpinner v-if="loading" size="sm" />
              <span v-else>Sign In</span>
            </button>
          </div>
        </form>
        <div class="mt-4 flex flex-col items-center gap-2">
          <button
            @click="loginWithDiscord"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#5865F2] text-white font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2"
          >
            <span class="w-5 h-5 inline-block" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.8732.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1835 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1835 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
            </span>
            Sign in with Discord
          </button>
        </div>
        <div class="mt-6 text-center">
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Don't have an account?
            <NuxtLink to="/register" class="font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400">
              Sign up
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

definePageMeta({ layout: false })

const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()
const route = useRoute()

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const res: any = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { login: login.value, password: password.value },
    })
    if (res.token) {
      localStorage.setItem('token', res.token)
      const redirect = route.query.redirect as string || '/'
      router.push(redirect)
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'An unknown error occurred'
  } finally {
    loading.value = false
  }
}

const loginWithDiscord = () => {
  window.location.href = '/api/oauth/discord'
}
</script> 