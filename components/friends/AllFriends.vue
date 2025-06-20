<template>
  <div>
    <ul v-if="friends.length" class="space-y-4">
      <li
        v-for="friend in friends"
        :key="friend.id"
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center gap-4">
          <img :src="friend.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.username}`" :alt="friend.displayName" class="w-12 h-12 rounded-full object-cover">
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ friend.displayName }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">@{{ friend.username }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="messageFriend(friend.id)" class="px-3 py-1 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600">Message</button>
          <button @click="removeFriend(friend.id)" class="px-3 py-1 text-sm font-medium text-red-500 border border-red-500 rounded-lg hover:bg-red-500 hover:text-white">Remove</button>
        </div>
      </li>
    </ul>
    <p v-else class="text-gray-500 dark:text-gray-400">You don't have any friends yet.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

const friends = ref<Friend[]>([])

const messageFriend = (friendId: number) => {
  router.push(`/messages?with=${friendId}`)
}

const fetchFriends = async () => {
  try {
    const response = await $fetch<Friend[]>('/api/friends', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    friends.value = response
  } catch (error) {
    console.error('Failed to fetch friends:', error)
  }
}

const removeFriend = async (friendId: number) => {
  if (confirm('Are you sure you want to remove this friend?')) {
    try {
      await $fetch('/api/friends/remove', {
        method: 'POST',
        body: { friendId },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      await fetchFriends() // Refresh the list
    } catch (error) {
      console.error('Failed to remove friend:', error)
      alert('Failed to remove friend. Please try again.')
    }
  }
}

onMounted(fetchFriends)
</script> 