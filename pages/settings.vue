<template>
  <div class="max-w-lg mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Account Settings</h1>
    <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
      <input
        v-model="displayName"
        type="text"
        placeholder="Display Name"
        class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200"
        required
      />
      <input
        v-model="username"
        type="text"
        placeholder="Username"
        class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200"
        required
      />
      <button
        type="submit"
        class="bg-primary-500 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        :disabled="loading"
      >
        <span v-if="loading">Saving...</span>
        <span v-else>Save Changes</span>
      </button>
      <p v-if="error" class="text-red-500 text-sm flex items-center gap-2 mt-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg>
        {{ error }}
      </p>
      <p v-if="success" class="text-green-500 text-sm flex items-center gap-2 mt-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        {{ success }}
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const displayName = ref('')
const username = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(() => {
  if (auth.user.value) {
    displayName.value = auth.user.value.displayName || ''
    username.value = auth.user.value.username || ''
  } else {
    auth.fetchUser().then(() => {
      displayName.value = auth.user.value?.displayName || ''
      username.value = auth.user.value?.username || ''
    })
  }
})

const onSubmit = async () => {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    await $fetch('/api/user/update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: { displayName: displayName.value, username: username.value },
    })
    success.value = 'Profile updated successfully.'
    await auth.fetchUser()
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Update failed.'
  } finally {
    loading.value = false
  }
}
</script> 