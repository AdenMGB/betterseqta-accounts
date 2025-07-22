<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ conversation.displayName || conversation.name }}
      </h2>
      <p v-if="conversation.username" class="text-sm text-gray-500 dark:text-gray-400">@{{ conversation.username }}</p>
      <p v-else-if="conversation.members" class="text-sm text-gray-500 dark:text-gray-400">
        Group: {{ conversation.members.map(m => m.displayName).join(', ') }}
      </p>
    </div>

    <!-- Messages -->
    <div ref="messageContainer" class="flex-1 p-4 overflow-y-auto space-y-4 scroll-smooth">
      <AnimatePresence>
        <motion.div
          v-for="message in messages"
          :key="message.id"
          class="flex group"
          :class="message.senderId === auth.user.value?.id ? 'justify-end' : 'justify-start'"
          :initial="{ opacity: 0, y: 20 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: -20 }"
        >
          <div class="flex flex-col relative" :class="message.senderId === auth.user.value?.id ? 'items-end' : 'items-start'">
            <div
              :class="message.senderId === auth.user.value?.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'"
              class="inline-block px-4 py-2 rounded-lg max-w-xs lg:max-w-md"
            >
              <div v-if="message.replyTo" class="mb-1 p-2 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">
                Replying to: <span v-html="renderMarkdown(message.replyTo.content)"></span>
              </div>
              <div v-if="message.attachment && message.attachment.mimeType.startsWith('image/')" class="mb-2">
                <img :src="`/api/files/public/${message.attachment.storedName}`" :alt="message.attachment.filename" class="max-w-xs rounded-lg" />
              </div>
              <div v-html="renderMarkdown(message.content)"></div>
            </div>
            <!-- Reply button on hover -->
            <button v-if="!replyToMessage || replyToMessage.id !== message.id" @click="setReplyTo(message)" class="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-full p-1 shadow hover:bg-primary-500 hover:text-white" title="Reply">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h7V6a1 1 0 011.707-.707l7 7a1 1 0 010 1.414l-7 7A1 1 0 0110 18v-4H3v-4z" /></svg>
            </button>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ new Date(message.createdAt).toLocaleTimeString() }}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>

    <!-- Message Input -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
      <!-- Reply preview -->
      <div v-if="replyToMessage" class="mb-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span class="text-xs text-gray-600 dark:text-gray-300">Replying to:</span>
        <span class="text-xs font-medium text-gray-900 dark:text-white" v-html="renderMarkdown(replyToMessage.content)"></span>
        <button @click="clearReply" class="ml-2 text-gray-400 hover:text-red-500 transition-colors duration-200" title="Cancel reply">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <!-- Image preview -->
      <div v-if="selectedFile" class="mb-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <img :src="imagePreviewUrl || ''" alt="Image preview" class="h-16 rounded shadow" />
        <button @click="removeImage" class="ml-2 text-gray-400 hover:text-red-500 transition-colors duration-200" title="Remove image">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <!-- Markdown Toolbar -->
      <div class="flex gap-2 mb-2">
        <button type="button" @click="applyMarkdown('bold')" class="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" title="Bold (Ctrl+B)"><b>B</b></button>
        <button type="button" @click="applyMarkdown('italic')" class="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" title="Italic (Ctrl+I)"><i>I</i></button>
        <button type="button" @click="applyMarkdown('code')" class="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" title="Inline Code (Ctrl+E)"><code>&lt;/&gt;</code></button>
        <button type="button" @click="applyMarkdown('link')" class="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" title="Link (Ctrl+K)">🔗</button>
        <button type="button" @click="applyMarkdown('ul')" class="px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" title="Bullet List">• List</button>
      </div>
      <form @submit.prevent="sendMessage" class="flex items-center gap-2">
        <input
          v-model="newMessage"
          ref="messageInput"
          type="text"
          placeholder="Type a message..."
          class="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input type="file" ref="fileInput" @change="onFileChange" class="hidden" />
        <button type="button" @click="triggerFileInput" class="px-2 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M7 7h.01" /></svg>
        </button>
        <button type="submit" class="px-4 py-2 text-white bg-primary-500 rounded-lg hover:bg-primary-600">Send</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { motion, AnimatePresence } from 'motion-v'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ breaks: true })

interface ConversationUser {
  id: number;
  username?: string;
  displayName?: string;
  name?: string;
  members?: { id: number; displayName: string }[];
  pfpUrl?: string | null;
}

interface Message {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
  replyTo?: Message;
  attachment?: any;
}

const props = defineProps<{
  conversation: ConversationUser
}>()

const auth = useAuth()
const messages = ref<Message[]>([])
const newMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const messageContainer = ref<HTMLDivElement | null>(null)
const messageInput = ref<HTMLInputElement | null>(null)
const replyToMessage = ref<Message | null>(null)
const imagePreviewUrl = ref<string | null>(null)
let pollInterval: any = null

const renderMarkdown = (text: string) => md.render(text || '')

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

function setReplyTo(message: Message) {
  replyToMessage.value = message
}
function clearReply() {
  replyToMessage.value = null
}

const sendMessage = async () => {
  if (!newMessage.value.trim() && !selectedFile.value) return // Allow sending if there is text OR an image
  let attachmentId = null
  if (selectedFile.value) {
    // Upload file first
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const uploadRes = await $fetch('/api/files/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    attachmentId = uploadRes.id
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
  try {
    const isGroup = !!props.conversation.members && !!props.conversation.name
    await $fetch('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: {
        receiverId: !isGroup ? props.conversation.id : undefined,
        groupId: isGroup ? props.conversation.id : undefined,
        content: newMessage.value.trim(),
        attachmentId,
        replyToId: replyToMessage.value ? replyToMessage.value.id : undefined,
      }
    })
    newMessage.value = ''
    replyToMessage.value = null
    await fetchMessages(true) // Refresh messages and force scroll
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const onFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) {
    selectedFile.value = files[0]
  }
}

const triggerFileInput = () => {
  if (fileInput.value) fileInput.value.click()
}

function applyMarkdown(action: string) {
  const input = messageInput.value
  if (!input) return
  const start = input.selectionStart || 0
  const end = input.selectionEnd || 0
  let value = newMessage.value
  let before = value.slice(0, start)
  let selected = value.slice(start, end)
  let after = value.slice(end)
  switch (action) {
    case 'bold':
      newMessage.value = before + `**${selected || 'bold'}**` + after
      setTimeout(() => setSelection(input, start + 2, start + 2 + (selected ? selected.length : 4)), 0)
      break
    case 'italic':
      newMessage.value = before + `*${selected || 'italic'}*` + after
      setTimeout(() => setSelection(input, start + 1, start + 1 + (selected ? selected.length : 6)), 0)
      break
    case 'code':
      newMessage.value = before + '`' + (selected || 'code') + '`' + after
      setTimeout(() => setSelection(input, start + 1, start + 1 + (selected ? selected.length : 4)), 0)
      break
    case 'link':
      newMessage.value = before + `[${selected || 'text'}](url)` + after
      setTimeout(() => setSelection(input, start + 1, start + 1 + (selected ? selected.length : 4)), 0)
      break
    case 'ul':
      newMessage.value = before + `\n- ${selected || 'item'}` + after
      setTimeout(() => setSelection(input, start + 4, start + 4 + (selected ? selected.length : 4)), 0)
      break
  }
  input.focus()
}

function setSelection(input: HTMLInputElement, start: number, end: number) {
  input.setSelectionRange(start, end)
}

watch(() => props.conversation, (newVal) => {
  if (newVal) {
    fetchMessages(true)
  }
}, { immediate: true })

watch(selectedFile, (file) => {
  if (file) {
    imagePreviewUrl.value = URL.createObjectURL(file)
  } else {
    imagePreviewUrl.value = null
  }
})

function removeImage() {
  selectedFile.value = null
  imagePreviewUrl.value = null
  if (fileInput.value) fileInput.value.value = ''
}

onMounted(() => {
  pollInterval = setInterval(() => fetchMessages(false), 3000) // Poll every 3 seconds
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script> 