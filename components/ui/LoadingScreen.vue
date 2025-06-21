<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-500 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
      <div class="text-center">
        <!-- Logo/Icon Animation -->
        <div class="flex items-center justify-center mb-8">
          <!-- Rings -->
          <div class="relative w-24 h-24">
            <div class="w-full h-full border-2 border-white/30 rounded-full animate-pulse"></div>
            <div class="absolute top-0 left-0 w-full h-full border-t-2 border-white rounded-full animate-spin" style="animation-duration: 2s;"></div>
          </div>
          <!-- Icon -->
          <UserCircleIcon class="w-8 h-8 text-white -translate-x-10" />
        </div>

        <!-- Loading text -->
        <div class="space-y-2">
          <h1 class="text-3xl font-bold text-white">
            BetterSEQTA + Account
          </h1>
          <p class="text-white/80">
            Loading your account...
          </p>
        </div>

        <!-- Bouncing dots -->
        <div class="flex items-center justify-center space-x-2 mt-4">
          <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 0ms;"></div>
          <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 150ms;"></div>
          <div class="w-2 h-2 bg-white rounded-full animate-bounce" style="animation-delay: 300ms;"></div>
        </div>

        <!-- Progress bar -->
        <div class="mt-8 w-64 mx-auto">
          <div class="w-full bg-white/20 rounded-full h-1.5">
            <div
              class="bg-white h-1.5 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${progress}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { UserCircleIcon } from '@heroicons/vue/24/outline'

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