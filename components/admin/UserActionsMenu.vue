<template>
  <div ref="anchorRef" class="relative inline-block">
    <button
      type="button"
      class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      :aria-label="`Actions for ${user.displayName || user.username}`"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click.stop="toggle"
    >
      <EllipsisVerticalIcon class="w-5 h-5" />
    </button>

    <Teleport to="body">
      <template v-if="open">
        <div
          class="fixed inset-0 z-[200]"
          aria-hidden="true"
          @click="close"
        />
        <div
          ref="menuRef"
          role="menu"
          :style="menuStyle"
          class="fixed z-[201] w-48 rounded-lg bg-white dark:bg-zinc-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-1"
          @click.stop
        >
          <button
            v-if="canEdit"
            type="button"
            role="menuitem"
            :class="menuItemClass(false)"
            @click="choose('edit')"
          >
            Edit user
          </button>
          <button
            v-if="canPromote"
            type="button"
            role="menuitem"
            :class="menuItemClass(false)"
            @click="choose('promote')"
          >
            Promote
          </button>
          <button
            v-if="canDemote"
            type="button"
            role="menuitem"
            :class="menuItemClass(false)"
            @click="choose('demote')"
          >
            Demote
          </button>
          <button
            v-if="canReset"
            type="button"
            role="menuitem"
            :class="menuItemClass(false)"
            :disabled="resetting"
            @click="choose('reset')"
          >
            {{ resetting ? 'Sending reset…' : 'Send password reset' }}
          </button>
          <button
            v-if="canDelete"
            type="button"
            role="menuitem"
            :class="[menuItemClass(false), 'text-red-600 dark:text-red-400']"
            :disabled="deleting"
            @click="choose('delete')"
          >
            {{ deleting ? 'Deleting…' : 'Delete user' }}
          </button>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  user: { displayName?: string; username: string }
  canEdit?: boolean
  canPromote?: boolean
  canDemote?: boolean
  canReset?: boolean
  canDelete?: boolean
  resetting?: boolean
  deleting?: boolean
}>()

type Action = 'edit' | 'promote' | 'demote' | 'reset' | 'delete'

const emit = defineEmits<{ (e: Action): void }>()
  
const MENU_WIDTH = 192
const MENU_GAP = 4
const ESTIMATED_MENU_HEIGHT = 220

const anchorRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const open = ref(false)
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

const menuItemClass = (active: boolean) => [
  'block w-full px-3 py-2 text-left text-sm transition-colors disabled:opacity-50',
  active ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700',
]

const updatePosition = () => {
  const el = anchorRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const menuHeight = menuRef.value?.offsetHeight ?? ESTIMATED_MENU_HEIGHT
  const spaceBelow = window.innerHeight - rect.bottom
  const openUp = spaceBelow < menuHeight && rect.top > menuHeight

  const top = openUp
    ? rect.top - menuHeight - MENU_GAP
    : rect.bottom + MENU_GAP

  let left = rect.right - MENU_WIDTH
  left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))

  menuStyle.value = {
    top: `${Math.max(8, top)}px`,
    left: `${left}px`,
  }
}

const close = () => {
  open.value = false
}

const toggle = () => {
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      updatePosition()
      nextTick(updatePosition)
    })
  }
}


const choose = (action: Action) => {
  close()
  emit(action)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>
