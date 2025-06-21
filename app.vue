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
import LoadingScreen from '~/components/ui/LoadingScreen.vue'

const { isInitialLoading, stopInitialLoading } = useLoading()
const auth = useAuth()

onMounted(async () => {
  try {
    // Fetch user data
    await auth.fetchUser()
    
    // Add a small delay to show the loading screen
    await new Promise(resolve => setTimeout(resolve, 1500))
  } catch (error) {
    console.error('Error during initial load:', error)
  } finally {
    // Stop the initial loading screen
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

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style> 