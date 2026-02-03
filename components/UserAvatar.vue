<template>
  <div class="flex items-center gap-2">
    <img
      v-if="user?.pfpUrl"
      :src="user.pfpUrl"
      :alt="user.displayName || user.username || 'User'"
      class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700 object-cover"
    />
    <div v-else class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
      <span>{{ user?.displayName?.charAt(0) || user?.username?.charAt(0) || '?' }}</span>
    </div>
    <div class="flex flex-col">
      <span class="text-gray-900 dark:text-white font-medium leading-tight">{{ user?.displayName || 'User' }}</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 leading-tight">@{{ user?.username || 'username' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ user: { displayName?: string, username?: string, pfpUrl?: string } }>()
</script> 