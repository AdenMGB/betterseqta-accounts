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
          <img :src="getPfpUrl(friend.id)" :alt="friend.displayName" class="w-10 h-10 rounded-full object-cover">
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
import { ref, watch } from 'vue'
import { motion } from 'motion-v'

const pfpCache = ref<Record<string, string>>({})

const getPfpUrl = (userId: string) => {
  return pfpCache.value[userId] || `https://api.dicebear.com/7.x/thumbs/svg?seed=${userId}`
}

const fetchPfpUrl = async (userId: string) => {
  if (pfpCache.value[userId]) return
  try {
    const { pfpUrl } = await $fetch(`/api/user/pfp?id=${userId}`)
    pfpCache.value[userId] = pfpUrl
  } catch {
    pfpCache.value[userId] = `https://api.dicebear.com/7.x/thumbs/svg?seed=${userId}`
  }
}

const props = defineProps<{ friends: Friend[]; groups: Group[] }>()

watch(() => props.friends, (friends) => {
  friends.forEach((friend: Friend) => {
    if (friend.id) fetchPfpUrl(friend.id)
  })
}, { immediate: true })

interface Friend {
  id: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
}

interface Group {
  id: string;
  name: string;
  iconUrl?: string | null;
  members?: { id: string; displayName: string }[];
}

defineEmits(['select-conversation'])
</script> 