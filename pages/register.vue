<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-800 transition-colors duration-200">
    <div class="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h1 class="text-2xl font-semibold text-center mb-6 text-gray-900 dark:text-white">Register</h1>
      <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200"
          required
        />
        <button
          type="submit"
          class="bg-primary-500 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          :disabled="loading"
        >
          <span v-if="loading">Loading...</span>
          <span v-else>Register</span>
        </button>
        <p v-if="error" class="text-red-500 text-sm flex items-center gap-2 mt-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg>
          {{ error }}
        </p>
      </form>
      <div class="mt-4 text-center">
        <NuxtLink to="/login" class="text-primary-500 hover:underline transition-colors duration-200">Already have an account? Login</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

const onSubmit = async () => {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    router.push('/login')
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Registration failed.'
  } finally {
    loading.value = false
  }
}
</script> 