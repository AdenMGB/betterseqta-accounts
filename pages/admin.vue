<template>
  <div class="max-w-6xl mx-auto space-y-8 pb-20">
    <div class="text-center animate-slide-down">
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Admin Dashboard</h1>
      <p class="text-zinc-600 dark:text-zinc-400">Manage users and OAuth clients</p>
    </div>

    <div v-if="!auth.user.value?.is_admin" class="text-center py-12 animate-fade-in">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <ShieldExclamationIcon class="w-8 h-8 text-red-500" />
        </div>
        <h2 class="text-xl font-bold text-zinc-900 dark:text-white mb-2">Access Denied</h2>
        <p class="text-zinc-600 dark:text-zinc-400">You do not have permission to view this page.</p>
        <NuxtLink to="/" class="inline-block mt-6 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">Return Home</NuxtLink>
    </div>

    <div v-else class="backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-8 animate-fade-in">
      
      <!-- Tabs -->
      <div class="flex space-x-4 border-b border-zinc-200 dark:border-zinc-700 mb-6">
        <button 
            @click="activeTab = 'users'" 
            :class="['pb-2 px-1 font-medium transition-colors duration-200 border-b-2', activeTab === 'users' ? 'border-primary-500 text-primary-500' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300']"
        >
            Users
        </button>
        <button 
            @click="activeTab = 'clients'" 
            :class="['pb-2 px-1 font-medium transition-colors duration-200 border-b-2', activeTab === 'clients' ? 'border-primary-500 text-primary-500' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300']"
        >
            OAuth Clients
        </button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="space-y-6">
        <div class="flex gap-4 items-center">
            <input 
                v-model="searchQuery" 
                @keyup.enter="handleSearch" 
                type="text" 
                placeholder="Search by username or email..." 
                class="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
            >
            <button @click="handleSearch" class="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200">Search</button>
        </div>

        <div v-if="searched" class="text-sm text-zinc-600 dark:text-zinc-400">
            Total users: <span class="font-semibold text-zinc-900 dark:text-white">{{ totalUsers }}</span>
        </div>

        <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div class="max-h-[600px] overflow-y-auto">
                <table class="w-full text-left">
                    <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800/95 backdrop-blur-sm z-10">
                        <tr class="border-b border-zinc-200 dark:border-zinc-700">
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">User</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Email</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Role</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-for="user in users" :key="user.id" class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
                            <td class="py-4 px-4 text-zinc-900 dark:text-white font-medium">{{ user.username }}</td>
                            <td class="py-4 px-4 text-zinc-600 dark:text-zinc-400">{{ user.email }}</td>
                            <td class="py-4 px-4">
                                <span :class="['px-2 py-1 text-xs rounded-full', user.is_admin ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300']">
                                    {{ user.is_admin ? 'Admin' : 'User' }}
                                </span>
                            </td>
                            <td class="py-4 px-4 text-right">
                                <button 
                                    @click="toggleAdmin(user)" 
                                    :class="['text-sm font-medium transition-colors duration-200', user.is_admin ? 'text-red-500 hover:text-red-600' : 'text-primary-500 hover:text-primary-600']"
                                >
                                    {{ user.is_admin ? 'Revoke Admin' : 'Make Admin' }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="users.length === 0 && searched" class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    No users found.
                </div>
            </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between">
            <div class="text-sm text-zinc-600 dark:text-zinc-400">
                Page {{ currentPage }} of {{ totalPages }}
            </div>
            <div class="flex gap-2">
                <button 
                    @click="goToPage(currentPage - 1)"
                    :disabled="currentPage === 1"
                    :class="['px-4 py-2 rounded-lg transition-all duration-200', currentPage === 1 ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-primary-500 text-white hover:bg-primary-600 hover:scale-105 active:scale-95']"
                >
                    Previous
                </button>
                <button 
                    @click="goToPage(currentPage + 1)"
                    :disabled="currentPage === totalPages"
                    :class="['px-4 py-2 rounded-lg transition-all duration-200', currentPage === totalPages ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-primary-500 text-white hover:bg-primary-600 hover:scale-105 active:scale-95']"
                >
                    Next
                </button>
            </div>
        </div>
      </div>

      <!-- OAuth Clients Tab -->
      <div v-if="activeTab === 'clients'" class="space-y-8">
        <!-- Create Client -->
        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Create New Client</h3>
            <form @submit.prevent="createClient" class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">App Name</label>
                    <input v-model="newClient.name" type="text" required class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Redirect URI</label>
                    <input v-model="newClient.redirect_uri" type="url" required class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white">
                </div>
                <button type="submit" class="md:col-span-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex justify-center items-center">
                    <LoadingSpinner v-if="creatingClient" size="sm" class="mr-2" />
                    Create Client
                </button>
            </form>
            
            <!-- Success Message with Keys -->
            <div v-if="lastCreatedClient" class="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 class="text-green-800 dark:text-green-300 font-medium mb-2">Client Created Successfully!</h4>
                <div class="grid gap-2 text-sm">
                    <div class="flex justify-between items-center">
                        <span class="text-zinc-600 dark:text-zinc-400">Client ID:</span>
                        <code class="bg-white dark:bg-black/30 px-2 py-1 rounded select-all">{{ lastCreatedClient.id }}</code>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-zinc-600 dark:text-zinc-400">Client Secret:</span>
                        <code class="bg-white dark:bg-black/30 px-2 py-1 rounded select-all break-all text-right">{{ lastCreatedClient.secret }}</code>
                    </div>
                </div>
            </div>
        </div>

        <!-- Clients List -->
        <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Existing Clients</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-zinc-200 dark:border-zinc-700">
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Name</th>
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Client ID</th>
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Redirect URI</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-for="client in clients" :key="client.id">
                            <td class="py-4 text-zinc-900 dark:text-white font-medium">{{ client.name }}</td>
                            <td class="py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{{ client.id }}</td>
                            <td class="py-4 text-zinc-600 dark:text-zinc-400 text-sm truncate max-w-xs" :title="client.redirect_uri">{{ client.redirect_uri }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { ShieldExclamationIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

const auth = useAuth()
const activeTab = ref('users')

// Users State
const searchQuery = ref('')
const users = ref<any[]>([])
const searched = ref(false)
const totalUsers = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)

// Clients State
const clients = ref<any[]>([])
const newClient = ref({ name: '', redirect_uri: '' })
const creatingClient = ref(false)
const lastCreatedClient = ref<any>(null)

// Actions
const searchUsers = async (page: number = 1) => {
    try {
        const res = await $fetch<{ users: any[], total: number, page: number, pageSize: number, totalPages: number }>('/api/admin/users', {
            params: { q: searchQuery.value, page },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        users.value = res.users
        totalUsers.value = res.total
        currentPage.value = res.page
        totalPages.value = res.totalPages
        searched.value = true
    } catch (e) {
        console.error('Failed to search users', e)
    }
}

const handleSearch = () => {
    searchUsers(1)
}

const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
        searchUsers(page)
    }
}

const toggleAdmin = async (user: any) => {
    if (!confirm(`Are you sure you want to ${user.is_admin ? 'revoke admin from' : 'make admin'} ${user.username}?`)) return
    
    try {
        await $fetch('/api/admin/promote', {
            method: 'POST',
            body: { userId: user.id, isAdmin: !user.is_admin },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        // Refresh local state
        user.is_admin = !user.is_admin
    } catch (e) {
        alert('Failed to update user role')
    }
}

const loadClients = async () => {
    try {
        const res = await $fetch<any[]>('/api/admin/clients', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        clients.value = res
    } catch (e) {
        console.error('Failed to load clients', e)
    }
}

const createClient = async () => {
    creatingClient.value = true
    lastCreatedClient.value = null
    try {
        const res = await $fetch<any>('/api/admin/clients', {
            method: 'POST',
            body: newClient.value,
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        lastCreatedClient.value = res
        clients.value.unshift(res)
        newClient.value = { name: '', redirect_uri: '' }
    } catch (e) {
        alert('Failed to create client')
    } finally {
        creatingClient.value = false
    }
}

onMounted(() => {
    if (auth.user.value?.is_admin) {
        loadClients()
        searchUsers(1) // Load initial users
    }
})
</script>

