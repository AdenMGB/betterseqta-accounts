<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-500 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900">
      <div class="text-center">
        <!-- Logo/Icon Animation -->
        <div class="flex items-center justify-center mb-8">
          <!-- Animated rings -->
          <div class="relative w-24 h-24">
            <div class="w-full h-full border-2 border-zinc-600/30 rounded-full animate-pulse"></div>
            <div class="absolute top-0 left-0 w-full h-full border-t-2 border-primary-500 rounded-full animate-spin" style="animation-duration: 2s;"></div>
            <div class="absolute top-2 left-2 w-20 h-20 border-2 border-zinc-500/20 rounded-full animate-pulse" style="animation-delay: 0.5s;"></div>
          </div>
        </div>

        <!-- Loading text -->
        <div class="space-y-3">
          <h1 class="text-3xl font-bold text-white font-display">
            BetterSEQTA+
          </h1>
          <p class="text-zinc-300 text-lg">
            Loading your account...
          </p>
        </div>

        <!-- Animated dots -->
        <div class="flex items-center justify-center space-x-2 mt-6">
          <div class="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style="animation-delay: 0ms;"></div>
          <div class="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style="animation-delay: 150ms;"></div>
          <div class="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style="animation-delay: 300ms;"></div>
        </div>

        <!-- Progress bar -->
        <div class="mt-8 w-64 mx-auto">
          <div class="w-full bg-zinc-700/50 rounded-full h-2 overflow-hidden">
            <div
              class="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-300 ease-out shadow-lg"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
          <p class="text-zinc-400 text-sm mt-2">{{ Math.round(progress) }}%</p>
        </div>

        <!-- Subtle background pattern -->
        <div class="absolute inset-0 -z-10 opacity-10">
          <div class="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const progress = ref(0)
let progressInterval: NodeJS.Timeout | null = null

// Simulate progress when loading starts
watch(() => props.show, (newShow) => {
  if (newShow) {
    progress.value = 0
    progressInterval = setInterval(() => {
      if (progress.value < 90) {
        progress.value += Math.random() * 15
      }
    }, 200)
  } else {
    progress.value = 100
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
  }
})

onMounted(() => {
  if (props.show) {
    progress.value = 0
  }
})

onUnmounted(() => {
  if (progressInterval) {
    clearInterval(progressInterval)
  }
})
</script>

<style scoped>
/* No custom styles needed for this version */
</style> 