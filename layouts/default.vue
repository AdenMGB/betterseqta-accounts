<template>
  <div class="min-h-screen flex bg-white dark:bg-gray-900 transition-colors duration-200">
    <!-- Sidebar -->
    <motion-div
      class="hidden md:flex flex-col w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 gap-4 transition-all duration-200"
      :initial="{ x: -40, opacity: 0 }"
      :enter="{ x: 0, opacity: 1, transition: { duration: 0.4 } }"
    >
      <div class="flex items-center gap-2 mb-8">
        <svg class="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
        <span class="text-xl font-semibold text-gray-900 dark:text-white">BetterSEQTA+ Account</span>
      </div>
      <nav class="flex flex-col gap-2">
        <a href="#" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M3 6h18M3 18h18"/></svg>
          Dashboard
        </a>
        <a href="#" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
          Placeholder
        </a>
      </nav>
      <div class="mt-auto flex flex-col gap-2">
        <button class="w-full px-4 py-2 rounded-lg bg-primary-500 text-white font-medium transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">Logout</button>
      </div>
    </motion-div>
    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-h-screen">
      <!-- Header -->
      <motion-div
        class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200"
        :initial="{ y: -20, opacity: 0 }"
        :enter="{ y: 0, opacity: 1, transition: { duration: 0.4 } }"
      >
        <div class="flex items-center gap-2">
          <svg class="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
          <span class="text-lg font-semibold text-gray-900 dark:text-white">BetterSEQTA+ Account</span>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="toggleDarkMode"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <span v-if="isDark">
              <!-- Sun Icon -->
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41"/></svg>
            </span>
            <span v-else>
              <!-- Moon Icon -->
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            </span>
          </button>
          <div class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse"></div>
          <span class="text-gray-700 dark:text-gray-200 font-medium">User</span>
        </div>
      </motion-div>
      <!-- Page Content -->
      <main class="flex-1 p-6 md:p-10 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isDark = ref(false)

const updateDarkMode = () => {
  isDark.value = document.documentElement.classList.contains('dark')
}

const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  // Set initial theme from localStorage or system preference
  const theme = localStorage.getItem('theme')
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
    isDark.value = true
  } else {
    document.documentElement.classList.remove('dark')
    isDark.value = false
  }
})
</script> 