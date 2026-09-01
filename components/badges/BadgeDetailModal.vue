<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-label="`${badge?.label ?? 'Founder badge'} details`"
        @click.self="close"
      >
        <transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="scale-95 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-95 opacity-0"
        >
          <div
            v-if="badge"
            class="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900"
          >
            <div
              :class="heroClass"
              class="relative px-6 pb-16 pt-10 text-center"
            >
              <div
                class="pointer-events-none absolute inset-0 bg-white/10 backdrop-blur-2xl"
                aria-hidden="true"
              />
              <div class="relative mx-auto inline-flex">
                <span
                  :class="badgeClass"
                  class="founder-badge-hero inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold leading-none tracking-wide text-white shadow-lg ring-1 ring-inset"
                >
                  <component
                    :is="tierIcon"
                    class="h-5 w-5 shrink-0 opacity-95"
                    aria-hidden="true"
                  />
                  <span>{{ badge.label }}</span>
                </span>
              </div>
              <p class="relative mt-4 text-sm font-medium text-white/90">
                {{ rankLabel }}
              </p>
            </div>

            <div class="relative -mt-10 px-6 pb-6">
              <div class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-md dark:border-zinc-700/70 dark:bg-zinc-800/95">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                  {{ badge.label }}
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {{ description }}
                </p>
                <p class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  This badge is linked to your BetterSEQTA Cloud account at
                  <a
                    href="https://accounts.betterseqta.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium text-primary-600 underline decoration-primary-500/40 underline-offset-2 transition-colors hover:text-primary-500 dark:text-primary-400"
                  >accounts.betterseqta.org</a>.
                  Your signup order is based on when you created your Cloud account and stays with you wherever you're signed in — including BetterSEQTA+.
                </p>
                <p
                  v-if="signupNumber != null"
                  class="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-sm font-medium tabular-nums text-zinc-700 dark:border-zinc-600/60 dark:bg-zinc-900/50 dark:text-zinc-200"
                >
                  Cloud user #{{ signupNumber.toLocaleString() }}
                  <span v-if="formattedSignupDate" class="font-normal text-zinc-500 dark:text-zinc-400">
                    · joined {{ formattedSignupDate }}
                  </span>
                </p>
                <div class="mt-5 flex justify-end">
                  <button
                    type="button"
                    class="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:scale-95 dark:focus:ring-offset-zinc-900"
                    @click="close"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import {
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  FireIcon,
} from '@heroicons/vue/20/solid'
import {
  badgeDescription,
  badgeRankLabel,
  type BadgeItem,
} from '~/utils/badges'

const props = defineProps<{
  isOpen: boolean
  badge: BadgeItem | null
  signupNumber?: number | null
  signedUpAt?: number | string | null
}>()

const emit = defineEmits<{ close: [] }>()

const tierStyles: Record<string, { gradient: string; ring: string; hero: string; icon: typeof SparklesIcon }> = {
  founder_10: {
    gradient: 'from-violet-600 to-fuchsia-600',
    ring: 'ring-violet-400/30',
    hero: 'bg-gradient-to-br from-violet-600/90 via-fuchsia-600/85 to-fuchsia-700/90',
    icon: SparklesIcon,
  },
  founder_25: {
    gradient: 'from-indigo-600 to-blue-600',
    ring: 'ring-indigo-400/30',
    hero: 'bg-gradient-to-br from-indigo-600/90 via-blue-600/85 to-blue-700/90',
    icon: SparklesIcon,
  },
  founder_50: {
    gradient: 'from-sky-600 to-teal-600',
    ring: 'ring-sky-400/30',
    hero: 'bg-gradient-to-br from-sky-600/90 via-teal-600/85 to-teal-700/90',
    icon: StarIcon,
  },
  founder_100: {
    gradient: 'from-emerald-600 to-green-600',
    ring: 'ring-emerald-400/30',
    hero: 'bg-gradient-to-br from-emerald-600/90 via-green-600/85 to-green-700/90',
    icon: StarIcon,
  },
  founder_250: {
    gradient: 'from-amber-600 to-orange-600',
    ring: 'ring-amber-400/35',
    hero: 'bg-gradient-to-br from-amber-600/90 via-orange-600/85 to-orange-700/90',
    icon: TrophyIcon,
  },
  founder_500: {
    gradient: 'from-orange-600 to-primary-600',
    ring: 'ring-orange-400/35',
    hero: 'bg-gradient-to-br from-orange-600/90 via-primary-600/85 to-primary-700/90',
    icon: TrophyIcon,
  },
  founder_1000: {
    gradient: 'from-rose-600 to-pink-600',
    ring: 'ring-rose-400/30',
    hero: 'bg-gradient-to-br from-rose-600/90 via-pink-600/85 to-pink-700/90',
    icon: FireIcon,
  },
  founder_2500: {
    gradient: 'from-amber-500 to-yellow-500',
    ring: 'ring-amber-300/40',
    hero: 'bg-gradient-to-br from-amber-500/90 via-yellow-500/85 to-amber-600/90',
    icon: FireIcon,
  },
}

const tierConfig = computed(() => {
  const key = props.badge?.key ?? ''
  return tierStyles[key] ?? {
    gradient: 'from-primary-600 to-orange-600',
    ring: 'ring-primary-400/30',
    hero: 'bg-gradient-to-br from-primary-600/90 via-orange-600/85 to-orange-700/90',
    icon: SparklesIcon,
  }
})

const tierIcon = computed(() => tierConfig.value.icon)
const heroClass = computed(() => tierConfig.value.hero)
const badgeClass = computed(() => {
  const { gradient, ring } = tierConfig.value
  return `bg-gradient-to-br ${gradient} ${ring}`
})

const rankLabel = computed(() =>
  props.badge ? badgeRankLabel(props.badge.key) : '',
)

const description = computed(() =>
  props.badge ? badgeDescription(props.badge.key) : '',
)

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

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.isOpen) close()
}

watch(
  () => props.isOpen,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.founder-badge-hero {
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
}
</style>
