<template>
  <div class="group relative inline-flex">
    <span
      :class="badgeClass"
      class="founder-badge inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold leading-none tracking-wide transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:ring-offset-1 dark:focus:ring-offset-zinc-900"
      tabindex="0"
      :aria-label="tooltipText"
    >
      <component
        :is="tierIcon"
        class="h-3.5 w-3.5 shrink-0 opacity-95"
        aria-hidden="true"
      />
      <span>{{ badge.label }}</span>
    </span>
    <div
      role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border border-zinc-200/90 bg-white/95 px-3 py-2 text-xs leading-relaxed text-zinc-800 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:text-zinc-100"
    >
      <p class="font-semibold text-zinc-900 dark:text-white">{{ badge.label }}</p>
      <p class="mt-0.5 text-zinc-600 dark:text-zinc-400">{{ tooltipDetail }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  FireIcon,
} from '@heroicons/vue/20/solid'
import type { BadgeItem } from '~/utils/badges'

const props = defineProps<{
  badge: BadgeItem
  signupNumber?: number | null
  signedUpAt?: number | string | null
}>()

export type { BadgeItem }

const tierStyles: Record<string, { gradient: string; ring: string; icon: typeof SparklesIcon }> = {
  founder_10: {
    gradient: 'from-violet-600 to-fuchsia-600',
    ring: 'ring-violet-400/30',
    icon: SparklesIcon,
  },
  founder_25: {
    gradient: 'from-indigo-600 to-blue-600',
    ring: 'ring-indigo-400/30',
    icon: SparklesIcon,
  },
  founder_50: {
    gradient: 'from-sky-600 to-teal-600',
    ring: 'ring-sky-400/30',
    icon: StarIcon,
  },
  founder_100: {
    gradient: 'from-emerald-600 to-green-600',
    ring: 'ring-emerald-400/30',
    icon: StarIcon,
  },
  founder_250: {
    gradient: 'from-amber-600 to-orange-600',
    ring: 'ring-amber-400/35',
    icon: TrophyIcon,
  },
  founder_500: {
    gradient: 'from-orange-600 to-primary-600',
    ring: 'ring-orange-400/35',
    icon: TrophyIcon,
  },
  founder_1000: {
    gradient: 'from-rose-600 to-pink-600',
    ring: 'ring-rose-400/30',
    icon: FireIcon,
  },
  founder_2500: {
    gradient: 'from-amber-500 to-yellow-500',
    ring: 'ring-amber-300/40',
    icon: FireIcon,
  },
}

const tierConfig = computed(
  () => tierStyles[props.badge.key] ?? {
    gradient: 'from-primary-600 to-orange-600',
    ring: 'ring-primary-400/30',
    icon: SparklesIcon,
  },
)

const tierIcon = computed(() => tierConfig.value.icon)

const badgeClass = computed(() => {
  const { gradient, ring } = tierConfig.value
  return `bg-gradient-to-br ${gradient} text-white shadow-sm ring-1 ring-inset ${ring}`
})

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
  return parts.length > 0 ? parts.join(' · ') : 'Founding member'
})

const tooltipText = computed(() => `${props.badge.label} — ${tooltipDetail.value}`)
</script>

<style scoped>
.founder-badge {
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
}
</style>
