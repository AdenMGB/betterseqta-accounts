<template>
  <div
    class="mouse-glow pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    aria-hidden="true"
  >
    <div
      class="absolute inset-0 bg-white dark:bg-zinc-900 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"
    />
    <div
      v-if="enabled"
      class="mouse-glow-fx"
      :class="{ 'mouse-glow-fx--visible': mouseOnScreen }"
    >
      <div
        class="mouse-glow-orb"
        :style="orbStyle"
      />
      <div
        class="mouse-glow-grid-highlight absolute inset-0 bg-[linear-gradient(to_right,#ff6b0018_1px,transparent_1px),linear-gradient(to_bottom,#ff6b0018_1px,transparent_1px)] bg-[size:14px_24px]"
        :style="highlightStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMouse, usePreferredReducedMotion } from '@vueuse/core'

const targetX = ref(0)
const targetY = ref(0)
const x = ref(0)
const y = ref(0)
const mouseOnScreen = ref(false)

const { x: mouseX, y: mouseY } = useMouse({ type: 'client' })
const reducedMotion = usePreferredReducedMotion()
const enabled = computed(() => reducedMotion.value !== 'reduce')

const orbStyle = computed(() => ({
  transform: `translate(${x.value}px, ${y.value}px) translate(-50%, -50%)`,
}))

const highlightStyle = computed(() => ({
  maskImage: `radial-gradient(circle 12rem at ${x.value}px ${y.value}px, black 0%, transparent 100%)`,
  WebkitMaskImage: `radial-gradient(circle 12rem at ${x.value}px ${y.value}px, black 0%, transparent 100%)`,
}))

let frame = 0

function tick() {
  const ease = 0.075
  x.value += (targetX.value - x.value) * ease
  y.value += (targetY.value - y.value) * ease
  frame = requestAnimationFrame(tick)
}

function handleMouseEnter() {
  mouseOnScreen.value = true
  targetX.value = mouseX.value
  targetY.value = mouseY.value
}

function handleMouseLeave() {
  mouseOnScreen.value = false
}

function handleWindowBlur() {
  mouseOnScreen.value = false
}

onMounted(() => {
  if (!enabled.value) return
  frame = requestAnimationFrame(tick)
  document.documentElement.addEventListener('mouseenter', handleMouseEnter)
  document.documentElement.addEventListener('mouseleave', handleMouseLeave)
  window.addEventListener('blur', handleWindowBlur)
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  document.documentElement.removeEventListener('mouseenter', handleMouseEnter)
  document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
  window.removeEventListener('blur', handleWindowBlur)
})

watch([mouseX, mouseY], ([mx, my]) => {
  if (!enabled.value || !mouseOnScreen.value) return
  targetX.value = mx
  targetY.value = my
})
</script>

<style scoped>
.mouse-glow-fx {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.mouse-glow-fx--visible {
  opacity: 1;
}

.mouse-glow-orb {
  position: absolute;
  top: 0;
  left: 0;
  width: 32rem;
  height: 32rem;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(255 107 0 / 0.13) 0%,
    rgb(255 107 0 / 0.04) 42%,
    transparent 70%
  );
  will-change: transform;
}

:global(.dark) .mouse-glow-orb {
  background: radial-gradient(
    circle,
    rgb(255 107 0 / 0.1) 0%,
    rgb(255 107 0 / 0.035) 45%,
    transparent 72%
  );
}

.mouse-glow-grid-highlight {
  opacity: 0.9;
}
</style>
