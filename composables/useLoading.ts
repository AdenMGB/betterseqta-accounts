import { ref } from 'vue'

const isInitialLoading = ref(true)
const isLoading = ref(false)

export function useLoading() {
  const startInitialLoading = () => {
    isInitialLoading.value = true
  }

  const stopInitialLoading = () => {
    isInitialLoading.value = false
  }

  const startLoading = () => {
    isLoading.value = true
  }

  const stopLoading = () => {
    isLoading.value = false
  }

  return {
    isInitialLoading,
    isLoading,
    startInitialLoading,
    stopInitialLoading,
    startLoading,
    stopLoading
  }
} 