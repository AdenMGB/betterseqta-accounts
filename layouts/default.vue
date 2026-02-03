<template>
  <div class="min-h-screen w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300">
    <!-- Sidebar -->
    <div class="hidden md:flex flex-col fixed top-0 left-0 w-64 h-full p-4">
      <div class="flex items-center gap-2 mb-8 animate-slide-down">
        <UserCircleIcon class="w-8 h-8 text-primary-500" />
        <span class="text-xl font-bold text-zinc-900 dark:text-white font-display">BetterSEQTA+</span>
      </div>
      <nav class="flex flex-col gap-2 flex-1 animate-fade-in delay-100 overflow-y-auto min-h-0">
        <NuxtLink to="/" :class="getLinkClass('/')">
          <HomeIcon class="w-5 h-5" />
          Dashboard
        </NuxtLink>
        <NuxtLink to="/settings" :class="getLinkClass('/settings')">
          <Cog6ToothIcon class="w-5 h-5" />
          Settings
        </NuxtLink>
        <NuxtLink v-if="auth.user.value?.is_admin" to="/admin" :class="getLinkClass('/admin')">
          <ShieldCheckIcon class="w-5 h-5" />
          Admin
        </NuxtLink>
      </nav>
      <div class="animate-fade-in delay-200 flex-shrink-0 pt-4">
        <button @click="auth.logout" class="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-white w-full transition-all duration-200 cursor-pointer">
          <ArrowRightOnRectangleIcon class="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="md:ml-64 flex-1 flex flex-col min-h-screen relative">
       <div class="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-zinc-900 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      <!-- Header -->
      <header
        class="w-full flex items-center justify-end px-6 py-4 animate-slide-down main-header"
      >
        <div class="flex items-center gap-4">
          <button
            @click="toggleDarkMode"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            class="p-2 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300/80 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-300 hover:text-black dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900"
          >
            <SunIcon v-if="isDark" class="w-5 h-5" />
            <MoonIcon v-else class="w-5 h-5" />
          </button>
          <Menu as="div" class="relative">
            <MenuButton class="p-1 rounded-full transition-colors duration-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80">
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
              <MenuItems class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div class="p-1">
                  <MenuItem v-slot="{ active }">
                    <button @click="auth.logout" :class="[active ? 'bg-primary-500 text-white' : 'text-zinc-800 dark:text-zinc-300', 'group flex w-full items-center rounded-md px-2 py-2 text-sm']">
                      <ArrowRightOnRectangleIcon class="mr-2 h-5 w-5" />
                      Logout
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </header>
      <!-- Page Content -->
      <main class="flex-1 p-0 md:p-0 animate-fade-in delay-200">
        <slot />
      </main>
    </div>
    <Toast />
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import UserAvatar from '~/components/UserAvatar.vue'
import Toast from '~/components/ui/Toast.vue'
import { HomeIcon, Cog6ToothIcon, UserCircleIcon, ArrowRightOnRectangleIcon, SunIcon, MoonIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import MobileNav from '~/components/ui/MobileNav.vue'

const auth = useAuth()
const route = useRoute()
const isDark = ref(true)

const getLinkClass = (path: string) => {
  const isActive = route.path === path
  return [
    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
    isActive
      ? 'bg-primary-500/10 text-primary-500 font-semibold'
      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-white'
  ]
}

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

onMounted(() => {
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