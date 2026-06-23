<template>
  <div class="admin-page w-full min-w-0 flex flex-col gap-4 sm:gap-6 min-h-0">
    <div class="animate-slide-down shrink-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-display mb-2">Admin Dashboard</h1>
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

    <div v-else class="admin-panel admin-panel-mobile-scroll w-full min-w-0 flex flex-col min-h-0 backdrop-blur-lg bg-white/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-white/10 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 animate-fade-in md:overflow-hidden">
      
      <!-- Tabs -->
      <div class="admin-table-scroll -mx-4 px-4 sm:mx-0 sm:px-0 mb-2 shrink-0">
        <div class="flex gap-4 sm:gap-6 border-b border-zinc-200 dark:border-zinc-700 min-w-max sm:min-w-0">
        <button
            v-for="tab in adminTabs"
            :key="tab.id"
            @click="setActiveTab(tab.id)"
            :class="['pb-2 px-1 font-medium whitespace-nowrap transition-colors duration-200 border-b-2 shrink-0', activeTab === tab.id ? 'border-primary-500 text-primary-500' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300']"
        >
            {{ tab.label }}
        </button>
        </div>
      </div>
      <p v-if="activeTabDescription" class="text-sm text-zinc-500 dark:text-zinc-400 mb-4 shrink-0">{{ activeTabDescription }}</p>

      <div class="admin-panel-body admin-panel-body-mobile-scroll min-h-0 flex-1 flex flex-col md:overflow-hidden">
      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="admin-tab-panel flex flex-col gap-4 sm:gap-6 min-w-0 min-h-0">
        <div class="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center shrink-0">
            <input 
                v-model="searchQuery" 
                @keyup.enter="handleSearch" 
                type="text" 
                placeholder="Search by username or email..." 
                class="w-full sm:flex-1 min-w-0 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
            >
            <div class="flex flex-wrap items-center gap-3">
            <select
                v-model="sortOption"
                class="flex-1 sm:flex-none min-w-[10rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
            >
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <label class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer select-none shrink-0">
                <input type="checkbox" v-model="hasPfpFilter" class="rounded border-zinc-300 dark:border-zinc-700 text-primary-500 focus:ring-primary-500" />
                Has PFP
            </label>
            <button @click="handleSearch" :disabled="usersLoading" class="w-full sm:w-auto px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50">
              {{ usersLoading ? 'Searching…' : 'Search' }}
            </button>
            </div>
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Results update automatically as you type. Press Enter or Search to apply immediately.</p>

        <div v-if="searched" class="text-sm text-zinc-600 dark:text-zinc-400 shrink-0">
            Total users: <span class="font-semibold text-zinc-900 dark:text-white">{{ totalUsers }}</span>
            <span v-if="users.length > 0" class="text-zinc-500"> · showing {{ users.length }}</span>
        </div>

        <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden min-w-0 relative flex-1 min-h-0 flex flex-col">
            <div v-if="usersLoading && !users.length" class="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
            <div v-else class="admin-table-scroll flex-1 min-h-0">
            <div ref="usersScrollContainer" class="admin-table-viewport-scroll scroll-stable">
                <table class="admin-data-table w-full text-left">
                    <colgroup>
                        <col style="width: 32%" />
                        <col style="width: 28%" />
                        <col style="width: 18%" />
                        <col style="width: 22%" />
                    </colgroup>
                    <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800/95 backdrop-blur-sm z-10">
                        <tr class="border-b border-zinc-200 dark:border-zinc-700">
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">User</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Email</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Role</th>
                            <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <tr v-if="paddingTop > 0" aria-hidden="true"><td colspan="4" :style="{ height: `${paddingTop}px`, padding: 0, border: 'none' }" /></tr>
                        <tr v-for="virtualRow in virtualRows" :key="users[virtualRow.index].id" class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
                            <td class="py-4 px-4 min-w-0">
                                <div class="flex items-center gap-3 min-w-0">
                                    <PfpStack
                                        compact
                                        :user-id="users[virtualRow.index].id"
                                        :pfp-url="users[virtualRow.index].pfpUrl"
                                        :cache-version="users[virtualRow.index]._pfpVersion"
                                        :can-edit="canModerateUsers()"
                                        @edit="openPfpEditor(users[virtualRow.index])"
                                        @view="openPfpView"
                                    />
                                    <div v-if="editingUser?.id !== users[virtualRow.index].id" class="text-zinc-900 dark:text-white font-medium min-w-0 truncate">
                                        {{ users[virtualRow.index].displayName || users[virtualRow.index].username }}
                                        <span v-if="users[virtualRow.index].displayName && users[virtualRow.index].displayName !== users[virtualRow.index].username" class="text-xs text-zinc-500 dark:text-zinc-400 ml-1">({{ users[virtualRow.index].username }})</span>
                                    </div>
                                    <input
                                        v-else
                                        v-model="editingUser.username"
                                        type="text"
                                        class="flex-1 min-w-0 px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                    />
                                </div>
                            </td>
                            <td class="py-4 px-4 text-zinc-600 dark:text-zinc-400 min-w-0">
                                <span v-if="editingUser?.id !== users[virtualRow.index].id" class="block truncate">{{ users[virtualRow.index].email }}</span>
                                <input 
                                    v-else
                                    v-model="editingUser.email"
                                    type="email"
                                    class="w-full px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                />
                            </td>
                            <td class="py-4 px-4 min-w-0">
                                <span v-if="editingUser?.id !== users[virtualRow.index].id" :class="getRoleBadgeClass(users[virtualRow.index].admin_level || 0)">
                                    {{ getRoleLabel(users[virtualRow.index].admin_level || 0) }}
                                </span>
                                <div v-else class="flex items-center gap-2 min-w-0">
                                    <input 
                                        v-model="editingUser.displayName"
                                        type="text"
                                        placeholder="Display Name"
                                        class="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                                    />
                                    <span :class="getRoleBadgeClass(users[virtualRow.index].admin_level || 0)">
                                        {{ getRoleLabel(users[virtualRow.index].admin_level || 0) }}
                                    </span>
                                </div>
                            </td>
                            <td class="admin-table-actions py-4 px-4 text-right min-w-0">
                                <div class="flex items-center justify-end gap-2">
                                    <template v-if="editingUser?.id === users[virtualRow.index].id">
                                        <button 
                                            @click="saveUserEdit(users[virtualRow.index])"
                                            :disabled="savingUserEdit"
                                            class="text-sm px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 disabled:opacity-50"
                                        >
                                            {{ savingUserEdit ? 'Saving…' : 'Save' }}
                                        </button>
                                        <button 
                                            @click="cancelUserEdit()"
                                            class="text-sm px-3 py-1 bg-zinc-500 text-white rounded-lg hover:bg-zinc-600 transition-colors duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </template>
                                    <UserActionsMenu
                                        v-else-if="hasUserActions(users[virtualRow.index])"
                                        :user="users[virtualRow.index]"
                                        :can-edit="canModerateUsers()"
                                        :can-promote="canPromoteUser(users[virtualRow.index].admin_level || 0)"
                                        :can-demote="canDemoteUser(users[virtualRow.index].admin_level || 0)"
                                        :can-reset="getCurrentAdminLevel() > 0 && users[virtualRow.index].id !== auth.user.value?.id"
                                        :can-delete="canDeleteUser(users[virtualRow.index])"
                                        :resetting="sendingResetUserId === users[virtualRow.index].id"
                                        :deleting="deletingUserId === users[virtualRow.index].id"
                                        @edit="startUserEdit(users[virtualRow.index])"
                                        @promote="promoteUser(users[virtualRow.index])"
                                        @demote="demoteUser(users[virtualRow.index])"
                                        @reset="sendPasswordReset(users[virtualRow.index])"
                                        @delete="deleteUser(users[virtualRow.index])"
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr v-if="paddingBottom > 0" aria-hidden="true"><td colspan="4" :style="{ height: `${paddingBottom}px`, padding: 0, border: 'none' }" /></tr>
                    </tbody>
                </table>
                <div v-if="users.length === 0 && searched" class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                    No users found.
                </div>
                <div ref="scrollSentinel" class="flex justify-center py-4 gap-3">
                    <LoadingSpinner v-if="loadingMore" size="md" />
                    <span v-else-if="loadMoreError" class="text-xs text-red-500">
                        Failed to load users.
                        <button class="underline ml-1" @click="retryLoadMore">Retry</button>
                    </span>
                    <span v-else-if="searched && currentPage < totalPages" class="text-xs text-zinc-400">
                        Showing {{ users.length }} of {{ totalUsers }} users — scroll for more
                    </span>
                    <span v-else-if="searched && users.length > 0" class="text-xs text-zinc-500">All {{ totalUsers }} users loaded</span>
                </div>
            </div>
            </div>
        </div>
      </div>

      <!-- OAuth Clients Tab -->
      <div v-if="activeTab === 'clients'" class="admin-scroll-tab space-y-8">
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
      <div v-if="activeTab === 'apikeys'" class="admin-scroll-tab space-y-8">
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
            <form @submit.prevent="createApiKey" class="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div class="flex-1 min-w-0">
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
      <!-- Activity Log Tab -->
      <div v-if="activeTab === 'activity-log'" class="admin-tab-panel flex flex-col gap-4 sm:gap-6 min-w-0 min-h-0">
        <div class="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center shrink-0">
          <input
            v-model="auditSearchQuery"
            type="text"
            placeholder="Search actor, target, details..."
            class="w-full sm:flex-1 min-w-0 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
          />
          <div class="flex flex-wrap items-center gap-3">
          <select
            v-model="auditActionFilter"
            class="flex-1 sm:flex-none min-w-[10rem] px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
          >
            <option value="">All actions</option>
            <option v-for="opt in auditActionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button @click="refreshAuditLog" :disabled="auditRefreshing" class="w-full sm:w-auto px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50">
            {{ auditRefreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          <span v-if="activeTab === 'activity-log'" class="inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live · checks every 8s
          </span>
          <span v-if="auditLastUpdated">Last updated {{ auditLastUpdatedLabel }}</span>
          <span v-if="auditTotal">{{ auditTotal }} entries</span>
        </div>

        <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden min-w-0 flex-1 min-h-0 flex flex-col">
          <div class="admin-table-scroll flex-1 min-h-0">
          <div ref="auditScrollContainer" class="admin-table-viewport-scroll scroll-stable">
            <table class="admin-data-table admin-audit-table w-full text-left">
              <colgroup>
                <col style="width: 15%" />
                <col style="width: 11%" />
                <col style="width: 12%" />
                <col style="width: 14%" />
                <col style="width: 42%" />
                <col style="width: 6%" />
              </colgroup>
              <thead class="sticky top-0 bg-zinc-50 dark:bg-zinc-800/95 backdrop-blur-sm z-10">
                <tr class="border-b border-zinc-200 dark:border-zinc-700">
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Time</th>
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Admin</th>
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Action</th>
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Target</th>
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Context</th>
                  <th class="pb-3 pt-3 px-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody v-show="!auditLoadingInitial" class="divide-y divide-zinc-200 dark:divide-zinc-700">
                <tr v-for="entry in auditEntries" :key="entry.id" class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td class="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap truncate">{{ formatAuditTime(entry.createdAt) }}</td>
                  <td class="py-3 px-4 text-sm text-zinc-900 dark:text-white truncate">{{ entry.actorUsername || entry.actorId }}</td>
                  <td class="py-3 px-4 text-sm truncate">{{ auditActionLabel(entry.action) }}</td>
                  <td class="py-3 px-4 min-w-0">
                    <div v-if="entry.target" class="min-w-0 overflow-hidden">
                      <span class="text-[10px] uppercase tracking-wide text-zinc-400">{{ auditTargetTypeLabel(entry.target.type) }}</span>
                      <div class="text-sm text-zinc-900 dark:text-white truncate" :title="entry.target.label">{{ entry.target.label }}</div>
                      <div v-if="entry.target.sublabel" class="text-xs text-zinc-500 truncate" :title="entry.target.sublabel">{{ entry.target.sublabel }}</div>
                    </div>
                    <span v-else-if="entry.targetId" class="text-xs font-mono text-zinc-500 truncate block" :title="entry.targetId">{{ entry.targetId }}</span>
                    <span v-else class="text-xs text-zinc-400">—</span>
                  </td>
                  <td class="py-3 px-4 min-w-0 overflow-hidden">
                    <AuditContextCell :entry="entry" :max-admin-level="maxAdminLevel" :cache-version="pfpCacheVersion" @view="openPfpView" />
                  </td>
                  <td class="py-3 px-4 whitespace-nowrap">
                    <span :class="entry.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'" class="text-xs font-medium">
                      {{ entry.success ? 'OK' : 'Failed' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="auditLoadingInitial" class="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
            <div v-else-if="auditEntries.length === 0 && auditLoaded" class="text-center py-8 text-zinc-500">No activity logged yet.</div>
            <div v-else class="flex flex-col items-center justify-center py-4 gap-3">
              <LoadingSpinner v-if="auditLoadingMore" size="md" />
              <span v-else-if="auditLoadError" class="text-xs text-red-500">
                Failed to load.
                <button class="underline ml-1" @click="retryAuditLoad">Retry</button>
              </span>
              <template v-else>
                <span v-if="auditPage < auditTotalPages" class="text-xs text-zinc-400">
                  Showing {{ auditEntries.length }} of {{ auditTotal }} — newest first
                </span>
                <button
                  v-if="auditShowLoadMoreButton"
                  type="button"
                  class="text-xs font-medium text-primary-500 hover:text-primary-600 underline"
                  @click="loadMoreAudit"
                >
                  Load older entries
                </button>
                <span v-else-if="auditEntries.length > 0" class="text-xs text-zinc-500">All entries loaded</span>
              </template>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- PFP Migration Tab -->
      <div v-if="isTab('pfp-migration')" class="admin-scroll-tab space-y-6">
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

        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Process Profile Pictures (resize + hash)</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Normalizes current R2 profile pictures (center crop, downscale to max 256px, JPEG) and writes <code class="text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">pfp_hash</code> for client caching. Skips users already processed. Runs in batches to limit load.
          </p>
          <button
            @click="processAllPfps"
            :disabled="processingPfps"
            class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <LoadingSpinner v-if="processingPfps" size="sm" />
            <template v-else>
              <ArrowPathIcon class="w-5 h-5" />
            </template>
            {{ processingPfps ? 'Processing...' : 'Process all PFPs' }}
          </button>
          <div v-if="processPfpResult" class="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Last batch: {{ processPfpResult.processed }} processed, {{ processPfpResult.skipped }} skipped, {{ processPfpResult.failed }} failed.
          </div>
        </div>

        <div class="bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Prune PFP History</h3>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Trims all users down to 3 saved past profile pictures (plus current). Removes excess history rows and R2 objects.
          </p>
          <button
            @click="prunePfpHistory"
            :disabled="pruningPfpHistory"
            class="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center gap-2"
          >
            <LoadingSpinner v-if="pruningPfpHistory" size="sm" />
            <template v-else>
              <ArrowPathIcon class="w-5 h-5" />
            </template>
            {{ pruningPfpHistory ? 'Pruning...' : 'Prune History' }}
          </button>
          <div v-if="pruneResult" class="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Processed {{ pruneResult.usersProcessed }} users, deleted {{ pruneResult.rowsDeleted }} excess history rows.
          </div>
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
  </div>

  <!-- Fullscreen PFP viewer -->
  <div
    v-if="pfpViewerSrc"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
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

  <PfpEditorModal
    :is-open="pfpEditorOpen"
    :user="pfpEditorUser"
    mode="admin"
    :cache-version="pfpCacheVersion"
    @close="closePfpEditor"
    @view="openPfpView"
    @updated="onPfpUpdated"
  />

  <ConfirmDialog
    :open="confirmOpen"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-label="confirmLabel"
    :destructive="confirmDestructive"
    @cancel="closeConfirm"
    @confirm="runConfirm"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useTabPageUrl, ADMIN_TAB_PAGE } from '~/composables/useTabPageUrl'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'
import { ShieldExclamationIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'
import PfpStack from '~/components/PfpStack.vue'
import PfpEditorModal from '~/components/PfpEditorModal.vue'
import AuditContextCell from '~/components/admin/AuditContextCell.vue'
import ConfirmDialog from '~/components/admin/ConfirmDialog.vue'
import UserActionsMenu from '~/components/admin/UserActionsMenu.vue'
import { useInfiniteScroll, watchDebounced } from '@vueuse/core'
import { withPfpCacheBust, formatRelativeTime } from '~/utils/pfp'

const SCROLL_BUFFER = 400
const CHAIN_CAP = 1

const auth = useAuth()
const { showToast } = useToast()
const { activeTab, setActiveTab } = useTabPageUrl(ADMIN_TAB_PAGE)

const adminTabs = [
  { id: 'users', label: 'Users', description: 'Search, edit, and manage user accounts and profile pictures.' },
  { id: 'clients', label: 'OAuth Clients', description: 'Create and manage OAuth applications.' },
  { id: 'apikeys', label: 'API Keys', description: 'Issue and revoke API keys for integrations.' },
  { id: 'activity-log', label: 'Activity Log', description: 'Review admin actions with live updates every 8 seconds.' },
  { id: 'pfp-migration', label: 'PFP Migration', description: 'Senior admin tools for bulk profile picture maintenance.' },
]

const activeTabDescription = computed(() => adminTabs.find(t => t.id === activeTab.value)?.description ?? '')

// Confirm dialog
const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('Confirm')
const confirmDestructive = ref(false)
let confirmHandler: (() => void) | null = null

const openConfirm = (opts: {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) => {
  confirmTitle.value = opts.title
  confirmMessage.value = opts.message
  confirmLabel.value = opts.confirmLabel ?? 'Confirm'
  confirmDestructive.value = !!opts.destructive
  confirmHandler = opts.onConfirm
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmHandler = null
}

const runConfirm = () => {
  confirmHandler?.()
  closeConfirm()
}

// Users State
const searchQuery = ref('')
const users = ref<any[]>([])
const searched = ref(false)
const usersLoading = ref(false)
const savingUserEdit = ref(false)
const totalUsers = ref(0)
const currentPage = ref(1)
const totalPages = ref(1)
const maxAdminLevel = ref(3)
const editingUser = ref<any>(null)
const sendingResetUserId = ref<string | null>(null)
const deletingUserId = ref<string | null>(null)
const loadingMore = ref(false)
const loadMoreError = ref(false)
const usersScrollContainer = ref<HTMLElement | null>(null)
const scrollSentinel = ref<HTMLElement | null>(null)
const pfpCacheVersion = ref<number | string>(Date.now())
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
const pfpViewerSrc = ref<string | null>(null)
const pfpEditorOpen = ref(false)
const pfpEditorUser = ref<any>(null)

const openPfpView = (src: string) => {
  pfpViewerSrc.value = withPfpCacheBust(src, pfpCacheVersion.value)
}

const openPfpEditor = async (user: any) => {
  pfpEditorUser.value = { ...user, pfpHistory: user.pfpHistory ?? [] }
  pfpEditorOpen.value = true
  if (user.pfpHistory?.length) return
  try {
    const res = await $fetch<{ pfpUrl: string | null; pfpHash: string | null; pfpHistory: any[] }>('/api/admin/user/pfp', {
      params: { userId: user.id },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    if (pfpEditorUser.value?.id !== user.id) return
    pfpEditorUser.value = { ...pfpEditorUser.value, pfpUrl: res.pfpUrl, pfpHistory: res.pfpHistory }
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1) {
      users.value[idx].pfpHistory = res.pfpHistory
    }
  } catch (e) {
    console.error('Failed to load PFP history', e)
  }
}

const closePfpEditor = () => {
  pfpEditorOpen.value = false
  pfpEditorUser.value = null
}

const onPfpUpdated = (payload: { pfpUrl: string | null; pfpHash: string | null; pfpHistory: any[] }) => {
  if (!pfpEditorUser.value) return
  const idx = users.value.findIndex(u => u.id === pfpEditorUser.value.id)
  if (idx !== -1) {
    users.value[idx].pfpUrl = payload.pfpUrl
    users.value[idx].pfpHistory = payload.pfpHistory
    users.value[idx]._pfpVersion = payload.pfpHash ?? Date.now()
  }
  pfpEditorUser.value.pfpUrl = payload.pfpUrl
  pfpEditorUser.value.pfpHistory = payload.pfpHistory
  pfpCacheVersion.value = payload.pfpHash ?? Date.now()
}

const rowVirtualizer = useVirtualizer(computed(() => ({
  count: users.value.length,
  getScrollElement: () => usersScrollContainer.value,
  estimateSize: () => 72,
  overscan: 4,
})))

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const paddingTop = computed(() => virtualRows.value[0]?.start ?? 0)
const paddingBottom = computed(() => {
  const items = virtualRows.value
  if (!items.length) return 0
  return rowVirtualizer.value.getTotalSize() - items[items.length - 1].end
})

// Audit log state
const auditEntries = ref<any[]>([])
const auditPage = ref(1)
const auditTotalPages = ref(1)
const auditTotal = ref(0)
const auditNextCursor = ref<string | null>(null)
const auditLoaded = ref(false)
const auditLoadingInitial = ref(false)
const auditLoadingMore = ref(false)
const auditRefreshing = ref(false)
const auditLoadError = ref(false)
const auditScrollContainer = ref<HTMLElement | null>(null)
const auditSearchQuery = ref('')
const auditActionFilter = ref('')
const auditLastUpdated = ref<number | null>(null)
const AUDIT_POLL_MS = 8_000
let auditPollTimer: ReturnType<typeof setInterval> | null = null

const auditActionOptions = [
  { value: 'user.promote', label: 'Promote user' },
  { value: 'user.demote', label: 'Demote user' },
  { value: 'user.update', label: 'Update user' },
  { value: 'user.delete', label: 'Delete user' },
  { value: 'user.password_reset', label: 'Password reset' },
  { value: 'pfp.upload', label: 'PFP upload' },
  { value: 'pfp.restore', label: 'PFP restore' },
  { value: 'pfp.clear', label: 'PFP clear' },
  { value: 'client.create', label: 'Create client' },
  { value: 'client.delete', label: 'Delete client' },
  { value: 'api_key.create', label: 'Create API key' },
  { value: 'api_key.delete', label: 'Delete API key' },
  { value: 'pfp.migrate', label: 'PFP migrate' },
  { value: 'pfp.fix_urls', label: 'PFP fix URLs' },
  { value: 'pfp.prune_history', label: 'PFP prune history' },
]

const auditActionLabel = (action: string) =>
  auditActionOptions.find(o => o.value === action)?.label ?? action

const auditTargetTypeLabel = (type: string | null | undefined) => {
  if (!type) return 'Target'
  if (type === 'api_key') return 'API key'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const formatAuditTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString()

const auditLastUpdatedLabel = computed(() => {
  if (!auditLastUpdated.value) return ''
  return formatRelativeTime(Math.floor(auditLastUpdated.value / 1000))
})

const touchAuditUpdated = () => { auditLastUpdated.value = Date.now() }

const auditListOverflows = () => {
  const el = auditScrollContainer.value
  if (!el) return false
  return el.scrollHeight > el.clientHeight + 1
}

const auditShowLoadMoreButton = computed(() =>
  auditLoaded.value &&
  !auditLoadingMore.value &&
  !auditLoadingInitial.value &&
  (auditNextCursor.value != null || auditPage.value < auditTotalPages.value) &&
  !auditListOverflows(),
)

const auditCanLoadMore = () =>
  !auditLoadingMore.value &&
  !auditLoadingInitial.value &&
  auditLoaded.value &&
  (auditNextCursor.value != null || auditPage.value < auditTotalPages.value) &&
  auditListOverflows()

const auditFetchParams = (extra: Record<string, string | number | undefined> = {}, opts: { light?: boolean } = {}) => ({
  limit: 25,
  ...(opts.light ? { light: 'true' } : {}),
  q: auditSearchQuery.value || undefined,
  action: auditActionFilter.value || undefined,
  ...extra,
})

const loadAuditLog = async (opts: { append?: boolean; cursor?: string | null } = {}) => {
  const { append = false, cursor = null } = opts
  auditLoadError.value = false
  if (!append) auditLoadingInitial.value = true
  try {
    const res = await $fetch<{
      entries: any[]
      total?: number
      page?: number
      totalPages?: number
      nextCursor?: string | null
      hasMore?: boolean
    }>('/api/admin/audit-log', {
      params: auditFetchParams({
        page: cursor ? undefined : (append ? auditPage.value : 1),
        cursor: cursor ?? undefined,
      }),
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    auditEntries.value = append ? [...auditEntries.value, ...res.entries] : res.entries
    auditNextCursor.value = res.nextCursor ?? null
    if (res.page != null) auditPage.value = res.page
    if (res.totalPages != null) auditTotalPages.value = res.totalPages
    if (res.total != null) auditTotal.value = res.total
    auditLoaded.value = true
    touchAuditUpdated()
  } catch (e) {
    console.error('Failed to load audit log', e)
    auditLoadError.value = true
  } finally {
    if (!append) auditLoadingInitial.value = false
  }
}

/** Poll: lightweight fetch for new rows only (skips expensive PFP thumbnail resolution). */
const pollAuditLog = async () => {
  if (!auditLoaded.value || auditLoadingMore.value || auditLoadingInitial.value) return
  const newest = auditEntries.value[0]?.createdAt
  if (!newest) return
  try {
    const res = await $fetch<{ entries: any[] }>('/api/admin/audit-log', {
      params: auditFetchParams({ since: newest, limit: 20 }, { light: true }),
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    if (!res.entries?.length) {
      touchAuditUpdated()
      return
    }
    const existingIds = new Set(auditEntries.value.map(e => e.id))
    const brandNew = res.entries.filter(e => !existingIds.has(e.id))
    if (brandNew.length) {
      auditEntries.value = [...brandNew, ...auditEntries.value]
      if (auditTotal.value) auditTotal.value += brandNew.length
    }
    touchAuditUpdated()
  } catch (e) {
    console.error('Failed to poll audit log', e)
  }
}

const refreshAuditLog = async () => {
  if (!auditLoaded.value || auditLoadingMore.value || auditRefreshing.value) return
  auditRefreshing.value = true
  try {
    await loadAuditLog({ append: false })
    auditLoadError.value = false
  } catch (e) {
    console.error('Failed to refresh audit log', e)
  } finally {
    auditRefreshing.value = false
  }
}

const stopAuditAutoRefresh = () => {
  if (auditPollTimer !== null) {
    clearInterval(auditPollTimer)
    auditPollTimer = null
  }
}

const startAuditAutoRefresh = () => {
  stopAuditAutoRefresh()
  auditPollTimer = setInterval(() => {
    if (activeTab.value === 'activity-log') pollAuditLog()
  }, AUDIT_POLL_MS)
}

const onActivityLogTabActivated = async () => {
  auditEntries.value = []
  auditLoaded.value = false
  auditPage.value = 1
  auditNextCursor.value = null
  await loadAuditLog({ append: false })
  startAuditAutoRefresh()
  void pollAuditLog()
}

const onActivityLogTabDeactivated = () => {
  stopAuditAutoRefresh()
}

const loadMoreAudit = async () => {
  if (auditLoadingMore.value || !auditLoaded.value) return
  if (!auditNextCursor.value && auditPage.value >= auditTotalPages.value) return
  auditLoadingMore.value = true
  try {
    if (auditNextCursor.value) {
      await loadAuditLog({ append: true, cursor: auditNextCursor.value })
    } else {
      auditPage.value += 1
      await loadAuditLog({ append: true })
    }
  } finally {
    auditLoadingMore.value = false
  }
}

const retryAuditLoad = () => loadAuditLog({ append: auditEntries.value.length > 0, cursor: auditNextCursor.value })

useInfiniteScroll(auditScrollContainer, () => {
  if (activeTab.value === 'activity-log') loadMoreAudit()
}, { distance: SCROLL_BUFFER, canLoadMore: auditCanLoadMore })

watch(activeTab, (tab, prevTab) => {
  if (import.meta.client) {
    history.replaceState(null, '', `#${tab}`)
  }
  if (prevTab === 'activity-log') onActivityLogTabDeactivated()
  if (tab === 'activity-log') onActivityLogTabActivated()
})

onUnmounted(() => stopAuditAutoRefresh())

watchDebounced([auditSearchQuery, auditActionFilter], () => {
  if (activeTab.value === 'activity-log') loadAuditLog({ append: false })
}, { debounce: 300 })

const processingPfps = ref(false)
const processPfpResult = ref<{ processed: number; skipped: number; failed: number } | null>(null)

const processAllPfps = async () => {
  openConfirm({
    title: 'Process all profile pictures',
    message: 'Normalize and hash all current R2 profile pictures? This may take several batches.',
    confirmLabel: 'Process',
    onConfirm: async () => {
      processingPfps.value = true
      let offset = 0
      let totalProcessed = 0
      let totalSkipped = 0
      let totalFailed = 0
      try {
        for (;;) {
          const res = await $fetch<{ processed: number; skipped: number; failed: number; nextOffset: number | null }>(
            '/api/admin/process-pfps',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: { offset, limit: 20 },
            },
          )
          totalProcessed += res.processed
          totalSkipped += res.skipped
          totalFailed += res.failed
          processPfpResult.value = { processed: totalProcessed, skipped: totalSkipped, failed: totalFailed }
          if (res.nextOffset == null) break
          offset = res.nextOffset
        }
        showToast('Profile picture processing finished', 'success')
      } catch (e: any) {
        showToast(e?.data?.error || 'Processing failed', 'error')
      } finally {
        processingPfps.value = false
      }
    },
  })
}

const pruningPfpHistory = ref(false)
const pruneResult = ref<{ usersProcessed: number; rowsDeleted: number } | null>(null)

const prunePfpHistory = async () => {
  openConfirm({
    title: 'Prune PFP history',
    message: 'Trim all users to 3 saved past profile pictures (plus current)? Excess history and storage will be deleted.',
    confirmLabel: 'Prune',
    destructive: true,
    onConfirm: async () => {
      pruningPfpHistory.value = true
      pruneResult.value = null
      try {
        const res = await $fetch<{ usersProcessed: number; rowsDeleted: number }>('/api/admin/prune-pfp-history', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        pruneResult.value = res
        showToast('PFP history pruned', 'success')
      } catch (e: any) {
        showToast(e?.data?.error || 'Prune failed', 'error')
      } finally {
        pruningPfpHistory.value = false
      }
    },
  })
}
const migratingPfps = ref(false)
const migrationResult = ref<{ total: number; migrated: number; failed: number; results: any[] } | null>(null)
const failedResults = computed(() => migrationResult.value?.results?.filter(r => !r.success) || [])
const isTab = (tab: string) => activeTab.value === tab

// PFP Migration State
// Actions
const getScrollRemaining = () => {
  const el = usersScrollContainer.value
  if (!el) return Infinity
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

const searchUsers = async (page: number = 1, append: boolean = false) => {
    loadMoreError.value = false
    if (!append) usersLoading.value = true
    try {
        const res = await $fetch<{ users: any[], total: number, page: number, pageSize: number, totalPages: number, maxAdminLevel: number }>('/api/admin/users', {
            params: { q: searchQuery.value, page, sort: sortOption.value, has_pfp: hasPfpFilter.value || undefined, include_history: 'false' },
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
        loadMoreError.value = true
    } finally {
        if (!append) usersLoading.value = false
    }
}

const ensureScrollBuffer = async () => {
  await nextTick()
  let chained = 0
  while (
    searched.value &&
    currentPage.value < totalPages.value &&
    getScrollRemaining() < SCROLL_BUFFER &&
    chained < CHAIN_CAP &&
    !loadingMore.value
  ) {
    await loadMore()
    await nextTick()
    chained++
  }
}

const handleSearch = async () => {
    await searchUsers(1, false)
    await nextTick()
    usersScrollContainer.value?.scrollTo(0, 0)
    await ensureScrollBuffer()
}

const loadMore = async () => {
    if (loadingMore.value || currentPage.value >= totalPages.value || !searched.value) return
    loadingMore.value = true
    try {
        await searchUsers(currentPage.value + 1, true)
        await nextTick()
        await ensureScrollBuffer()
    } finally {
        loadingMore.value = false
    }
}

const retryLoadMore = () => {
  if (loadMoreError.value && currentPage.value < totalPages.value) {
    loadMore()
  } else {
    handleSearch()
  }
}

watchDebounced([searchQuery, sortOption, hasPfpFilter], () => {
    if (searched.value) handleSearch()
}, { debounce: 300 })

useInfiniteScroll(
  usersScrollContainer,
  () => {
    if (searched.value) loadMore()
  },
  {
    distance: SCROLL_BUFFER,
    canLoadMore: () => !loadingMore.value && currentPage.value < totalPages.value && searched.value,
  },
)

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

const hasUserActions = (user: any) =>
    canModerateUsers()
    || canPromoteUser(user.admin_level || 0)
    || canDemoteUser(user.admin_level || 0)
    || (getCurrentAdminLevel() > 0 && user.id !== auth.user.value?.id)
    || canDeleteUser(user)

const sendPasswordReset = (user: any) => {
    openConfirm({
        title: 'Send password reset',
        message: `Send a password reset email to ${user.displayName || user.username} (${user.email})?`,
        confirmLabel: 'Send email',
        onConfirm: async () => {
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
        },
    })
}

const deleteUser = (user: any) => {
    openConfirm({
        title: 'Delete user',
        message: `Permanently delete ${user.displayName || user.username} (${user.email})? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
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
        },
    })
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

    const unchanged =
        editingUser.value.username === user.username &&
        editingUser.value.email === user.email &&
        (editingUser.value.displayName ?? '') === (user.displayName ?? '')

    if (unchanged) {
        editingUser.value = null
        return
    }
    
    const originalUser = { ...user }
    const userIndex = users.value.findIndex(u => u.id === user.id)
    
    savingUserEdit.value = true
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
        
        if (userIndex !== -1) {
            users.value[userIndex].username = editingUser.value.username
            users.value[userIndex].email = editingUser.value.email
            users.value[userIndex].displayName = editingUser.value.displayName
        }
        
        editingUser.value = null
        showToast('User updated', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || e?.message || 'Failed to update user', 'error')
        if (userIndex !== -1) {
            users.value[userIndex] = originalUser
        }
    } finally {
        savingUserEdit.value = false
    }
}

const promoteUser = (user: any) => {
    const currentLevel = user.admin_level || 0
    const adminLevel = getCurrentAdminLevel()
    
    let newLevel: number
    if (currentLevel === 0) {
        newLevel = 1
    } else {
        newLevel = Math.min(currentLevel + 1, adminLevel)
    }
    
    openConfirm({
        title: 'Promote user',
        message: `Promote ${user.username} to ${getRoleLabel(newLevel)}?`,
        confirmLabel: 'Promote',
        onConfirm: async () => {
            const oldLevel = user.admin_level || 0
            user.admin_level = newLevel
            try {
                await $fetch('/api/admin/promote', {
                    method: 'POST',
                    body: { userId: user.id, adminLevel: newLevel },
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
                user._previousAdminLevel = newLevel
                showToast(`${user.username} promoted`, 'success')
            } catch (e: any) {
                user.admin_level = oldLevel
                showToast(e?.data?.error || e?.message || 'Failed to promote user', 'error')
            }
        },
    })
}

const demoteUser = (user: any) => {
    const currentLevel = user.admin_level || 0
    const newLevel = Math.max(0, currentLevel - 1)
    
    openConfirm({
        title: 'Demote user',
        message: `Demote ${user.username} to ${getRoleLabel(newLevel)}?`,
        confirmLabel: 'Demote',
        destructive: true,
        onConfirm: async () => {
            const oldLevel = user.admin_level || 0
            user.admin_level = newLevel
            try {
                await $fetch('/api/admin/promote', {
                    method: 'POST',
                    body: { userId: user.id, adminLevel: newLevel },
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
                user._previousAdminLevel = newLevel
                showToast(`${user.username} demoted`, 'success')
            } catch (e: any) {
                user.admin_level = oldLevel
                showToast(e?.data?.error || e?.message || 'Failed to demote user', 'error')
            }
        },
    })
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
        showToast('Client created', 'success')
    } catch (e: any) {
        showToast(e?.data?.error || 'Failed to create client', 'error')
    } finally {
        creatingClient.value = false
    }
}

const deleteClient = (client: any) => {
    openConfirm({
        title: 'Delete OAuth client',
        message: `Delete "${client.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
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
        },
    })
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

const deleteApiKey = (key: any) => {
    openConfirm({
        title: 'Delete API key',
        message: `Delete "${key.name}"? This will revoke access immediately.`,
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
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
        },
    })
}

const fixingPfpUrls = ref(false)
const urlFixResult = ref<{ total: number; fixed: number; failed: number; results: any[] } | null>(null)

const fixPfpUrls = () => {
  openConfirm({
    title: 'Fix PFP URLs',
    message: 'Prepend https://accounts.betterseqta.org to all relative profile picture URLs stored in the database?',
    confirmLabel: 'Fix URLs',
    onConfirm: async () => {
      fixingPfpUrls.value = true
      urlFixResult.value = null
      try {
        const res = await $fetch<{ total: number; fixed: number; failed: number; results: any[] }>('/api/admin/fix-pfp-urls', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        urlFixResult.value = res
        showToast('PFP URLs updated', 'success')
      } catch (e: any) {
        showToast(e?.data?.error || 'Fix failed', 'error')
      } finally {
        fixingPfpUrls.value = false
      }
    },
  })
}

const migratePfps = () => {
  openConfirm({
    title: 'Migrate profile pictures',
    message: 'Download all external profile pictures and upload them to Cloudflare R2? This may take a while.',
    confirmLabel: 'Start migration',
    onConfirm: async () => {
      migratingPfps.value = true
      migrationResult.value = null
      try {
        const res = await $fetch<{ total: number; migrated: number; failed: number; results: any[] }>('/api/admin/migrate-pfps', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        migrationResult.value = res
        showToast('Migration complete', 'success')
      } catch (e: any) {
        showToast(e?.data?.error || 'Migration failed', 'error')
      } finally {
        migratingPfps.value = false
      }
    },
  })
}

onMounted(async () => {
    if (auth.user.value && (auth.user.value?.admin_level || 0) > 0) {
        loadClients()
        loadDesqtaClientsCount()
        loadApiKeys()
        if (activeTab.value === 'activity-log') {
            await onActivityLogTabActivated()
        } else {
            await searchUsers(1)
            await ensureScrollBuffer()
        }
    }
})
</script>

