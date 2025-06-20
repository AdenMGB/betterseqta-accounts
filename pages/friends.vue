<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-6">Friends</h1>

    <div class="flex border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        @click="activeTab = tab.name"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors duration-200',
          activeTab === tab.name
            ? 'border-b-2 border-primary-500 text-primary-500'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mt-6">
      <div v-if="activeTab === 'all'">
        <AllFriends />
      </div>
      <div v-if="activeTab === 'pending'">
        <PendingRequests />
      </div>
      <div v-if="activeTab === 'add'">
        <AddFriend />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AllFriends from '~/components/friends/AllFriends.vue'
import PendingRequests from '~/components/friends/PendingRequests.vue'
import AddFriend from '~/components/friends/AddFriend.vue'

const activeTab = ref('all')
const tabs = [
  { name: 'all', label: 'All Friends' },
  { name: 'pending', label: 'Pending Requests' },
  { name: 'add', label: 'Add Friend' },
]
</script> 