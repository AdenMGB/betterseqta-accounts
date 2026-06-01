<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900 px-4">
    <div class="w-full max-w-md text-center animate-fade-in">
      <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
        <p class="text-7xl font-bold text-primary-500 font-display mb-2">{{ error.statusCode }}</p>
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-white font-display mb-2">
          {{ title }}
        </h1>
        <p class="text-zinc-600 dark:text-zinc-400 mb-8">
          {{ description }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            @click="goHome"
            class="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            @click="goBack"
            class="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error.statusCode === 404)

const title = computed(() => {
  if (is404.value) return 'Page not found'
  return props.error.statusMessage || 'Something went wrong'
})

const description = computed(() => {
  if (is404.value) {
    return "The page you're looking for doesn't exist or may have been moved."
  }
  return props.error.message || 'An unexpected error occurred. Please try again.'
})

const goHome = () => clearError({ redirect: '/' })

const goBack = () => {
  clearError()
  if (import.meta.client && window.history.length > 1) {
    window.history.back()
  } else {
    navigateTo('/')
  }
}
</script>
