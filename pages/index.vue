<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all duration-200"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.1 } }"
    >
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Welcome</span>
      </div>
      <p class="text-gray-700 dark:text-gray-200">Hello, <span class="font-medium text-primary-500">{{ auth.user.value?.email || 'User' }}</span>!</p>
    </motion-div>
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all duration-200 animate-pulse"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.2 } }"
    >
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M3 6h18M3 18h18"/></svg>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Widget Placeholder</span>
      </div>
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
    </motion-div>
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all duration-200 animate-pulse"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.3 } }"
    >
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Another Card</span>
      </div>
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
    </motion-div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const router = useRouter()

onMounted(async () => {
  await auth.fetchUser()
  if (!auth.user.value) {
    router.push('/login')
  }
})
</script>
