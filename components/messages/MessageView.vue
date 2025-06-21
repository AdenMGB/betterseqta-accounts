<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ conversation.displayName }}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">@{{ conversation.username }}</p>
    </div>

    <!-- Messages -->
    <div ref="messageContainer" class="flex-1 p-4 overflow-y-auto space-y-4">
      <AnimatePresence>
        <motion.div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.senderId === auth.user.value?.id ? 'justify-end' : 'justify-start'"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: -20 }"
        >
          <div class="flex flex-col" :class="message.senderId === auth.user.value?.id ? 'items-end' : 'items-start'">
            <div
              :class="message.senderId === auth.user.value?.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'"
              class="inline-block px-4 py-2 rounded-lg max-w-xs lg:max-w-md"
            >
              <p>{{ message.content }}</p>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ new Date(message.createdAt).toLocaleTimeString() }}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>

    <!-- Message Input -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
      <form @submit.prevent="sendMessage" class="flex items-center gap-2">
        <input
          v-model="newMessage"
          type="text"
          placeholder="Type a message..."
          class="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" class="px-4 py-2 text-white bg-primary-500 rounded-lg hover:bg-primary-600">Send</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { motion, AnimatePresence } from 'motion-v'

interface ConversationUser {
  id: number;
  username: string;
  displayName: string;
  pfpUrl: string | null;
}

interface Message {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
}

const props = defineProps<{
  conversation: ConversationUser
}>()

const auth = useAuth()
const messages = ref<Message[]>([])
const newMessage = ref('')
const messageContainer = ref<HTMLDivElement | null>(null)
let pollInterval: any = null

const scrollToBottom = () => {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
}

const fetchMessages = async (forceScroll = false) => {
  if (!props.conversation) return
  try {
    const el = messageContainer.value
    const shouldScroll = forceScroll || !el || (el.scrollHeight - el.scrollTop <= el.clientHeight + 50)

    const response = await $fetch<Message[]>(`/api/messages/${props.conversation.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    messages.value = response

    if (shouldScroll) {
      scrollToBottom()
    }
  } catch (error) {
    console.error('Failed to fetch messages:', error)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !props.conversation) return
  try {
    await $fetch('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: {
        receiverId: props.conversation.id,
        content: newMessage.value.trim()
      }
    })
    newMessage.value = ''
    await fetchMessages(true) // Refresh messages and force scroll
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

watch(() => props.conversation, (newVal) => {
  if (newVal) {
    fetchMessages(true)
  }
}, { immediate: true })

onMounted(() => {
  pollInterval = setInterval(() => fetchMessages(false), 3000) // Poll every 3 seconds
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

</script> 