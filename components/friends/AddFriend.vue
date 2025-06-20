<template>
  <div>
    <form @submit.prevent="sendRequest" class="flex items-center gap-2">
      <input
        v-model="username"
        type="text"
        placeholder="Enter username"
        class="flex-1 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
      <button type="submit" class="px-4 py-2 text-white bg-primary-500 rounded-lg hover:bg-primary-600">Send Request</button>
    </form>
    <p v-if="message" :class="messageClass" class="mt-2 text-sm">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const username = ref('')
const message = ref('')
const messageClass = ref('')

const sendRequest = async () => {
  if (!username.value) return
  try {
    const response = await $fetch('/api/friends/request', {
      method: 'POST',
      body: { username: username.value },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    message.value = 'Friend request sent successfully!'
    messageClass.value = 'text-green-500'
    username.value = ''
  } catch (error: any) {
    message.value = error.data?.message || 'Failed to send friend request.'
    messageClass.value = 'text-red-500'
  }
}
</script> 