<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 flex justify-around items-center h-16 sm:hidden">
    <NuxtLink to="/messages" class="flex flex-col items-center justify-center flex-1" :class="isActive('/messages')">
      <ChatBubbleLeftRightIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Chats</span>
    </NuxtLink>
    <NuxtLink to="/friends" class="flex flex-col items-center justify-center flex-1" :class="isActive('/friends')">
      <UsersIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Friends</span>
    </NuxtLink>
    <NuxtLink to="/friends?tab=add" class="flex flex-col items-center justify-center flex-1" :class="isActive('/friends?tab=add')">
      <UserPlusIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Add</span>
    </NuxtLink>
    <NuxtLink to="/settings" class="flex flex-col items-center justify-center flex-1" :class="isActive('/settings')">
      <Cog6ToothIcon class="w-6 h-6" />
      <span class="text-xs mt-1">Settings</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ChatBubbleLeftRightIcon, UsersIcon, UserPlusIcon, Cog6ToothIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const isActive = (path: string) => {
  // Simple check for active route
  return route.path.startsWith(path) ? 'text-primary-500' : 'text-zinc-500 dark:text-zinc-400'
}
</script> 