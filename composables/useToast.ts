import { ref } from 'vue'

type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  show: boolean;
  message: string;
  type: ToastType;
}

const toastState = ref<ToastState>({
  show: false,
  message: '',
  type: 'info',
})

export function useToast() {
  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    toastState.value = { show: true, message, type }
    setTimeout(() => {
      hideToast()
    }, duration)
  }

  const hideToast = () => {
    toastState.value.show = false
  }

  return {
    toast: toastState,
    showToast,
    hideToast,
  }
} 