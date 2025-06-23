<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="w-full max-w-md animate-fade-in">
      <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display">Create Account</h1>
          <p class="text-zinc-600 dark:text-zinc-400">Join BetterSEQTA+ and start connecting</p>
        </div>
        <form @submit.prevent="onSubmit" class="space-y-6">
          <div>
            <label for="displayName" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Display Name</label>
            <div class="mt-1">
        <input
          v-model="displayName"
                id="displayName"
                name="displayName"
          type="text"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your display name"
              >
            </div>
          </div>

          <div>
            <label for="username" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Username</label>
            <div class="mt-1">
        <input
          v-model="username"
                id="username"
                name="username"
          type="text"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Choose a username"
              >
            </div>
          </div>

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
                placeholder="Enter your email"
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
                placeholder="Create a password"
              >
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Confirm Password</label>
            <div class="mt-1">
              <input
                v-model="confirmPassword"
                id="confirmPassword"
                name="confirmPassword"
          type="password"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Confirm your password"
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
              <span v-else>Create Account</span>
        </button>
          </div>
        </form>
        <div class="mt-6 text-center">
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?
            <NuxtLink to="/login" class="font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

definePageMeta({ layout: false })

const displayName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

const onSubmit = async () => {
  error.value = ''
  loading.value = true
  
  // Check if passwords match
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    loading.value = false
    return
  }
  
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value, username: username.value, displayName: displayName.value },
    })
    router.push('/login')
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Registration failed.'
  } finally {
    loading.value = false
  }
}
</script> 