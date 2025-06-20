<template>
  <div>
    <ul v-if="requests.length" class="space-y-4">
      <li
        v-for="request in requests"
        :key="request.id"
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center gap-4">
          <img :src="request.requester.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${request.requester.username}`" :alt="request.requester.displayName" class="w-12 h-12 rounded-full object-cover">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ request.requester.displayName }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">@{{ request.requester.username }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="acceptRequest(request.id)" class="px-3 py-1 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600">Accept</button>
          <button @click="rejectRequest(request.id)" class="px-3 py-1 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">Reject</button>
        </div>
      </li>
    </ul>
    <p v-else class="text-gray-500 dark:text-gray-400">You have no pending friend requests.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ofetch } from 'ofetch'

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

const requests = ref<FriendRequest[]>([])

const fetchRequests = async () => {
  try {
    const response = await $fetch<FriendRequest[]>('/api/friends/requests', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    requests.value = response
  } catch (error) {
    console.error('Failed to fetch friend requests:', error)
  }
}

const acceptRequest = async (id: number) => {
  try {
    await ofetch('/api/friends/accept', {
      method: 'POST',
      body: { requestId: id },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    fetchRequests() // Refresh the list
  } catch (error) {
    console.error('Failed to accept friend request:', error)
  }
}

const rejectRequest = async (id: number) => {
  try {
    await ofetch('/api/friends/reject', {
      method: 'POST',
      body: { requestId: id },
       headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    fetchRequests() // Refresh the list
  } catch (error) {
    console.error('Failed to reject friend request:', error)
  }
}

onMounted(fetchRequests)
</script> 