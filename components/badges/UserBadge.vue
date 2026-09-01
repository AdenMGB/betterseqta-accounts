<template>
  <div class="group relative inline-flex">
    <button
      type="button"
      class="cursor-pointer rounded-md border-0 bg-transparent p-0 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-1 dark:focus:ring-offset-zinc-900"
      :aria-label="tooltipText"
      @click="emit('open-detail', badge)"
    >
      <FounderBadgeGlass :badge="badge" size="sm" />
    </button>
    <div
      role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg border border-zinc-200/90 bg-white/95 px-3 py-2 text-xs leading-relaxed text-zinc-800 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:text-zinc-100"
    >
      <p class="font-semibold text-zinc-900 dark:text-white">{{ badge.label }}</p>
      <p v-if="rankLabel" class="mt-0.5 font-medium text-primary-600 dark:text-primary-400">
        {{ rankLabel }}
      </p>
      <p class="mt-0.5 text-zinc-600 dark:text-zinc-400">{{ tooltipDetail }}</p>
      <p class="mt-1 text-zinc-500 dark:text-zinc-500">Click for details</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { badgeRankLabel, type BadgeItem } from '~/utils/badges'
import FounderBadgeGlass from '~/components/badges/FounderBadgeGlass.vue'

const props = defineProps<{
  badge: BadgeItem
  signupNumber?: number | null
  signedUpAt?: number | string | null
}>()

const emit = defineEmits<{
  'open-detail': [badge: BadgeItem]
}>()

export type { BadgeItem }

const rankLabel = computed(() => badgeRankLabel(props.badge.key))

const formattedSignupDate = computed(() => {
  if (!props.signedUpAt) return null
  try {
    const date =
      typeof props.signedUpAt === 'number'
        ? new Date(props.signedUpAt * 1000)
        : new Date(props.signedUpAt)
    return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return null
  }
})

const tooltipDetail = computed(() => {
  const parts: string[] = []
  if (props.signupNumber != null) {
    parts.push(`Cloud user #${props.signupNumber.toLocaleString()}`)
  }
  if (formattedSignupDate.value) {
    parts.push(`joined ${formattedSignupDate.value}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Linked to your Cloud account'
})

const tooltipText = computed(() => {
  const rank = rankLabel.value ? `${rankLabel.value} — ` : ''
  return `${rank}${props.badge.label} — ${tooltipDetail.value}`
})
</script>
