<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Profile Widget -->
    <div class="md:col-span-1 lg:col-span-1 backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-fade-in">
      <div class="flex items-center gap-4">
        <img :src="auth.user.value?.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${auth.user.value?.username}`" alt="Profile Picture" class="w-16 h-16 rounded-full object-cover border-2 border-primary-500">
        <div>
          <h2 class="text-xl font-bold text-zinc-900 dark:text-white font-display">{{ auth.user.value?.displayName }}</h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">@{{ auth.user.value?.username }}</p>
        </div>
      </div>
      <NuxtLink to="/settings" class="mt-auto text-center w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200">
        Manage Account
      </NuxtLink>
    </div>

    <!-- Account Info Widget -->
    <div class="md:col-span-1 lg:col-span-2 backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-fade-in delay-100">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white font-display flex items-center gap-2">
        <InformationCircleIcon class="w-6 h-6 text-primary-500" />
        Account Information
      </h3>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-zinc-600 dark:text-zinc-400">Email:</span>
          <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ auth.user.value?.email }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-600 dark:text-zinc-400">Joined:</span>
          <span class="font-medium text-zinc-800 dark:text-zinc-200">{{ formattedJoinDate }}</span>
        </div>
         <div class="flex justify-between">
          <span class="text-zinc-600 dark:text-zinc-400">User ID:</span>
          <span class="font-mono text-xs bg-zinc-200/80 dark:bg-zinc-900/80 px-2 py-1 rounded">{{ auth.user.value?.id }}</span>
        </div>
      </div>
    </div>

    <!-- Friend Requests Widget -->
    <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-fade-in delay-200">
       <h3 class="text-lg font-semibold text-zinc-900 dark:text-white font-display flex items-center justify-between">
        <div class="flex items-center gap-2">
            <UsersIcon class="w-6 h-6 text-primary-500" />
            <span>Friend Requests</span>
        </div>
        <span v-if="pendingRequests.length > 0" class="px-2 py-0.5 text-xs font-bold text-white bg-primary-500 rounded-full animate-pulse">{{ pendingRequests.length }}</span>
      </h3>
      <div v-if="pendingRequests.length > 0" class="flex flex-col gap-3">
        <div v-for="request in pendingRequests.slice(0, 2)" :key="request.id" class="flex items-center gap-3">
            <img :src="request.requester.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${request.requester.username}`" :alt="request.requester.displayName" class="w-10 h-10 rounded-full object-cover">
            <div class="flex-1">
                <p class="font-medium text-zinc-900 dark:text-white">{{ request.requester.displayName }}</p>
                <p class="text-sm text-zinc-600 dark:text-zinc-400">@{{ request.requester.username }}</p>
            </div>
        </div>
        <NuxtLink to="/friends?tab=pending" class="mt-2 text-sm text-center text-primary-600 dark:text-primary-500 hover:underline">View all requests</NuxtLink>
      </div>
      <p v-else class="text-zinc-600 dark:text-zinc-400 text-sm">You have no pending friend requests.</p>
    </div>

    <!-- Stats Widget -->
    <div class="lg:col-span-2 backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-fade-in delay-300">
      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white font-display flex items-center gap-2">
        <ChartBarIcon class="w-6 h-6 text-primary-500" />
        Your Stats
      </h3>
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-2xl font-bold text-primary-500">{{ stats.friendsCount }}</p>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">Friends</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-primary-500">{{ stats.messagesSent }}</p>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">Sent</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-primary-500">{{ stats.messagesReceived }}</p>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">Received</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { InformationCircleIcon, UsersIcon, ChartBarIcon } from '@heroicons/vue/24/outline'

const auth = useAuth()
const router = useRouter()

interface Requester {
  id: string;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

interface FriendRequest {
  id: string;
  requester: Requester;
}

interface Stats {
    friendsCount: number;
    messagesSent: number;
    messagesReceived: number;
}

const pendingRequests = ref<FriendRequest[]>([])
const stats = ref<Stats>({ friendsCount: 0, messagesSent: 0, messagesReceived: 0 });

const formattedJoinDate = computed(() => {
    if (!auth.user.value?.createdAt) return 'N/A'
    return new Date(auth.user.value.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
})

onMounted(async () => {
  if (!auth.user.value) {
    await auth.fetchUser()
  }
  
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
