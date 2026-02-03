<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 flex justify-around items-center h-16 sm:hidden">
    <NuxtLink to="/" class="flex flex-col items-center justify-center flex-1" :class="isActive('/')">
      <HomeIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Home</span>
    </NuxtLink>
    <NuxtLink to="/settings" class="flex flex-col items-center justify-center flex-1" :class="isActive('/settings')">
      <Cog6ToothIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Settings</span>
    </NuxtLink>
    <NuxtLink v-if="isAdmin" to="/admin" class="flex flex-col items-center justify-center flex-1" :class="isActive('/admin')">
      <KeyIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Admin</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { HomeIcon, Cog6ToothIcon, KeyIcon } from '@heroicons/vue/24/outline'

// Computed property to check if user is admin
const isAdmin = computed(() => {
  return auth.user.value && (auth.user.value?.admin_level ?? 0) > 0
})

const route = useRoute()
const auth = useAuth()
const isActive = (path: string) => {
  // Exact match for home, startsWith for others to handle sub-routes if any
  if (path === '/') return route.path === '/' ? 'text-primary-500' : 'text-zinc-500 dark:text-zinc-400'
  return route.path.startsWith(path) ? 'text-primary-500' : 'text-zinc-500 dark:text-zinc-400'
}
</script>
