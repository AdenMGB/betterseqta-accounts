<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div class="relative">
      <!-- Spinner rings -->
      <div 
        class="border-2 border-zinc-300 dark:border-zinc-600 rounded-full animate-spin"
        :class="spinnerClass"
      ></div>
      <div 
        class="absolute top-0 left-0 border-2 border-transparent border-t-primary-500 rounded-full animate-spin"
        :class="spinnerClass"
        :style="{ animationDuration: '1s' }"
      ></div>
      <!-- Inner ring for larger sizes -->
      <div 
        v-if="size === 'lg'"
        class="absolute top-1 left-1 w-6 h-6 border border-zinc-400/30 dark:border-zinc-500/30 rounded-full animate-pulse"
      ></div>
    </div>
    
    <!-- Loading text -->
    <span v-if="text" class="ml-3 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
      {{ text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  text: '',
  containerClass: ''
})

const spinnerClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-4 h-4'
    case 'lg':
      return 'w-8 h-8'
    default:
      return 'w-6 h-6'
  }
})
</script> 