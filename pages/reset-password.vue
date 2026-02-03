<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div class="w-full max-w-md animate-fade-in">
      <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
        <!-- Request Reset Form -->
        <div v-if="!hasToken">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display">Reset Password</h1>
            <p class="text-zinc-600 dark:text-zinc-400 mt-2">Enter your email or username to receive a password reset link</p>
          </div>

          <form @submit.prevent="requestReset" class="space-y-6">
            <div>
              <label for="login" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Email or Username</label>
              <div class="mt-1">
                <input
                  v-model="login"
                  id="login"
                  name="login"
                  type="text"
                  required
                  :disabled="loading"
                  class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your email or username"
                >
              </div>
            </div>

            <div v-if="successMessage" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p class="text-sm text-green-800 dark:text-green-200 font-medium">{{ successMessage }}</p>
              <div class="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                <p class="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Can't find the email?</strong> Please check your spam, junk, promotions, and other email folders. Sometimes emails can end up there.
                </p>
              </div>
            </div>

            <div v-if="error" class="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              {{ error }}
            </div>

            <div>
              <button
                type="submit"
                :disabled="loading || cooldownRemaining > 0"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:bg-primary-500/50 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
              >
                <LoadingSpinner v-if="loading" size="sm" />
                <span v-else-if="cooldownRemaining > 0">Request Reset ({{ formatTime(cooldownRemaining) }})</span>
                <span v-else>Send Reset Email</span>
              </button>
            </div>

            <div v-if="showResendButton && cooldownRemaining > 0" class="text-center">
              <button
                type="button"
                @click="requestReset"
                :disabled="cooldownRemaining > 0 || loading"
                class="text-sm font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                Resend email <span v-if="cooldownRemaining > 0">({{ formatTime(cooldownRemaining) }})</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Reset Password Form -->
        <div v-else>
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display">Set New Password</h1>
            <p class="text-zinc-600 dark:text-zinc-400 mt-2">Enter your new password below</p>
          </div>

          <form @submit.prevent="resetPassword" class="space-y-6">
            <div>
              <label for="newPassword" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">New Password</label>
              <div class="mt-1">
                <input
                  v-model="newPassword"
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  :disabled="loading"
                  class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter new password (min. 8 characters)"
                >
              </div>
            </div>

            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Confirm Password</label>
              <div class="mt-1">
                <input
                  v-model="confirmPassword"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  :disabled="loading"
                  class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Confirm new password"
                >
              </div>
            </div>

            <div v-if="passwordMismatch" class="text-red-500 dark:text-red-400 text-sm">
              Passwords do not match
            </div>

            <div v-if="error" class="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              {{ error }}
            </div>

            <div v-if="resetSuccess" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p class="text-sm text-green-800 dark:text-green-200 font-medium">Password reset successfully! Redirecting to login...</p>
            </div>

            <div>
              <button
                type="submit"
                :disabled="loading || passwordMismatch || resetSuccess"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:bg-primary-500/50 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
              >
                <LoadingSpinner v-if="loading" size="sm" />
                <span v-else>Reset Password</span>
              </button>
            </div>
          </form>
        </div>

        <div class="mt-6 text-center">
          <NuxtLink to="/login" class="text-sm font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400">
            ← Back to Login
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

definePageMeta({ layout: false })

const router = useRouter()
const route = useRoute()

const login = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const successMessage = ref('')
const loading = ref(false)
const resetSuccess = ref(false)
const showResendButton = ref(false)
const cooldownRemaining = ref(0)
const cooldownInterval = ref<NodeJS.Timeout | null>(null)

const token = computed(() => route.query.token as string | undefined)
const hasToken = computed(() => !!token.value)
const passwordMismatch = computed(() => {
  if (!newPassword.value || !confirmPassword.value) return false
  return newPassword.value !== confirmPassword.value
})

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const startCooldown = (seconds: number) => {
  cooldownRemaining.value = seconds
  showResendButton.value = true
  
  if (cooldownInterval.value) {
    clearInterval(cooldownInterval.value)
  }
  
  cooldownInterval.value = setInterval(() => {
    if (cooldownRemaining.value > 0) {
      cooldownRemaining.value--
    } else {
      if (cooldownInterval.value) {
        clearInterval(cooldownInterval.value)
        cooldownInterval.value = null
      }
    }
  }, 1000)
}

const requestReset = async () => {
  loading.value = true
  error.value = ''
  successMessage.value = ''
  
  try {
    const res: any = await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { login: login.value },
    })
    
    if (res.success) {
      successMessage.value = res.message || 'If an account exists, a reset email has been sent. Please check your inbox, spam, and other folders.'
      startCooldown(300) // 5 minutes
    }
  } catch (err: any) {
    if (err.status === 429) {
      const retryAfter = err.data?.retryAfter || 300
      error.value = `Please wait ${formatTime(retryAfter)} before requesting another reset email.`
      startCooldown(retryAfter)
    } else {
      error.value = err?.data?.error || 'An error occurred. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

const resetPassword = async () => {
  if (passwordMismatch.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters long'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const res: any = await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { 
        token: token.value,
        newPassword: newPassword.value 
      },
    })
    
    if (res.success) {
      resetSuccess.value = true
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  } catch (err: any) {
    error.value = err?.data?.error || 'Failed to reset password. The link may have expired or already been used.'
  } finally {
    loading.value = false
  }
}

const verifyToken = async () => {
  if (!token.value) return
  
  try {
    const res: any = await $fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token.value)}`)
    if (!res.valid) {
      error.value = res.reason === 'expired' 
        ? 'This reset link has expired. Please request a new one.'
        : res.reason === 'used'
        ? 'This reset link has already been used. Please request a new one.'
        : 'Invalid reset link. Please request a new one.'
    }
  } catch (err) {
    error.value = 'Invalid reset link. Please request a new one.'
  }
}

onMounted(() => {
  if (hasToken.value) {
    verifyToken()
  }
})

onUnmounted(() => {
  if (cooldownInterval.value) {
    clearInterval(cooldownInterval.value)
  }
})
</script>
