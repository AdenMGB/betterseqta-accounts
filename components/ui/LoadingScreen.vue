<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-50 pointer-events-none">
      <!-- Top loading bar -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-zinc-800/80 overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-primary-500 via-primary-400 to-primary-500 bg-[length:200%_100%] animate-loading-bar"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ show: boolean }>()
</script>

<style scoped>
@keyframes loading-bar {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
.animate-loading-bar {
  animation: loading-bar 1.2s ease-in-out infinite;
}
</style>
