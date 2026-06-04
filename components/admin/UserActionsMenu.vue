<template>
  <Menu as="div" v-slot="{ open }" class="relative inline-block text-left">
    <div ref="anchorRef" class="inline-block">
      <MenuButton
        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :aria-label="`Actions for ${user.displayName || user.username}`"
        @click="schedulePositionUpdate"
      >
        <EllipsisVerticalIcon class="w-5 h-5" />
      </MenuButton>
    </div>
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <MenuItems
          v-if="open"
          :style="menuStyle"
          class="fixed z-[100] w-48 origin-top-right rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none py-1"
        >
          <MenuItem v-if="canEdit" v-slot="{ active }">
            <button
              type="button"
              :class="menuItemClass(active)"
              @click="$emit('edit')"
            >
              Edit user
            </button>
          </MenuItem>
          <MenuItem v-if="canPromote" v-slot="{ active }">
            <button type="button" :class="menuItemClass(active)" @click="$emit('promote')">
              Promote
            </button>
          </MenuItem>
          <MenuItem v-if="canDemote" v-slot="{ active }">
            <button type="button" :class="menuItemClass(active)" @click="$emit('demote')">
              Demote
            </button>
          </MenuItem>
          <MenuItem v-if="canReset" v-slot="{ active }">
            <button
              type="button"
              :class="menuItemClass(active)"
              :disabled="resetting"
              @click="$emit('reset')"
            >
              {{ resetting ? 'Sending reset…' : 'Send password reset' }}
            </button>
          </MenuItem>
          <MenuItem v-if="canDelete" v-slot="{ active }">
            <button
              type="button"
              :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
              :disabled="deleting"
              @click="$emit('delete')"
            >
              {{ deleting ? 'Deleting…' : 'Delete user' }}
            </button>
          </MenuItem>
        </MenuItems>
      </Transition>
    </Teleport>
  </Menu>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { EllipsisVerticalIcon } from '@heroicons/vue/24/outline'

defineProps<{
  user: { displayName?: string; username: string }
  canEdit?: boolean
  canPromote?: boolean
  canDemote?: boolean
  canReset?: boolean
  canDelete?: boolean
  resetting?: boolean
  deleting?: boolean
}>()

defineEmits<{ edit: []; promote: []; demote: []; reset: []; delete: [] }>()

const MENU_WIDTH = 192
const MENU_GAP = 4
const ESTIMATED_MENU_HEIGHT = 220

const anchorRef = ref<HTMLElement | null>(null)
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

const menuItemClass = (active: boolean) => [
  'block w-full px-3 py-2 text-left text-sm transition-colors disabled:opacity-50',
  active ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-200',
]

const isMenuOpen = () =>
  anchorRef.value?.querySelector('button')?.getAttribute('aria-expanded') === 'true'

const updatePosition = () => {
  if (!isMenuOpen()) return

  const el = anchorRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const openUp = spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > ESTIMATED_MENU_HEIGHT

  const top = openUp
    ? rect.top - ESTIMATED_MENU_HEIGHT - MENU_GAP
    : rect.bottom + MENU_GAP

  let left = rect.right - MENU_WIDTH
  left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))

  menuStyle.value = {
    top: `${Math.max(8, top)}px`,
    left: `${left}px`,
  }
}

const schedulePositionUpdate = () => {
  nextTick(updatePosition)
}

onMounted(() => {
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>
