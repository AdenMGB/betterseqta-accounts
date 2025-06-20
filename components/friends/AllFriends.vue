<template>
  <div>
    <ul v-if="friends.length" class="space-y-4">
      <motion.li
        v-for="(friend, index) in friends"
        :key="friend.id"
        class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
        :initial="{ opacity: 0, y: 20 }"
        :animate="{ opacity: 1, y: 0, transition: { delay: index * 0.1 } }"
        :while-hover="{ scale: 1.02, transition: { duration: 0.2 } }"
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
          <button @click="openRemoveModal(friend.id)" class="px-3 py-1 text-sm font-medium text-red-500 border border-red-500 rounded-lg hover:bg-red-500 hover:text-white">Remove</button>
        </div>
      </motion.li>
    </ul>
    <p v-else class="text-gray-500 dark:text-gray-400">You don't have any friends yet.</p>
    
    <Modal :is-open="isRemoveModalOpen" @close="closeRemoveModal">
      <template #header>Remove Friend</template>
      <template #body>Are you sure you want to remove this friend? This action cannot be undone.</template>
      <template #footer>
        <button @click="closeRemoveModal" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
        <button @click="confirmRemoveFriend" class="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">Remove</button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Modal from '~/components/ui/Modal.vue'
import { useToast } from '~/composables/useToast'
import { motion } from 'motion-v'

const router = useRouter()
const { showToast } = useToast()

interface Friend {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

const friends = ref<Friend[]>([])
const isRemoveModalOpen = ref(false)
const friendToRemoveId = ref<number | null>(null)

const openRemoveModal = (id: number) => {
  friendToRemoveId.value = id
  isRemoveModalOpen.value = true
}

const closeRemoveModal = () => {
  isRemoveModalOpen.value = false
  friendToRemoveId.value = null
}

const confirmRemoveFriend = async () => {
  if (friendToRemoveId.value === null) return
  try {
    await $fetch('/api/friends/remove', {
      method: 'POST',
      body: { friendId: friendToRemoveId.value },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    await fetchFriends() // Refresh the list
  } catch (error) {
    console.error('Failed to remove friend:', error)
    showToast('Failed to remove friend. Please try again.', 'error')
  } finally {
    closeRemoveModal()
  }
}

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

onMounted(fetchFriends)
</script> 