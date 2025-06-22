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
            <label for="email" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Email</label>
            <div class="mt-1">
              <input
                v-model="email"
                id="email"
                name="email"
                type="email"
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

const email = ref('')
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
      body: { email: email.value, password: password.value },
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
</script> 