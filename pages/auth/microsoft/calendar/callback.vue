<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const error = computed(() => route.query.error as string | undefined)
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="text-center space-y-4 max-w-md px-4">
      <div
        v-if="error"
        class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4"
      >
        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div
        v-else
        class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4"
      >
        <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-zinc-900 dark:text-white">
        {{ error ? 'Outlook Calendar not connected' : 'Outlook Calendar connected' }}
      </h1>
      <p class="text-zinc-500 dark:text-zinc-400">
        {{
          error
            ? 'Authorization was denied or failed. You can close this tab and try again in BetterSEQTA+.'
            : 'You can close this tab and return to BetterSEQTA+.'
        }}
      </p>
    </div>
  </div>
</template>
