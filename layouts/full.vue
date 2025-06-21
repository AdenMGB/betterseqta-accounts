<template>
  <div class="min-h-screen flex bg-white dark:bg-gray-900 transition-colors duration-200">
    <!-- Sidebar -->
    <div
      class="hidden md:flex flex-col w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 gap-4 transition-all duration-200"
    >
      <div class="flex items-center gap-2 mb-8">
        <UserCircleIcon class="w-8 h-8 text-primary-500" />
        <span class="text-xl font-semibold text-gray-900 dark:text-white">BetterSEQTA+ Account</span>
      </div>
      <nav class="flex flex-col gap-2 flex-1">
        <NuxtLink to="/" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <HomeIcon class="w-5 h-5" />
          Dashboard
        </NuxtLink>
        <NuxtLink to="/settings" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <Cog6ToothIcon class="w-5 h-5" />
          Settings
        </NuxtLink>
        <NuxtLink to="/friends" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <UserGroupIcon class="w-5 h-5" />
          Friends
        </NuxtLink>
        <NuxtLink to="/messages" class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white transition-all duration-200">
          <ChatBubbleLeftRightIcon class="w-5 h-5" />
          Messages
        </NuxtLink>
      </nav>
    </div>
    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-h-screen">
      <!-- Header -->
      <div
        class="w-full flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200"
      >
        <div class="flex items-center gap-2">
          <UserCircleIcon class="w-8 h-8 text-primary-500" />
          <span class="text-lg font-semibold text-gray-900 dark:text-white">BetterSEQTA+ Account</span>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="toggleDarkMode"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-primary-500 hover:text-white dark:hover:bg-primary-500 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <span v-if="isDark">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41"/></svg>
            </span>
            <span v-else>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            </span>
          </button>
          <Menu as="div" class="relative">
            <MenuButton class="p-1 rounded-full transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700">
              <UserAvatar v-if="auth.user.value" :user="auth.user.value" />
            </MenuButton>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems class="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div class="px-1 py-1">
                  <MenuItem v-slot="{ active }">
                    <button @click="auth.logout" :class="[active ? 'bg-primary-500 text-white' : 'text-gray-900 dark:text-white', 'group flex w-full items-center rounded-md px-2 py-2 text-sm']">
                      <ArrowRightOnRectangleIcon class="mr-2 h-5 w-5" />
                      Logout
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
      <!-- Page Content -->
      <main class="flex-1 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <slot />
      </main>
    </div>
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import UserAvatar from '~/components/UserAvatar.vue'
import Toast from '~/components/ui/Toast.vue'
import { HomeIcon, Cog6ToothIcon, UserCircleIcon, UserGroupIcon, ChatBubbleLeftRightIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

const auth = useAuth()
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