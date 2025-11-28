<template>
  <div class="relative">
    <div class="flex items-center gap-2">
      <button
        @click="isOpen = !isOpen"
        class="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        :style="{ backgroundColor: modelValue }"
        type="button"
      ></button>
      <input
        type="text"
        v-model="internalValue"
        @blur="updateColor"
        class="w-28 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 font-mono text-sm uppercase"
        maxlength="7"
      />
    </div>

    <!-- Popover -->
    <div
      v-if="isOpen"
      class="absolute z-50 mt-2 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 animate-fade-in w-64"
    >
      <!-- Preset Colors -->
      <div class="grid grid-cols-5 gap-2 mb-3">
        <button
          v-for="color in presets"
          :key="color"
          @click="selectColor(color)"
          class="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-600 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
          :style="{ backgroundColor: color }"
          :class="{ 'ring-2 ring-offset-2 ring-primary-500': modelValue === color }"
          type="button"
        ></button>
      </div>
      
      <!-- Backdrop to close -->
      <div class="fixed inset-0 -z-10" @click="isOpen = false"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const internalValue = ref(props.modelValue)

const presets = [
  '#ff7e5f', '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#d946ef', '#f43f5e', '#64748b', '#000000', '#ffffff'
]

watch(() => props.modelValue, (newVal) => {
  internalValue.value = newVal
})

const selectColor = (color: string) => {
  emit('update:modelValue', color)
  internalValue.value = color
  isOpen.value = false
}

const updateColor = () => {
  let val = internalValue.value
  if (!val.startsWith('#')) val = '#' + val
  if (/^#[0-9A-F]{6}$/i.test(val)) {
    emit('update:modelValue', val)
  } else {
    internalValue.value = props.modelValue // Revert if invalid
  }
}
</script>

