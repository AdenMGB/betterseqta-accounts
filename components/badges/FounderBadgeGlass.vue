<template>
  <span
    class="founder-badge-glass"
    :class="size === 'hero' ? 'founder-badge-glass--hero' : 'founder-badge-glass--sm'"
    :data-tier="badge.key"
    :style="blobStyle"
  >
    <span class="founder-badge-glass__blobs" aria-hidden="true" />
    <span class="founder-badge-glass__content">
      <component
        :is="tierIcon"
        class="founder-badge-glass__icon shrink-0 opacity-95"
        aria-hidden="true"
      />
      <span class="founder-badge-glass__label">{{ badge.label }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  FireIcon,
} from '@heroicons/vue/20/solid'
import { badgeBlobStyle } from '~/utils/badgeVisuals'
import type { BadgeItem } from '~/utils/badges'

const props = withDefaults(
  defineProps<{
    badge: BadgeItem
    size?: 'sm' | 'hero'
  }>(),
  { size: 'sm' },
)

const tierIcons: Record<string, typeof SparklesIcon> = {
  founder_10: SparklesIcon,
  founder_25: SparklesIcon,
  founder_50: StarIcon,
  founder_100: StarIcon,
  founder_250: TrophyIcon,
  founder_500: TrophyIcon,
  founder_1000: FireIcon,
  founder_2500: FireIcon,
}

const tierIcon = computed(() => tierIcons[props.badge.key] ?? SparklesIcon)
const blobStyle = computed(() => badgeBlobStyle(props.badge.key))
</script>

<style scoped>
.founder-badge-glass {
  position: relative;
  display: inline-flex;
  overflow: hidden;
  border-radius: 5px;
  background: var(--badge-base, #1e293b);
  vertical-align: middle;
}

.founder-badge-glass--hero {
  border-radius: 12px;
}

.founder-badge-glass__blobs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 72% 68% at 18% 42%, var(--badge-blob-a), transparent 72%),
    radial-gradient(ellipse 68% 62% at 82% 58%, var(--badge-blob-b), transparent 70%),
    radial-gradient(ellipse 64% 56% at 50% 88%, var(--badge-blob-c), transparent 68%);
  filter: blur(1px);
}

.founder-badge-glass__content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  min-height: 22px;
  border-radius: inherit;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  background: rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.78),
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    inset 0 2px 8px rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);
}

.founder-badge-glass--hero .founder-badge-glass__content {
  gap: 8px;
  padding: 10px 16px;
  min-height: auto;
  font-size: 14px;
  line-height: 1.2;
}

.founder-badge-glass__icon {
  width: 15px;
  height: 15px;
}

.founder-badge-glass--hero .founder-badge-glass__icon {
  width: 20px;
  height: 20px;
}
</style>
