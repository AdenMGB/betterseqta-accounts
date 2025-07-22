<template>
  <div class="flex h-[calc(100vh-64px)] overflow-hidden">
    <!-- Conversation List -->
    <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Conversations</h2>
        <button @click="isCreateGroupOpen = true" class="px-3 py-1 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-all duration-200">+ New Group</button>
      </div>
      <ConversationList :friends="friends" :groups="groups" @select-conversation="selectConversation" />
    </div>

    <!-- Message View -->
    <div class="w-2/3 flex flex-col overflow-hidden">
      <MessageView v-if="selectedConversation" :conversation="selectedConversation" />
      <div v-else class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        Select a conversation to start messaging.
      </div>
    </div>
    <!-- Create Group Modal -->
    <Modal :isOpen="isCreateGroupOpen" @close="isCreateGroupOpen = false">
      <template #header>Create Group Chat</template>
      <template #body>
        <div class="space-y-4">
          <input v-model="newGroupName" type="text" placeholder="Group name" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <div>
            <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">Add friends:</p>
            <div class="max-h-48 overflow-y-auto space-y-2">
              <label v-for="friend in friends" :key="friend.id" class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="selectedFriendIds" :value="friend.id" class="accent-bg accent-ring" />
                <img :src="friend.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.username}`" :alt="friend.displayName" class="w-8 h-8 rounded-full object-cover">
                <span class="text-gray-900 dark:text-white">{{ friend.displayName }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">@{{ friend.username }}</span>
              </label>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button @click="isCreateGroupOpen = false" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
        <button @click="createGroup" :disabled="!newGroupName.trim() || selectedFriendIds.length === 0" class="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all duration-200 disabled:opacity-50">Create</button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import Modal from '~/components/ui/Modal.vue'
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ConversationList from '~/components/messages/ConversationList.vue'
import MessageView from '~/components/messages/MessageView.vue'

interface ConversationUser {
  id: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
  name: string;
  iconUrl?: string | null;
  members?: { id: string; displayName: string }[];
}

type FriendApi = { id: string; username: string; displayName: string; pfpUrl?: string | null };
type GroupApi = { id: string; name: string; iconUrl?: string | null; members?: { id: string; displayName: string }[] };

const route = useRoute()
const friends = ref<ConversationUser[]>([])
const groups = ref<ConversationUser[]>([])
const selectedConversation = ref<ConversationUser | null>(null)
const isCreateGroupOpen = ref(false)
const newGroupName = ref('')
const selectedFriendIds = ref<string[]>([])

const selectConversation = (conv: ConversationUser) => {
  selectedConversation.value = conv
}

const createGroup = async () => {
  try {
    const group = await $fetch('/api/groups', {
      method: 'POST',
      body: { name: newGroupName.value, memberIds: selectedFriendIds.value },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    isCreateGroupOpen.value = false
    newGroupName.value = ''
    selectedFriendIds.value = []
    // Refresh group list and select the new group
    await fetchGroups()
    if (group && group.id) {
      const newGroup = groups.value.find(g => g.id === group.id)
      if (newGroup) selectConversation(newGroup)
    }
  } catch (error) {
    console.error('Failed to create group:', error)
  }
}

const fetchGroups = async () => {
  try {
    const groupsRes = await $fetch<GroupApi[]>('/api/groups', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    groups.value = groupsRes.map(g => ({
      id: g.id,
      name: g.name || '',
      iconUrl: g.iconUrl || null,
      members: g.members || [],
      username: '',
      displayName: g.name || '',
    }))
  } catch (error) {
    console.error('Failed to fetch groups:', error)
  }
}

onMounted(async () => {
  try {
    const [friendsResRaw, groupsResRaw] = await Promise.all([
      $fetch('/api/friends', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }) as unknown,
      $fetch('/api/groups', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }) as unknown
    ])
    const friendsRes = friendsResRaw as FriendApi[];
    const groupsRes = groupsResRaw as GroupApi[];
    friends.value = friendsRes
      .filter((f: any) => typeof f.id === 'string')
      .map((f: FriendApi) => ({
        id: f.id,
        username: f.username || '',
        displayName: f.displayName || f.username || '',
        pfpUrl: f.pfpUrl || null,
        name: '',
      }))
    groups.value = groupsRes
      .filter((g: any) => typeof g.id === 'string')
      .map((g: GroupApi) => ({
        id: g.id,
        name: g.name || '',
        iconUrl: g.iconUrl || null,
        members: g.members || [],
        username: '',
        displayName: g.name || '',
      }))
    const friendId = route.query.with
    if (friendId) {
      const friendToSelect = friends.value.find(f => f.id === String(friendId))
      if (friendToSelect) {
        selectConversation(friendToSelect)
      }
    }
  } catch (error) {
    console.error('Failed to fetch friends or groups for conversations:', error)
  }
})
</script>