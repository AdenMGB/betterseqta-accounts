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
import LoadingScreen from '~/components/ui/LoadingScreen.vue'

const { isInitialLoading, stopInitialLoading } = useLoading()
const auth = useAuth()
const { getSettings, syncSettings } = useSettings()

// Default settings as fallback
const defaultSettings = {"shortcuts":[],"feeds":[],"weather_enabled":true,"weather_city":"","weather_country":"","reminders_enabled":true,"force_use_location":false,"accent_color":"#ff7e5f","theme":"dark","disable_school_picture":false,"enhanced_animations":true,"gemini_api_key":"","ai_integrations_enabled":true,"grade_analyser_enabled":true,"lesson_summary_analyser_enabled":true,"auto_collapse_sidebar":false,"auto_expand_sidebar_hover":false,"global_search_enabled":true,"current_theme":"sunset","dev_sensitive_info_hider":false,"dev_force_offline_mode":false,"accepted_cloud_eula":true,"language":"en"}

onMounted(async () => {
  // Initialize theme
  const theme = localStorage.getItem('theme')
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

    try {
    // Fetch user data
    await auth.fetchUser()

    // Sync default settings if none exist
    if (auth.user.value) {
        try {
            const settings = await getSettings();
            if (Object.keys(settings).length === 0) {
                await syncSettings(defaultSettings);
            }
        } catch (e) {
            console.error("Failed to initialize settings", e);
        }
    }
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

.page-enter-to {
  opacity: 1;
  transform: none;
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style> 