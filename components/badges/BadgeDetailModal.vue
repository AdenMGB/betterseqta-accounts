<template>
  <Teleport to="body">
    <transition
      enter-active-class="founder-badge-popup-backdrop-enter-active"
      enter-from-class="founder-badge-popup-backdrop-enter-from"
      enter-to-class="founder-badge-popup-backdrop-enter-to"
      leave-active-class="founder-badge-popup-backdrop-leave-active"
      leave-from-class="founder-badge-popup-backdrop-leave-from"
      leave-to-class="founder-badge-popup-backdrop-leave-to"
    >
      <div
        v-if="isOpen && badge"
        class="founder-badge-popup-backdrop"
        role="presentation"
        @click.self="close"
      >
        <transition
          enter-active-class="founder-badge-popup-panel-enter-active"
          enter-from-class="founder-badge-popup-panel-enter-from"
          enter-to-class="founder-badge-popup-panel-enter-to"
          leave-active-class="founder-badge-popup-panel-leave-active"
          leave-from-class="founder-badge-popup-panel-leave-from"
          leave-to-class="founder-badge-popup-panel-leave-to"
        >
          <div
            v-if="badge"
            class="founder-badge-popup"
            role="dialog"
            aria-modal="true"
            :aria-label="`${badge.label} details`"
          >
            <div class="founder-badge-popup-header">
              <h1>{{ badge.label }}</h1>
              <p>{{ rankLabel }}</p>
            </div>

            <div class="founder-badge-popup-hero-wrap">
              <div
                class="founder-badge-popup-hero"
                :data-tier="badge.key"
                :style="heroBlobStyle"
              >
                <div class="founder-badge-popup-hero__blobs" aria-hidden="true" />
                <div class="founder-badge-popup-hero__vignette" aria-hidden="true" />
                <div class="founder-badge-popup-hero__stage">
                  <FounderBadgeGlass :badge="badge" size="hero" />
                </div>
              </div>
            </div>

            <div class="founder-badge-popup-body">
              <p>{{ description }}</p>
              <p>
                Linked to your BetterSEQTA Cloud account at
                <a
                  href="https://accounts.betterseqta.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >accounts.betterseqta.org</a>.
              </p>
              <p
                v-if="signupNumber != null"
                class="founder-badge-popup-signup"
              >
                Cloud user #{{ signupNumber.toLocaleString() }}
              </p>
              <div class="founder-badge-popup-actions">
                <button
                  type="button"
                  class="founder-badge-popup-btn founder-badge-popup-btn--primary"
                  @click="close"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import {
  badgeDescription,
  badgeRankLabel,
  type BadgeItem,
} from '~/utils/badges'
import { badgeBlobStyle } from '~/utils/badgeVisuals'
import FounderBadgeGlass from '~/components/badges/FounderBadgeGlass.vue'

const props = defineProps<{
  isOpen: boolean
  badge: BadgeItem | null
  signupNumber?: number | null
  signedUpAt?: number | string | null
}>()

const emit = defineEmits<{ close: [] }>()

const heroBlobStyle = computed(() =>
  props.badge ? badgeBlobStyle(props.badge.key) : {},
)

const rankLabel = computed(() =>
  props.badge ? badgeRankLabel(props.badge.key) : '',
)

const description = computed(() =>
  props.badge ? badgeDescription(props.badge.key) : '',
)

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

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.founder-badge-popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.5);
}

.founder-badge-popup-backdrop-enter-active,
.founder-badge-popup-backdrop-leave-active {
  transition: opacity 0.25s ease;
}

.founder-badge-popup-backdrop-enter-from,
.founder-badge-popup-backdrop-leave-to {
  opacity: 0;
}

.founder-badge-popup-backdrop-enter-to,
.founder-badge-popup-backdrop-leave-from {
  opacity: 1;
}

.founder-badge-popup {
  display: flex;
  flex-direction: column;
  width: min(38em, 96vw);
  max-height: min(60em, 95vh);
  border-radius: 20px;
  background: rgb(255 255 255);
  color: rgb(24 24 27);
  transform-origin: center center;
  overflow: hidden;
}

.dark .founder-badge-popup {
  background: rgb(24 24 27);
  color: rgb(244 244 245);
}

.founder-badge-popup-panel-enter-active,
.founder-badge-popup-panel-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.22, 0.03, 0.26, 1);
}

.founder-badge-popup-panel-enter-from,
.founder-badge-popup-panel-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.founder-badge-popup-panel-enter-to,
.founder-badge-popup-panel-leave-from {
  opacity: 1;
  transform: scale(1);
}

.founder-badge-popup-header {
  flex-shrink: 0;
  margin: 20px;
  width: calc(100% - 40px);
  min-height: 3em;
  display: flex;
  flex-direction: column;
}

.founder-badge-popup-header h1 {
  margin: 0;
  font-size: 2em;
  font-weight: 700;
  line-height: 1.15;
}

.founder-badge-popup-header p {
  margin: 0.25rem 0 0;
  font-size: 1em;
  color: inherit;
  opacity: 0.85;
}

.founder-badge-popup-hero-wrap {
  flex-shrink: 0;
  width: 96%;
  display: flex;
  margin: 0 auto;
}

.founder-badge-popup-hero {
  position: relative;
  margin: 0 auto;
  width: 90%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  background: var(--badge-base, #0f172a);
}

.founder-badge-popup-hero__blobs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 55% 45% at 22% 38%, var(--badge-blob-a), transparent 72%),
    radial-gradient(ellipse 50% 42% at 78% 62%, var(--badge-blob-b), transparent 70%),
    radial-gradient(ellipse 48% 40% at 50% 92%, var(--badge-blob-c), transparent 68%);
  filter: blur(2px);
}

.founder-badge-popup-hero__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 28%, rgba(0, 0, 0, 0.72) 100%);
  opacity: 0.9;
}

.founder-badge-popup-hero__stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.founder-badge-popup-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 90%;
  margin: 5px auto 1rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.founder-badge-popup-body p {
  margin: 0 0 1rem;
  font-size: 1.2rem;
  line-height: 1.6;
}

.founder-badge-popup-body a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.founder-badge-popup-signup {
  padding: 0.55rem 0.75rem !important;
  border-radius: 0.6rem;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  background: color-mix(in srgb, currentColor 5%, transparent);
  font-size: 1rem !important;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.founder-badge-popup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 1.25rem;
}

.founder-badge-popup-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.25;
  cursor: pointer;
  transition: all 0.2s ease;
}

.founder-badge-popup-btn:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px rgb(255 255 255),
    0 0 0 4px rgb(255 107 0);
}

.dark .founder-badge-popup-btn:focus-visible {
  box-shadow:
    0 0 0 2px rgb(24 24 27),
    0 0 0 4px rgb(255 107 0);
}

.founder-badge-popup-btn--primary {
  background: rgb(255 107 0);
  color: #fff;
}

.founder-badge-popup-btn--primary:hover {
  filter: brightness(1.06);
  transform: scale(1.02);
}

.founder-badge-popup-btn--primary:active {
  transform: scale(0.98);
}
</style>
