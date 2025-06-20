<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Conversations</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      <ul>
        <li
          v-for="friend in friends"
          :key="friend.id"
          @click="$emit('select-conversation', friend)"
          class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <img :src="friend.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.username}`" :alt="friend.displayName" class="w-10 h-10 rounded-full object-cover">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ friend.displayName }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">@{{ friend.username }}</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

defineProps<{
  friends: Friend[]
}>()

defineEmits(['select-conversation'])
</script> 