<template>
  <div class="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300">
    <Sidebar />

    <!-- Main Content -->
    <div class="relative z-10 flex-1 flex flex-col min-h-screen min-w-0 w-full">
      <MouseGlowBackground />

      <!-- Header -->
      <header
        class="w-full min-w-0 flex items-center justify-end px-4 sm:px-6 md:pl-20 py-4 animate-slide-down main-header"
      >
        <div class="flex items-center gap-4 min-w-0">
          <button
            @click="toggleDarkMode"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            class="p-2 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300/80 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900"
          >
            <SunIcon v-if="isDark" class="w-5 h-5" />
            <MoonIcon v-else class="w-5 h-5" />
          </button>
          <UserAvatar v-if="auth.user.value" :user="auth.user.value" />
        </div>
      </header>
      <!-- Page Content -->
      <main class="flex-1 w-full min-w-0 overflow-x-hidden px-4 sm:px-6 lg:px-8 md:pl-20 py-4 sm:py-6 pb-24 md:pb-8">
        <slot />
      </main>
    </div>
    <Toast />
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import UserAvatar from '~/components/UserAvatar.vue'
import Toast from '~/components/ui/Toast.vue'
import Sidebar from '~/components/ui/Sidebar.vue'
import MouseGlowBackground from '~/components/ui/MouseGlowBackground.vue'
import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline'
import MobileNav from '~/components/ui/MobileNav.vue'

const auth = useAuth()
const isDark = ref(true)

const toggleDarkMode = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(async () => {
  // Ensure user is loaded
  if (process.client && localStorage.getItem('token') && !auth.user.value) {
    await auth.fetchUser()
  }
  
  const theme = localStorage.getItem('theme')
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
})
</script>
