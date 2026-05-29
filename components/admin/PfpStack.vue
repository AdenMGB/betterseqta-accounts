<template>
  <div
    class="relative shrink-0"
    :style="{ width: `${36 + Math.min(history.length, 3) * 10}px`, height: '36px' }"
  >
    <img
      v-for="(h, i) in history.slice(0, 3)"
      :key="h.id"
      :src="h.r2Key"
      alt=""
      class="absolute top-0 w-9 h-9 rounded-full object-cover border-2 border-white dark:border-zinc-800 cursor-pointer shadow-sm"
      :style="{ left: `${(i + 1) * 10}px`, zIndex: 3 - i }"
      @click="$emit('view', h.r2Key)"
    />
    <div
      class="absolute top-0 left-0"
      style="z-index: 4"
    >
      <img
        :src="currentSrc"
        alt=""
        class="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-zinc-800 cursor-pointer shadow-sm"
        @click="$emit('view', currentSrc)"
      />
      <button
        v-if="canEdit"
        type="button"
        class="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
        title="Edit profile pictures"
        @click.stop="$emit('edit')"
      >
        <PencilIcon class="w-2.5 h-2.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PencilIcon } from '@heroicons/vue/24/outline'

type PfpHistoryItem = {
  id: string
  r2Key: string
  createdAt?: number
}

const props = defineProps<{
  userId: string
  pfpUrl?: string | null
  pfpHistory?: PfpHistoryItem[]
  canEdit?: boolean
}>()

defineEmits<{
  edit: []
  view: [src: string]
}>()

const history = computed(() => props.pfpHistory ?? [])

const currentSrc = computed(
  () => props.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${props.userId}`,
)
</script>
