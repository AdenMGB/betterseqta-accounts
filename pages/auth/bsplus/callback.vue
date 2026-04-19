<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="text-center space-y-4">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
        <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-zinc-900 dark:text-white">Signed in successfully</h1>
      <p class="text-zinc-500 dark:text-zinc-400">You can close this tab and return to BetterSEQTA+.</p>
    </div>
  </div>
</template>
