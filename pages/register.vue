<template>
  <div class="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
    <div v-if="checkingSession" class="text-center">
      <LoadingSpinner size="lg" />
    </div>
    <div v-else class="w-full max-w-md animate-fade-in">
      <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display">Create Account</h1>
          <p class="text-zinc-600 dark:text-zinc-400">Join BetterSEQTA+ and start connecting</p>
        </div>
        <form @submit.prevent="onSubmit" class="space-y-6">
          <div>
            <label for="displayName" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Display Name</label>
            <div class="mt-1">
        <input
          v-model="displayName"
                id="displayName"
                name="displayName"
          type="text"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your display name"
              >
            </div>
          </div>

          <div>
            <label for="username" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Username</label>
            <div class="mt-1">
        <input
          v-model="username"
                id="username"
                name="username"
          type="text"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Choose a username"
              >
            </div>
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Email</label>
            <div class="mt-1">
        <input
          v-model="email"
                id="email"
                name="email"
          type="email"
          required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your email"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Password</label>
            <div class="mt-1">
        <input
          v-model="password"
                id="password"
                name="password"
                type="password"
                required
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Create a password"
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
                class="w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Confirm your password"
              >
            </div>
          </div>

          <div class="space-y-3">
            <label class="flex items-start gap-2 cursor-pointer">
              <input
                v-model="privacyPolicyAccepted"
                type="checkbox"
                class="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-zinc-700 dark:text-zinc-300">
                I agree to the
                <a
                  href="https://betterseqta.org/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400"
                >Privacy Policy</a>
              </span>
            </label>
            <label class="flex items-start gap-2 cursor-pointer">
              <input
                v-model="termsOfServiceAccepted"
                type="checkbox"
                class="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-zinc-700 dark:text-zinc-300">
                I agree to the
                <a
                  href="https://betterseqta.org/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400"
                >Terms of Service</a>
              </span>
            </label>
            <label class="flex items-start gap-2 cursor-pointer">
              <input
                v-model="age13Confirmed"
                type="checkbox"
                class="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-primary-500 focus:ring-primary-500"
              />
              <span class="text-sm text-zinc-700 dark:text-zinc-300">
                I confirm that I am over the age of 13
              </span>
            </label>
          </div>

          <div v-if="error" class="text-red-500 dark:text-red-400 text-sm text-center">
            {{ error }}
          </div>

          <div>
        <button
          type="submit"
          :disabled="loading || !canSubmit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:bg-primary-500/50 dark:disabled:bg-primary-800 disabled:cursor-not-allowed"
        >
              <LoadingSpinner v-if="loading" size="sm" />
              <span v-else>Create Account</span>
        </button>
          </div>
        </form>
        <div class="mt-6 text-center">
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?
            <NuxtLink :to="signInTo" class="font-medium text-primary-600 dark:text-primary-500 hover:text-primary-500 dark:hover:text-primary-400">
              Sign in
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import {
  getPostLoginRedirect,
  loginLocation,
  navigateAfterLogin,
  setPostLoginRedirect,
} from '~/utils/postLoginRedirect'

definePageMeta({ layout: false })

const displayName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const privacyPolicyAccepted = ref(false)
const termsOfServiceAccepted = ref(false)
const age13Confirmed = ref(false)
const error = ref('')
const loading = ref(false)
const checkingSession = ref(true)
const route = useRoute()
const { user, fetchUser, isLoggedIn } = useAuth()

const signInTo = computed(() =>
  loginLocation(getPostLoginRedirect(route.query.redirect)),
)

onMounted(async () => {
  if (route.query.redirect) {
    setPostLoginRedirect(getPostLoginRedirect(route.query.redirect))
  }
  await fetchUser()
  if (isLoggedIn()) {
    await navigateAfterLogin(getPostLoginRedirect(route.query.redirect))
    return
  }
  checkingSession.value = false
})

const canSubmit = computed(
  () => privacyPolicyAccepted.value && termsOfServiceAccepted.value && age13Confirmed.value,
)

const onSubmit = async () => {
  error.value = ''
  loading.value = true

  if (!canSubmit.value) {
    error.value = 'Please accept the privacy policy, terms of service, and confirm you are over 13.'
    loading.value = false
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    loading.value = false
    return
  }

  try {
    const res = await $fetch<{ user?: Record<string, unknown> }>('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      body: {
        email: email.value,
        password: password.value,
        username: username.value,
        displayName: displayName.value,
        privacyPolicyAccepted: privacyPolicyAccepted.value,
        termsOfServiceAccepted: termsOfServiceAccepted.value,
        age13Confirmed: age13Confirmed.value,
      },
    })
    if (res?.user) {
      user.value = res.user
      await fetchUser()
      await navigateAfterLogin(getPostLoginRedirect(route.query.redirect))
      return
    }
    error.value = 'Registration failed. Please try again.'
  } catch (err: any) {
    error.value = err?.data?.error || err?.data?.statusMessage || 'Registration failed.'
  } finally {
    loading.value = false
  }
}
</script>
