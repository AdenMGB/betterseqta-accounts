<template>
  <div class="flex items-center gap-2">
    <img
      :src="avatarUrl"
      :alt="user?.displayName || user?.username || 'User'"
      class="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-700 object-cover"
    />
    <div class="flex flex-col">
      <span class="text-gray-900 dark:text-white font-medium leading-tight">{{ user?.displayName || 'User' }}</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 leading-tight">@{{ user?.username || 'username' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  user: { id?: number; displayName?: string; username?: string; pfpUrl?: string }
}>()

const avatarUrl = computed(() => {
  if (props.user?.pfpUrl) return props.user.pfpUrl
  const seed = props.user?.id ?? props.user?.username ?? 'default'
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(seed))}`
})
</script> 