<template>
  <div>
    <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display mb-6">Settings</h1>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Settings Navigation -->
      <div class="lg:col-span-1">
        <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-4">
          <nav class="space-y-1">
            <button
              v-for="tab in tabs"
              :key="tab.name"
              @click="activeTab = tab.name"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium rounded-lg transition-all duration-200',
                activeTab === tab.name
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-white'
              ]"
            >
              <component :is="tab.icon" class="w-5 h-5" />
              <span>{{ tab.label }}</span>
            </button>
          </nav>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="lg:col-span-3">
        <div class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8">
          <!-- Profile Settings -->
          <div v-if="activeTab === 'profile'">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Profile Settings</h2>
            <form @submit.prevent="updateProfile" class="space-y-6">
              <!-- PFP Uploader -->
              <div class="flex items-center gap-4">
                <img :src="pfpPreview || auth.user.value?.pfpUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${auth.user.value?.username}`" alt="Profile Picture" class="w-20 h-20 rounded-full object-cover border-2 border-primary-500">
                <div>
                  <input type="file" ref="pfpInput" @change="handlePfpChange" accept="image/*" class="hidden">
                  <button type="button" @click="triggerPfpInput" class="px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-700/50 transition-all duration-200">
                    Change Picture
                  </button>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-2">PNG, JPG, GIF up to 2MB.</p>
                </div>
              </div>

              <!-- Display Name -->
              <div>
                <label for="displayName" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Display Name</label>
                <input v-model="displayName" id="displayName" type="text" required class="mt-1 w-full form-input">
              </div>

              <!-- Username -->
              <div>
                <label for="username" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300">Username</label>
                <input v-model="username" id="username" type="text" required class="mt-1 w-full form-input">
              </div>

              <div class="flex justify-end items-center gap-4">
                 <p v-if="success" class="text-green-500 text-sm">{{ success }}</p>
                 <p v-if="error" class="text-red-500 dark:text-red-400 text-sm">{{ error }}</p>
                <button type="submit" :disabled="loading" class="form-button-primary">
                  <LoadingSpinner v-if="loading" size="sm" />
                  <span v-else>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Account Settings -->
          <div v-if="activeTab === 'account'">
            <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Account Security</h2>
            <div class="space-y-6">
              <!-- Change Password -->
              <fieldset disabled class="opacity-50 cursor-not-allowed">
                 <legend class="text-base font-medium text-zinc-800 dark:text-zinc-300">Change Password <span class="text-xs text-primary-500">(Coming Soon)</span></legend>
                <div class="mt-4 space-y-4">
                  <div>
                    <label for="current-password" class="block text-sm font-medium">Current Password</label>
                    <input type="password" id="current-password" class="mt-1 w-full form-input">
                  </div>
                   <div>
                    <label for="new-password" class="block text-sm font-medium">New Password</label>
                    <input type="password" id="new-password" class="mt-1 w-full form-input">
                  </div>
                </div>
              </fieldset>
              
              <div class="flex justify-end">
                <button type="button" disabled class="form-button-primary opacity-50 cursor-not-allowed">Update Password</button>
              </div>
            </div>
          </div>
          
           <!-- BetterSEQTA Settings -->
          <div v-if="activeTab === 'bs-settings'">
             <h2 class="text-xl font-semibold text-zinc-900 dark:text-white mb-6">DesQTA Settings</h2>
             <div class="space-y-6">
                 <div>
                    <label for="json-editor" class="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-2">Settings JSON</label>
                    <textarea 
                        v-model="jsonSettings" 
                        id="json-editor" 
                        rows="15" 
                        class="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                    ></textarea>
                 </div>
                 <div class="flex justify-end items-center gap-4">
                     <p v-if="bsSuccess" class="text-green-500 text-sm">{{ bsSuccess }}</p>
                     <p v-if="bsError" class="text-red-500 dark:text-red-400 text-sm">{{ bsError }}</p>
                     <button @click="saveBsSettings" :disabled="bsLoading" class="form-button-primary">
                        <LoadingSpinner v-if="bsLoading" size="sm" />
                        <span v-else>Save Settings</span>
                     </button>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-input {
  @apply w-full px-3 py-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200;
}
.form-button-primary {
  @apply flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-100 dark:focus:ring-offset-zinc-900 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>

<script setup lang="ts">
import { ref, onMounted, shallowRef } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useSettings } from '~/composables/useSettings'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import { UserCircleIcon, ShieldCheckIcon, CogIcon } from '@heroicons/vue/24/outline'

const auth = useAuth()
const { getSettings, syncSettings } = useSettings()

const displayName = ref('')
const username = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')
const pfpInput = ref<HTMLInputElement | null>(null)
const pfpFile = ref<File | null>(null)
const pfpPreview = ref<string | null>(null)

const activeTab = ref('profile')
const tabs = [
  { name: 'profile', label: 'Profile', icon: shallowRef(UserCircleIcon) },
  { name: 'account', label: 'Account', icon: shallowRef(ShieldCheckIcon) },
  { name: 'bs-settings', label: 'DesQTA Settings', icon: shallowRef(CogIcon) },
]

// BS Settings state
const jsonSettings = ref('')
const bsLoading = ref(false)
const bsError = ref('')
const bsSuccess = ref('')

const triggerPfpInput = () => {
  pfpInput.value?.click()
}

onMounted(async () => {
  if (auth.user.value) {
    displayName.value = auth.user.value.displayName || ''
    username.value = auth.user.value.username || ''
  } else {
    auth.fetchUser().then(() => {
      displayName.value = auth.user.value?.displayName || ''
      username.value = auth.user.value?.username || ''
    })
  }
  
  // Load BS Settings
  try {
      const settings = await getSettings();
      jsonSettings.value = JSON.stringify(settings, null, 2);
  } catch (e) {
      console.error("Failed to load BS Settings", e);
  }
})

const handlePfpChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    pfpFile.value = target.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      pfpPreview.value = e.target?.result as string
    }
    reader.readAsDataURL(pfpFile.value)
  }
}

const updateProfile = async () => {
  error.value = ''
  success.value = ''
  loading.value = true
  
  try {
    let pfpUrl: string | undefined = undefined;
    
    // 1. Upload PFP if a new one is selected
    if (pfpFile.value) {
      const formData = new FormData()
      formData.append('file', pfpFile.value)
      
      const response = await $fetch<{ storedName: string }>('/api/files/upload?public=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      })
      
      // Construct the public URL for the profile picture
      pfpUrl = `/api/files/public/${response.storedName}`
    }
    
    // 2. Update user profile data
    const dataToUpdate: { displayName: string, username: string, pfpUrl?: string } = {
      displayName: displayName.value,
      username: username.value,
    }

    if (pfpUrl) {
      dataToUpdate.pfpUrl = pfpUrl
    }

    await $fetch('/api/user/update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: dataToUpdate,
    })
    
    success.value = 'Profile updated successfully.'
    await auth.fetchUser() // Refresh user data globally

  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Update failed.'
  } finally {
    loading.value = false
    pfpFile.value = null
  }
}

const saveBsSettings = async () => {
    bsLoading.value = true;
    bsError.value = '';
    bsSuccess.value = '';
    
    try {
        const parsedSettings = JSON.parse(jsonSettings.value);
        await syncSettings(parsedSettings);
        bsSuccess.value = 'Settings saved to cloud!';
    } catch (e) {
        bsError.value = 'Invalid JSON or save failed.';
        console.error(e);
    } finally {
        bsLoading.value = false;
    }
}
</script>
