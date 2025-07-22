<template>
  <div class="flex h-[calc(100vh-64px)] overflow-hidden">
    <!-- Conversation List -->
    <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
      <ConversationList :friends="friends" :groups="groups" @select-conversation="selectConversation" />
    </div>

    <!-- Message View -->
    <div class="w-2/3 flex flex-col overflow-hidden">
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
  pfpUrl?: string | null;
  name: string;
  iconUrl?: string | null;
  members?: { id: number; displayName: string }[];
}

const route = useRoute()
const friends = ref<ConversationUser[]>([])
const groups = ref<ConversationUser[]>([])
const selectedConversation = ref<ConversationUser | null>(null)

const selectConversation = (conv: ConversationUser) => {
  selectedConversation.value = conv
}

onMounted(async () => {
  try {
    const [friendsRes, groupsRes] = await Promise.all([
      $fetch<any[]>('/api/friends', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }),
      $fetch<any[]>('/api/messages', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    ])
    friends.value = friendsRes.map(f => ({
      id: f.id,
      username: f.username || '',
      displayName: f.displayName || f.username || '',
      pfpUrl: f.pfpUrl || null,
      name: '', // Not a group, so name is empty
    }))
    groups.value = groupsRes.map(g => ({
      id: g.id,
      name: g.name || '',
      iconUrl: g.iconUrl || null,
      members: g.members || [],
      username: '', // Not a DM, so username is empty
      displayName: g.name || '',
    }))

    const friendId = route.query.with
    if (friendId) {
      const friendToSelect = friends.value.find(f => f.id === Number(friendId))
      if (friendToSelect) {
        selectConversation(friendToSelect)
      }
    }
  } catch (error) {
    console.error('Failed to fetch friends or groups for conversations:', error)
  }
})
</script>