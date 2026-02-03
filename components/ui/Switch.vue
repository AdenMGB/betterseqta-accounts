<template>
  <Switch
    v-model="model"
    :class="[
      model ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700',
      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
    ]"
  >
    <span class="sr-only">Use setting</span>
    <span
      aria-hidden="true"
      :class="[
        model ? 'translate-x-5' : 'translate-x-0',
        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
      ]"
    />
  </Switch>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Switch } from '@headlessui/vue'

const props = defineProps<{
  modelValue?: boolean
  invert?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.invert ? !props.modelValue : props.modelValue,
  set: (val) => emit('update:modelValue', props.invert ? !val : val)
})
</script>

