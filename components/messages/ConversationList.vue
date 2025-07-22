<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Conversations</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      <ul>
        <li class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">Groups</li>
        <motion.li
          v-for="(group, index) in groups"
          :key="'group-' + group.id"
          @click="$emit('select-conversation', group)"
          class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          :initial="{ opacity: 0, x: -20 }"
          :animate="{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }"
          :while-hover="{ scale: 1.02, transition: { duration: 0.2 } }"
        >
          <img :src="group.iconUrl || 'https://api.dicebear.com/7.x/thumbs/svg?seed=' + group.name" :alt="group.name" class="w-10 h-10 rounded-full object-cover">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ group.name }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Group</p>
          </div>
        </motion.li>
        <li class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">Direct Messages</li>
        <motion.li
          v-for="(friend, index) in friends"
          :key="'friend-' + friend.id"
          @click="$emit('select-conversation', friend)"
          class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          :initial="{ opacity: 0, x: -20 }"
          :animate="{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }"
          :while-hover="{ scale: 1.02, transition: { duration: 0.2 } }"
        >
          <img :src="friend.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.username}`" :alt="friend.displayName" class="w-10 h-10 rounded-full object-cover">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ friend.displayName }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">@{{ friend.username }}</p>
          </div>
        </motion.li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'

interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface Group {
  id: number;
  name: string;
  iconUrl?: string | null;
  members?: { id: number; displayName: string }[];
}

defineProps<{
  friends: Friend[]
  groups: Group[]
}>()

defineEmits(['select-conversation'])
</script> 