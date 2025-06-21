<template>
  <div class="flex h-full">
    <!-- Conversation List -->
    <div class="w-1/3 border-r border-gray-200 dark:border-gray-700">
      <ConversationList :friends="friends" @select-conversation="selectConversation" />
    </div>

    <!-- Message View -->
    <div class="w-2/3 flex flex-col">
      <MessageView v-if="selectedConversation" :conversation="selectedConversation" />
      <div v-else class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Select a conversation to start messaging.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ConversationList from '~/components/messages/ConversationList.vue'
import MessageView from '~/components/messages/MessageView.vue'

interface ConversationUser {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

const route = useRoute()
const friends = ref<ConversationUser[]>([])
const selectedConversation = ref<ConversationUser | null>(null)

const selectConversation = (user: ConversationUser) => {
  selectedConversation.value = user
}

onMounted(async () => {
  try {
    const response = await $fetch<ConversationUser[]>('/api/friends', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    friends.value = response

    const friendId = route.query.with
    if (friendId) {
      const friendToSelect = friends.value.find(f => f.id === Number(friendId))
      if (friendToSelect) {
        selectConversation(friendToSelect)
      }
    }
  } catch (error) {
    console.error('Failed to fetch friends for conversations:', error)
  }
})
</script>