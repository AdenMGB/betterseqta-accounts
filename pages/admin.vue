<template>
  <div class="max-w-7xl mx-auto space-y-8 pb-20">
    <div class="text-center animate-slide-down">
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Admin Dashboard</h1>
      <p class="text-zinc-600 dark:text-zinc-400">Manage users and OAuth clients</p>
    </div>

    <div v-if="!auth.user.value || (auth.user.value?.admin_level || 0) === 0" class="text-center py-12 animate-fade-in">
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
        <button 
            @click="activeTab = 'apikeys'" 
            :class="['pb-2 px-1 font-medium transition-colors duration-200 border-b-2', activeTab === 'apikeys' ? 'border-primary-500 text-primary-500' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300']"
        >
            API Keys
        </button>
        <button 
            @click="activeTab = 'pfp-migration'" 
            :class="['pb-2 px-1 font-medium transition-colors duration-200 border-b-2', isTab('pfp-migration') ? 'border-primary-500 text-primary-500' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300']"
        >
            PFP Migration
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
            <select
                v-model="sortOption"
                class="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
            >
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <label class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer select-none shrink-0">
                <input type="checkbox" v-model="hasPfpFilter" class="rounded border-zinc-300 dark:border-zinc-700 text-primary-500 focus:ring-primary-500" />
                Has PFP
            </label>
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
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">PFP</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Role</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-for="user in users" :key="user.id" class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
                            <td class="py-4 px-4 text-zinc-900 dark:text-white font-medium">
                                <span v-if="editingUser?.id !== user.id">
                                    {{ user.displayName || user.username }}
                                    <span v-if="user.displayName && user.displayName !== user.username" class="text-xs text-zinc-500 dark:text-zinc-400 ml-1">({{ user.username }})</span>
                                </span>
                                <input 
                                    v-else
                                    v-model="editingUser.username"
                                    type="text"
                                    class="w-full px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                />
                            </td>
                            <td class="py-4 px-4 text-zinc-600 dark:text-zinc-400">
                                <span v-if="editingUser?.id !== user.id">{{ user.email }}</span>
                                <input 
                                    v-else
                                    v-model="editingUser.email"
                                    type="email"
                                    class="w-full px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                />
                            </td>
                            <td class="py-4 px-4">
                                <div class="flex items-center gap-2">
                                    <img
                                        :src="user.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`"
                                        alt=""
                                        class="w-9 h-9 rounded-full object-cover border border-zinc-300 dark:border-zinc-600 shrink-0 cursor-pointer"
                                        @click="openPfpView(user.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`)"
                                    />
                                    <div v-if="canModerateUsers() && user.pfpHistory?.length" class="flex -space-x-1">
                                        <div
                                            v-for="(h, idx) in user.pfpHistory.slice(0, 3)"
                                            :key="h.id"
                                            class="relative group"
                                        >
                                            <img
                                                :src="h.r2Key"
                                                alt=""
                                                class="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-zinc-800 cursor-pointer"
                                                :title="(idx < 2 ? 'Click to revert' : '')"
                                                @click="idx < 2 && revertPfp(user, h)"
                                            />
                                            <div
                                                v-if="idx < 2"
                                                class="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                title="Revert to this PFP"
                                            >
                                                <ArrowUturnLeftIcon class="w-2 h-2 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        v-if="canModerateUsers()"
                                        @click="triggerAdminPfpUpload(user)"
                                        class="text-zinc-400 hover:text-primary-500 transition-colors shrink-0"
                                        :title="'Upload PFP for ' + (user.displayName || user.username)"
                                    >
                                        <CameraIcon class="w-4 h-4" />
                                    </button>
                                    <input
                                        type="file"
                                        :ref="(el: any) => { if (el) pfpUploadInputs[user.id] = el }"
                                        @change="handleAdminPfpUpload(user, $event)"
                                        accept="image/*"
                                        class="hidden"
                                    />
                                </div>
                            </td>
                            <td class="py-4 px-4">
                                <span v-if="editingUser?.id !== user.id" :class="getRoleBadgeClass(user.admin_level || 0)">
                                    {{ getRoleLabel(user.admin_level || 0) }}
                                </span>
                                <div v-else class="flex items-center gap-2">
                                    <input 
                                        v-model="editingUser.displayName"
                                        type="text"
                                        placeholder="Display Name"
                                        class="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                    />
                                    <span :class="getRoleBadgeClass(user.admin_level || 0)">
                                        {{ getRoleLabel(user.admin_level || 0) }}
                                    </span>
                                </div>
                            </td>
                            <td class="py-4 px-4 text-right">
                                <div class="flex items-center gap-2 justify-end">
                                    <template v-if="editingUser?.id === user.id">
                                        <button 
                                            @click="saveUserEdit(user)"
                                            class="text-sm px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200"
                                        >
                                            Save
                                        </button>
                                        <button 
                                            @click="cancelUserEdit()"
                                            class="text-sm px-3 py-1 bg-zinc-500 text-white rounded-lg hover:bg-zinc-600 transition-colors duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </template>
                                    <template v-else>
                                        <button 
                                            v-if="canModerateUsers()"
                                            @click="startUserEdit(user)"
                                            class="text-sm px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            v-if="canPromoteUser(user.admin_level || 0)"
                                            @click="promoteUser(user)"
                                            class="text-sm px-3 py-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200"
                                        >
                                            Promote
                                        </button>
                                        <button 
                                            v-if="canDemoteUser(user.admin_level || 0)"
                                            @click="demoteUser(user)"
                                            class="text-sm px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
                                        >
                                            Demote
                                        </button>
                                        <button 
                                            v-if="getCurrentAdminLevel() > 0 && user.id !== auth.user.value?.id"
                                            @click="sendPasswordReset(user)"
                                            :disabled="sendingResetUserId === user.id"
                                            :title="'Send password reset email to ' + (user.displayName || user.username)"
                                            class="text-sm px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                                        >
                                            <EnvelopeIcon v-if="sendingResetUserId !== user.id" class="w-4 h-4 inline" />
                                            <LoadingSpinner v-else size="sm" container-class="inline-flex" />
                                            <span class="ml-1">Reset</span>
                                        </button>
                                        <button 
                                            v-if="canDeleteUser(user)"
                                            @click="deleteUser(user)"
                                            :disabled="deletingUserId === user.id"
                                            :title="'Delete user ' + (user.displayName || user.username)"
                                            class="text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                        >
                                            <TrashIcon v-if="deletingUserId !== user.id" class="w-4 h-4 inline" />
                                            <LoadingSpinner v-else size="sm" container-class="inline-flex" />
                                            <span class="ml-1">Delete</span>
                                        </button>
                                        <span v-if="!canPromoteUser(user.admin_level || 0) && !canDemoteUser(user.admin_level || 0) && !(canModerateUsers() && canModifyUser(user.admin_level || 0)) && !(getCurrentAdminLevel() > 0 && user.id !== auth.user.value?.id) && !canDeleteUser(user)" class="text-xs text-zinc-400 dark:text-zinc-500">
                                            Cannot modify
                                        </span>
                                    </template>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="users.length === 0 && searched" class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    No users found.
                </div>
            </div>
        </div>

        <!-- Infinite scroll sentinel -->
        <div ref="scrollSentinel" class="flex justify-center py-4">
            <LoadingSpinner v-if="loadingMore" size="md" />
            <span v-else-if="searched && currentPage < totalPages" class="text-xs text-zinc-400">Scroll for more</span>
            <span v-else-if="searched && users.length > 0" class="text-xs text-zinc-500">All users loaded</span>
        </div>
      </div>

      <!-- OAuth Clients Tab -->
      <div v-if="activeTab === 'clients'" class="space-y-8">
        <!-- DesQTA Clients -->
        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">DesQTA Clients</h3>
          <p class="text-zinc-600 dark:text-zinc-400">
            Reserved client instances: <span class="font-semibold text-zinc-900 dark:text-white">{{ desqtaClientsCount }}</span>
          </p>
        </div>

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
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-for="client in clients" :key="client.id">
                            <td class="py-4 text-zinc-900 dark:text-white font-medium">{{ client.name }}</td>
                            <td class="py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{{ client.id }}</td>
                            <td class="py-4 text-zinc-600 dark:text-zinc-400 text-sm truncate max-w-xs" :title="client.redirect_uri">{{ client.redirect_uri }}</td>
                            <td class="py-4 text-right">
                                <button
                                    v-if="getCurrentAdminLevel() >= maxAdminLevel || client.created_by === auth.user.value?.id"
                                    @click="deleteClient(client)"
                                    :disabled="deletingClientId === client.id"
                                    class="text-sm px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    :title="'Delete client ' + client.name"
                                >
                                    <TrashIcon v-if="deletingClientId !== client.id" class="w-4 h-4 inline" />
                                    <LoadingSpinner v-else size="sm" container-class="inline-flex" />
                                    <span class="ml-1">Delete</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      <!-- API Keys Tab -->
      <div v-if="activeTab === 'apikeys'" class="space-y-8">
        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">API Key Endpoints</h3>
          <p class="text-zinc-600 dark:text-zinc-400 text-sm">
            All endpoints use <code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> or <code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">X-API-Key: &lt;token&gt;</code>.
          </p>
          <ul class="text-sm text-zinc-600 dark:text-zinc-400 space-y-2 list-disc list-inside">
            <li><code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">GET /api/stats/discord</code> — <code>{ total, lastDay }</code> (Discord bot stats)</li>
            <li><code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">GET /api/export/users/count</code> — <code>{ total }</code> (user count only)</li>
            <li><code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">GET /api/export/reserved-clients</code> — <code>{ count }</code> (reserved DesQTA client instances)</li>
            <li><code class="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">GET /api/export/users/full</code> — <code>{ users, count }</code> (full user table, excludes password)</li>
          </ul>
        </div>

        <!-- Create API Key -->
        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Create New API Key</h3>
            <form @submit.prevent="createApiKey" class="flex gap-4 items-end">
                <div class="flex-1">
                    <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name (e.g. Discord Bot)</label>
                    <input v-model="newApiKeyName" type="text" required placeholder="Discord Bot" class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white">
                </div>
                <button type="submit" class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center">
                    <LoadingSpinner v-if="creatingApiKey" size="sm" class="mr-2" />
                    Create API Key
                </button>
            </form>
            
            <div v-if="lastCreatedApiKey" class="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 class="text-green-800 dark:text-green-300 font-medium mb-2">API Key Created! Copy it now – it won't be shown again.</h4>
                <div class="flex justify-between items-center gap-2">
                    <code class="flex-1 bg-white dark:bg-black/30 px-2 py-1 rounded text-sm break-all select-all">{{ lastCreatedApiKey.token }}</code>
                    <button @click="copyApiKey(lastCreatedApiKey.token)" class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 shrink-0">Copy</button>
                </div>
            </div>
        </div>

        <!-- API Keys List -->
        <div>
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Existing API Keys</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-zinc-200 dark:border-zinc-700">
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Name</th>
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Created</th>
                            <th class="pb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-for="key in apiKeys" :key="key.id">
                            <td class="py-4 text-zinc-900 dark:text-white font-medium">{{ key.name }}</td>
                            <td class="py-4 text-zinc-600 dark:text-zinc-400 text-sm">{{ formatDate(key.createdAt) }}</td>
                            <td class="py-4 text-right">
                                <button 
                                    @click="deleteApiKey(key)"
                                    :disabled="deletingApiKeyId === key.id"
                                    class="text-sm px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                >
                                    <TrashIcon v-if="deletingApiKeyId !== key.id" class="w-4 h-4 inline" />
                                    <LoadingSpinner v-else size="sm" container-class="inline-flex" />
                                    <span class="ml-1">Delete</span>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-if="apiKeys.length === 0" class="text-center py-6 text-zinc-500 dark:text-zinc-400">No API keys yet.</p>
        </div>
      </div>
      <!-- PFP Migration Tab -->
      <div v-if="isTab('pfp-migration')" class="space-y-6">
        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Migrate Profile Pictures to Cloudflare R2</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Downloads all user profile pictures from external providers (ImgBB, Discord CDN, etc.) and uploads them to our Cloudflare R2 bucket. Only users whose PFP is not already served from R2 will be processed.
          </p>
          <button
            @click="migratePfps"
            :disabled="migratingPfps"
            class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <LoadingSpinner v-if="migratingPfps" size="sm" />
            <template v-else>
              <ArrowPathIcon class="w-5 h-5" />
            </template>
            {{ migratingPfps ? 'Migrating...' : 'Start Migration' }}
          </button>
        </div>

        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Fix PFP URLs</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Prepends <code class="text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">https://accounts.betterseqta.org</code> to any PFP URLs stored as relative paths (e.g. <code class="text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">/api/user/pfp/...</code>).
          </p>
          <button
            @click="fixPfpUrls"
            :disabled="fixingPfpUrls"
            class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <LoadingSpinner v-if="fixingPfpUrls" size="sm" />
            <template v-else>
              <ArrowPathIcon class="w-5 h-5" />
            </template>
            {{ fixingPfpUrls ? 'Fixing...' : 'Fix URLs' }}
          </button>
        </div>

        <div v-if="urlFixResult" class="space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700 text-center">
              <p class="text-2xl font-bold text-zinc-900 dark:text-white">{{ urlFixResult.total }}</p>
              <p class="text-sm text-zinc-500 dark:text-zinc-400">Total Found</p>
            </div>
            <div class="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ urlFixResult.fixed }}</p>
              <p class="text-sm text-green-600 dark:text-green-400">Fixed</p>
            </div>
            <div class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
              <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ urlFixResult.failed }}</p>
              <p class="text-sm text-red-600 dark:text-red-400">Failed</p>
            </div>
          </div>
        </div>

        <div v-if="migrationResult" class="space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div class="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700 text-center">
              <p class="text-2xl font-bold text-zinc-900 dark:text-white">{{ migrationResult.total }}</p>
              <p class="text-sm text-zinc-500 dark:text-zinc-400">Total Found</p>
            </div>
            <div class="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
              <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ migrationResult.migrated }}</p>
              <p class="text-sm text-green-600 dark:text-green-400">Migrated</p>
            </div>
            <div class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
              <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ migrationResult.failed }}</p>
              <p class="text-sm text-red-600 dark:text-red-400">Failed</p>
            </div>
          </div>

          <div v-if="migrationResult.failed > 0" class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <div class="max-h-[300px] overflow-y-auto">
              <table class="w-full text-left">
                <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800/95 backdrop-blur-sm z-10">
                  <tr class="border-b border-zinc-200 dark:border-zinc-700">
                    <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">User ID</th>
                    <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Error</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                  <tr v-for="r in failedResults" :key="r.userId" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td class="py-3 px-4 text-sm font-mono text-zinc-900 dark:text-white">{{ r.userId }}</td>
                    <td class="py-3 px-4 text-sm text-red-500">{{ r.error }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Fullscreen PFP viewer -->
  <div
    v-if="pfpViewerSrc"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    @click="pfpViewerSrc = null"
  >
    <button
      class="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
      @click="pfpViewerSrc = null"
    >
      <XMarkIcon class="w-8 h-8" />
    </button>
    <img
      :src="pfpViewerSrc"
      alt=""
      class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { ShieldExclamationIcon, EnvelopeIcon, TrashIcon, ArrowPathIcon, ArrowUturnLeftIcon, CameraIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import { useIntersectionObserver } from '@vueuse/core'

const auth = useAuth()
const { showToast } = useToast()
const activeTab = ref<string>('users')

// Users State
const searchQuery = ref('')
const users = ref<any[]>([])
const searched = ref(false)
const totalUsers = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)
const maxAdminLevel = ref(3)
const editingUser = ref<any>(null)
const sendingResetUserId = ref<string | null>(null)
const deletingUserId = ref<string | null>(null)
const loadingMore = ref(false)
const scrollSentinel = ref<HTMLElement | null>(null)
const sortOption = ref('username:asc')
const hasPfpFilter = ref(false)

const sortOptions = [
  { value: 'username:asc', label: 'Username (A-Z)' },
  { value: 'username:desc', label: 'Username (Z-A)' },
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'email:asc', label: 'Email (A-Z)' },
  { value: 'email:desc', label: 'Email (Z-A)' },
  { value: 'admin_level:desc', label: 'Highest role' },
  { value: 'admin_level:asc', label: 'Lowest role' },
  { value: 'displayName:asc', label: 'Display name (A-Z)' },
  { value: 'displayName:desc', label: 'Display name (Z-A)' },
]

// Clients State
const clients = ref<any[]>([])
const desqtaClientsCount = ref(0)
const newClient = ref({ name: '', redirect_uri: '' })
const creatingClient = ref(false)
const lastCreatedClient = ref<any>(null)
const deletingClientId = ref<string | null>(null)

// API Keys State
const apiKeys = ref<any[]>([])
const newApiKeyName = ref('')
const creatingApiKey = ref(false)
const lastCreatedApiKey = ref<any>(null)
const deletingApiKeyId = ref<string | null>(null)

// PFP Management State
const pfpUploadInputs = ref<Record<string, HTMLInputElement>>({})
const revertingPfpId = ref<string | null>(null)
const uploadingPfpUserId = ref<string | null>(null)

const revertPfp = async (user: any, history: any) => {
  if (!confirm(`Revert ${user.displayName || user.username}'s profile picture to a previous version?`)) return
  revertingPfpId.value = history.id
  try {
    const res = await $fetch<{ pfpUrl: string }>('/api/admin/user/pfp/revert', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: { userId: user.id, historyId: history.id },
    })
    user.pfpUrl = res.pfpUrl
    showToast('PFP reverted', 'success')
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to revert PFP', 'error')
  } finally {
    revertingPfpId.value = null
  }
}

const triggerAdminPfpUpload = (user: any) => {
  pfpUploadInputs.value[user.id]?.click()
}

const handleAdminPfpUpload = async (user: any, event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const file = target.files[0]
  if (!file.type.startsWith('image/')) return
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large (max 5MB)', 'error')
    return
  }

  uploadingPfpUserId.value = user.id
  try {
    const formData = new FormData()
    formData.append('userId', user.id)
    formData.append('file', file)
    const res = await $fetch<{ pfpUrl: string }>('/api/admin/user/pfp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    })
    user.pfpUrl = res.pfpUrl
    showToast('PFP updated', 'success')
    await searchUsers(currentPage.value)
  } catch (e: any) {
    showToast(e?.data?.error || 'Failed to upload PFP', 'error')
  } finally {
    uploadingPfpUserId.value = null
    target.value = ''
  }
}

// PFP Migration State
const migratingPfps = ref(false)
const migrationResult = ref<{ total: number; migrated: number; failed: number; results: any[] } | null>(null)
const failedResults = computed(() => migrationResult.value?.results?.filter(r => !r.success) || [])
const isTab = (tab: string) => activeTab.value === tab

const pfpViewerSrc = ref<string | null>(null)
const openPfpView = (src: string) => { pfpViewerSrc.value = src }

// Actions
const searchUsers = async (page: number = 1, append: boolean = false) => {
    try {
        const res = await $fetch<{ users: any[], total: number, page: number, pageSize: number, totalPages: number, maxAdminLevel: number }>('/api/admin/users', {
            params: { q: searchQuery.value, page, sort: sortOption.value, has_pfp: hasPfpFilter.value || undefined },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        const mapped = res.users.map((user: any) => ({
            ...user,
            _previousAdminLevel: user.admin_level || 0
        }))
        if (append) {
            users.value = [...users.value, ...mapped]
        } else {
            users.value = mapped
        }
        totalUsers.value = res.total
        currentPage.value = res.page
        totalPages.value = res.totalPages
        maxAdminLevel.value = res.maxAdminLevel || 3
        searched.value = true
    } catch (e) {
        console.error('Failed to search users', e)
    }
}

const handleSearch = () => {
    searchUsers(1, false)
}

const loadMore = async () => {
    if (loadingMore.value || currentPage.value >= totalPages.value) return
    loadingMore.value = true
    await searchUsers(currentPage.value + 1, true)
    loadingMore.value = false
}

useIntersectionObserver(scrollSentinel, ([entry]) => {
    if (entry.isIntersecting && searched.value) {
        loadMore()
    }
}, { rootMargin: '200px' })

watch([sortOption, hasPfpFilter], () => {
    if (searched.value) searchUsers(1, false)
})

const getRoleLabel = (level: number): string => {
    if (level === 0) return 'User'
    if (level === maxAdminLevel.value) return 'Senior Admin'
    if (level === 1) return 'Junior Admin'
    if (level === 2) return 'Middle Admin'
    // For levels above 2 but below max, use generic naming
    return `Level ${level} Admin`
}

const getRoleBadgeClass = (level: number): string => {
    const baseClasses = 'px-2 py-1 text-xs rounded-full'
    if (level === 0) return `${baseClasses} bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300`
    if (level === maxAdminLevel.value) return `${baseClasses} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`
    if (level === 1) return `${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`
    if (level === 2) return `${baseClasses} bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300`
    // For other levels, use a gradient of colors
    return `${baseClasses} bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300`
}

const getCurrentAdminLevel = (): number => {
    return auth.user.value?.admin_level || 0
}

const canModifyUser = (targetUserLevel: number): boolean => {
    const currentLevel = getCurrentAdminLevel()
    // Can only modify users below your level
    return targetUserLevel < currentLevel
}

const canPromoteUser = (targetUserLevel: number): boolean => {
    const currentLevel = getCurrentAdminLevel()
    // Can only modify users below your level
    if (targetUserLevel >= currentLevel) return false
    
    // Only Senior Admins (highest level) can promote regular users (level 0) to admin
    if (targetUserLevel === 0 && currentLevel < maxAdminLevel.value) return false
    
    // Can promote existing admins up to currentLevel
    // But we'll let the backend handle the exact level validation
    return true
}

const canDemoteUser = (targetUserLevel: number): boolean => {
    const currentLevel = getCurrentAdminLevel()
    // Can only demote users at your level or below (but not yourself)
    return targetUserLevel > 0 && targetUserLevel < currentLevel
}

const canModerateUsers = (): boolean => {
    const currentLevel = getCurrentAdminLevel()
    // Require Middle Admin (level 2) or higher for moderator controls
    return currentLevel >= 2
}

const canDeleteUser = (user: any): boolean => {
    const currentLevel = getCurrentAdminLevel()
    if (currentLevel < maxAdminLevel.value) return false
    if (user.id === auth.user.value?.id) return false
    if ((user.admin_level || 0) >= maxAdminLevel.value) return false
    return true
}

const sendPasswordReset = async (user: any) => {
    if (!confirm(`Send a password reset email to ${user.displayName || user.username} (${user.email})?`)) return
    sendingResetUserId.value = user.id
    try {
        await $fetch('/api/admin/send-password-reset', {
            method: 'POST',
            body: { userId: user.id },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        showToast('Password reset email sent', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to send reset email', 'error')
    } finally {
        sendingResetUserId.value = null
    }
}

const deleteUser = async (user: any) => {
    if (!confirm(`Permanently delete ${user.displayName || user.username} (${user.email})? This cannot be undone.`)) return
    deletingUserId.value = user.id
    try {
        await $fetch('/api/admin/delete-user', {
            method: 'POST',
            body: { userId: user.id },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        users.value = users.value.filter(u => u.id !== user.id)
        totalUsers.value = Math.max(0, totalUsers.value - 1)
        showToast('User deleted', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to delete user', 'error')
    } finally {
        deletingUserId.value = null
    }
}

const startUserEdit = (user: any) => {
    editingUser.value = {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName || ''
    }
}

const cancelUserEdit = () => {
    editingUser.value = null
}

const saveUserEdit = async (user: any) => {
    if (!editingUser.value) return
    
    const originalUser = { ...user }
    const userIndex = users.value.findIndex(u => u.id === user.id)
    
    try {
        await $fetch('/api/admin/update-user', {
            method: 'POST',
            body: {
                userId: editingUser.value.id,
                username: editingUser.value.username,
                email: editingUser.value.email,
                displayName: editingUser.value.displayName
            },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        
        // Update local state
        if (userIndex !== -1) {
            users.value[userIndex].username = editingUser.value.username
            users.value[userIndex].email = editingUser.value.email
            users.value[userIndex].displayName = editingUser.value.displayName
        }
        
        editingUser.value = null
    } catch (e: any) {
        const errorMsg = e?.data?.error || e?.message || 'Failed to update user'
        alert(errorMsg)
        // Restore original values on error
        if (userIndex !== -1) {
            users.value[userIndex] = originalUser
        }
    }
}

const promoteUser = async (user: any) => {
    const currentLevel = user.admin_level || 0
    const adminLevel = getCurrentAdminLevel()
    
    // Determine next level: promote to adminLevel (up to admin's own level)
    // But if user is level 0 and admin is Senior Admin, promote to level 1
    let newLevel: number
    if (currentLevel === 0) {
        // Only Senior Admins can do this, and they promote to Junior Admin (level 1)
        newLevel = 1
    } else {
        // Promote existing admin up to admin's own level
        newLevel = Math.min(currentLevel + 1, adminLevel)
    }
    
    if (!confirm(`Are you sure you want to promote ${user.username} to ${getRoleLabel(newLevel)}?`)) {
        return
    }
    
    const oldLevel = user.admin_level || 0
    
    // Update UI optimistically
    user.admin_level = newLevel
    
    try {
        await $fetch('/api/admin/promote', {
            method: 'POST',
            body: { userId: user.id, adminLevel: newLevel },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        // Update previous level for next change
        user._previousAdminLevel = newLevel
    } catch (e: any) {
        // Rollback on error
        user.admin_level = oldLevel
        const errorMsg = e?.data?.error || e?.message || 'Failed to promote user'
        alert(errorMsg)
    }
}

const demoteUser = async (user: any) => {
    const currentLevel = user.admin_level || 0
    const newLevel = Math.max(0, currentLevel - 1)
    
    if (!confirm(`Are you sure you want to demote ${user.username} to ${getRoleLabel(newLevel)}?`)) {
        return
    }
    
    const oldLevel = user.admin_level || 0
    
    // Update UI optimistically
    user.admin_level = newLevel
    
    try {
        await $fetch('/api/admin/promote', {
            method: 'POST',
            body: { userId: user.id, adminLevel: newLevel },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        // Update previous level for next change
        user._previousAdminLevel = newLevel
    } catch (e: any) {
        // Rollback on error
        user.admin_level = oldLevel
        const errorMsg = e?.data?.error || e?.message || 'Failed to demote user'
        alert(errorMsg)
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

const loadDesqtaClientsCount = async () => {
    try {
        const res = await $fetch<{ count: number }>('/api/admin/desqta-clients-count', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        desqtaClientsCount.value = res.count
    } catch (e) {
        console.error('Failed to load DesQTA clients count', e)
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

const deleteClient = async (client: any) => {
    if (!confirm(`Delete OAuth client "${client.name}"? This cannot be undone.`)) return
    deletingClientId.value = client.id
    try {
        await $fetch('/api/admin/clients/delete', {
            method: 'POST',
            body: { clientId: client.id },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        clients.value = clients.value.filter(c => c.id !== client.id)
        showToast('Client deleted', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to delete client', 'error')
    } finally {
        deletingClientId.value = null
    }
}

const loadApiKeys = async () => {
    try {
        const res = await $fetch<any[]>('/api/admin/api-keys', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        apiKeys.value = res
    } catch (e) {
        console.error('Failed to load API keys', e)
    }
}

const createApiKey = async () => {
    creatingApiKey.value = true
    lastCreatedApiKey.value = null
    try {
        const res = await $fetch<any>('/api/admin/api-keys', {
            method: 'POST',
            body: { name: newApiKeyName.value.trim() },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        lastCreatedApiKey.value = res
        apiKeys.value.unshift({ id: res.id, name: res.name, createdAt: res.createdAt })
        newApiKeyName.value = ''
        showToast('API key created. Copy it now – it won\'t be shown again.', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to create API key', 'error')
    } finally {
        creatingApiKey.value = false
    }
}

const copyApiKey = async (token: string) => {
    try {
        await navigator.clipboard.writeText(token)
        showToast('Copied to clipboard', 'success')
    } catch {
        showToast('Failed to copy', 'error')
    }
}

const formatDate = (ts: number) => {
    if (!ts) return '-'
    return new Date(ts * 1000).toLocaleDateString()
}

const deleteApiKey = async (key: any) => {
    if (!confirm(`Delete API key "${key.name}"? This will revoke access immediately.`)) return
    deletingApiKeyId.value = key.id
    try {
        await $fetch('/api/admin/api-keys', {
            method: 'DELETE',
            body: { id: key.id },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        apiKeys.value = apiKeys.value.filter(k => k.id !== key.id)
        showToast('API key deleted', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to delete API key', 'error')
    } finally {
        deletingApiKeyId.value = null
    }
}

const fixingPfpUrls = ref(false)
const urlFixResult = ref<{ total: number; fixed: number; failed: number; results: any[] } | null>(null)

const fixPfpUrls = async () => {
  if (!confirm('This will prepend https://accounts.betterseqta.org to all relative PFP URLs. Continue?')) return
  fixingPfpUrls.value = true
  urlFixResult.value = null
  try {
    const res = await $fetch<{ total: number; fixed: number; failed: number; results: any[] }>('/api/admin/fix-pfp-urls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    urlFixResult.value = res
  } catch (e: any) {
    showToast(e?.data?.error || 'Fix failed', 'error')
  } finally {
    fixingPfpUrls.value = false
  }
}

const migratePfps = async () => {
  if (!confirm('This will download all external profile pictures and upload them to Cloudflare R2. This may take a while. Continue?')) return
  migratingPfps.value = true
  migrationResult.value = null
  try {
    const res = await $fetch<{ total: number; migrated: number; failed: number; results: any[] }>('/api/admin/migrate-pfps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    migrationResult.value = res
  } catch (e: any) {
    showToast(e?.data?.error || 'Migration failed', 'error')
  } finally {
    migratingPfps.value = false
  }
}

onMounted(() => {
    if (auth.user.value && (auth.user.value?.admin_level || 0) > 0) {
        loadClients()
        loadDesqtaClientsCount()
        loadApiKeys()
        searchUsers(1) // Load initial users
    }
})
</script>

