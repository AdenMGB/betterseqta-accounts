<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <div class="relative">
      <!-- Spinner rings -->
      <div 
        class="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full animate-spin"
        :class="spinnerClass"
      ></div>
      <div 
        class="absolute top-0 left-0 w-6 h-6 border-2 border-transparent border-t-primary-500 rounded-full animate-spin"
        :style="{ animationDuration: '1s' }"
      ></div>
    </div>
    
    <!-- Loading text -->
    <span v-if="text" class="ml-2 text-sm text-gray-600 dark:text-gray-400">
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