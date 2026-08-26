<template>
  <Listbox
    :model-value="modelValue"
    @update:model-value="onChange"
  >
    <div class="relative inline-block w-max max-w-full text-left" :class="wrapperClass">
      <ListboxButton
        :class="[
          'inline-flex w-max max-w-full items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-300 bg-white/50 px-3 py-2 text-sm text-zinc-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white',
          buttonClass,
        ]"
      >
        <span>{{ displayLabel }}</span>
        <ChevronUpDownIcon class="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
      </ListboxButton>

      <ListboxOptions
        class="absolute z-50 mt-1 max-h-60 w-max min-w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-xl focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-black/40"
      >
        <ListboxOption
          v-for="option in options"
          :key="option.value"
          v-slot="{ active, selected }"
          :value="option.value"
          as="template"
        >
          <li
            :class="[
              'cursor-pointer select-none whitespace-nowrap px-3 py-2 transition-colors',
              active
                ? 'bg-primary-500/10 text-zinc-900 dark:text-white'
                : 'text-zinc-700 dark:text-zinc-300',
              selected ? 'font-medium text-primary-600 dark:text-primary-400' : '',
            ]"
          >
            {{ option.label }}
          </li>
        </ListboxOption>
      </ListboxOptions>
    </div>
  </Listbox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue'
import { ChevronUpDownIcon } from '@heroicons/vue/20/solid'

export type SelectOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SelectOption[]
    placeholder?: string
    wrapperClass?: string
    buttonClass?: string
  }>(),
  {
    placeholder: 'Select…',
    wrapperClass: '',
    buttonClass: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const displayLabel = computed(() => {
  const match = props.options.find((o) => o.value === props.modelValue)
  return match?.label ?? props.placeholder
})

function onChange(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>
