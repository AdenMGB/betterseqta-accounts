<template>
  <div>
    <!-- Global Loading Screen -->
    <LoadingScreen :show="isInitialLoading" />
    
    <!-- Main App Content -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useLoading } from '~/composables/useLoading'
import { useAuth } from '~/composables/useAuth'
import { useSettings } from '~/composables/useSettings'
import { buildFullSnapshot, loadDraft } from '~/utils/settings/sparseSettings'
import { desqtaSchema } from '~/utils/settings/desqtaSchema'
import LoadingScreen from '~/components/ui/LoadingScreen.vue'

const { isInitialLoading, stopInitialLoading } = useLoading()
const auth = useAuth()
const { getSettings, syncSettings } = useSettings()

const defaultSettings = buildFullSnapshot({}, loadDraft({}, desqtaSchema), desqtaSchema)

onMounted(async () => {
  const theme = localStorage.getItem('theme')
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  const loadingTimeout = window.setTimeout(() => stopInitialLoading(), 4000)

  try {
    await auth.fetchUser()

    if (auth.user.value) {
      try {
        const settings = await getSettings()
        if (Object.keys(settings).length === 0) {
          await syncSettings(defaultSettings)
        }
      } catch (e) {
        console.error('Failed to initialize settings', e)
      }
    }
  } catch (error) {
    console.error('Error during initial load:', error)
  } finally {
    window.clearTimeout(loadingTimeout)
    stopInitialLoading()
  }
})
</script>

<style>
/* Global styles */
html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease-in-out;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-enter-to {
  opacity: 1;
  transform: none;
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style> 