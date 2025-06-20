<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Welcome Widget -->
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all duration-200"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.1 } }"
    >
      <div class="flex items-center gap-2 mb-2">
        <UserCircleIcon class="w-6 h-6 text-primary-500" />
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Welcome</span>
      </div>
      <p class="text-gray-700 dark:text-gray-200">Hello, <span class="font-medium text-primary-500">{{ auth.user.value?.displayName || 'User' }}</span>!</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">@{{ auth.user.value?.username }}</p>
    </motion-div>

    <!-- Friend Requests Widget -->
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-4 transition-all duration-200"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.2 } }"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
            <UsersIcon class="w-6 h-6 text-primary-500" />
            <span class="text-lg font-semibold text-gray-900 dark:text-white">Friend Requests</span>
        </div>
        <span v-if="pendingRequests.length > 0" class="px-2 py-1 text-xs font-bold text-white bg-primary-500 rounded-full">{{ pendingRequests.length }}</span>
      </div>
      <div v-if="pendingRequests.length > 0" class="flex flex-col gap-3">
        <div v-for="request in pendingRequests.slice(0, 2)" :key="request.id" class="flex items-center gap-3">
            <img :src="request.requester.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${request.requester.username}`" :alt="request.requester.displayName" class="w-8 h-8 rounded-full object-cover">
            <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">{{ request.requester.displayName }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">@{{ request.requester.username }}</p>
            </div>
        </div>
        <NuxtLink to="/friends?tab=pending" class="mt-2 text-sm text-center text-primary-500 hover:underline">View all</NuxtLink>
      </div>
      <p v-else class="text-gray-500 dark:text-gray-400">No pending friend requests.</p>
    </motion-div>
    
    <!-- Stats Widget -->
    <motion-div
      class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 flex flex-col gap-2 transition-all duration-200"
      :initial="{ y: 30, opacity: 0 }"
      :enter="{ y: 0, opacity: 1, transition: { duration: 0.5, delay: 0.3 } }"
    >
      <div class="flex items-center gap-2 mb-2">
        <ChartBarIcon class="w-6 h-6 text-primary-500" />
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Your Stats</span>
      </div>
      <div class="flex justify-between items-center">
        <p class="text-gray-700 dark:text-gray-200">Friends</p>
        <p class="font-semibold text-lg text-primary-500">{{ stats.friendsCount }}</p>
      </div>
      <div class="flex justify-between items-center">
        <p class="text-gray-700 dark:text-gray-200">Messages Sent</p>
        <p class="font-semibold text-lg text-primary-500">{{ stats.messagesSent }}</p>
      </div>
        <div class="flex justify-between items-center">
        <p class="text-gray-700 dark:text-gray-200">Messages Received</p>
        <p class="font-semibold text-lg text-primary-500">{{ stats.messagesReceived }}</p>
      </div>
    </motion-div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { UserCircleIcon, UsersIcon, ChartBarIcon } from '@heroicons/vue/24/outline'

const auth = useAuth()
const router = useRouter()

interface Requester {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

interface FriendRequest {
  id: number;
  requester: Requester;
}

interface Stats {
    friendsCount: number;
    messagesSent: number;
    messagesReceived: number;
}

const pendingRequests = ref<FriendRequest[]>([])
const stats = ref<Stats>({ friendsCount: 0, messagesSent: 0, messagesReceived: 0 });

onMounted(async () => {
  await auth.fetchUser()
  if (!auth.user.value) {
    router.push('/login')
  } else {
    // Fetch pending requests
    try {
        const requests = await $fetch<FriendRequest[]>('/api/friends/requests', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        pendingRequests.value = requests
    } catch (error) {
        console.error('Failed to fetch pending requests:', error)
    }

    // Fetch stats
    try {
        const statsData = await $fetch<Stats>('/api/user/stats', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        stats.value = statsData
    } catch (error) {
        console.error('Failed to fetch stats:', error)
    }
  }
})
</script>
