import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type TabPageConfig = {
  defaultTab: string
  tabs: readonly string[]
  tabToP: Record<string, string>
  pToTab: Record<string, string>
}

export function createTabPageConfig(options: {
  defaultTab: string
  tabs: readonly string[]
  tabToP: Record<string, string>
}): TabPageConfig {
  const pToTab: Record<string, string> = {}
  for (const [tab, p] of Object.entries(options.tabToP)) {
    pToTab[p] = tab
  }
  for (const tab of options.tabs) {
    pToTab[tab] = tab
  }
  return { ...options, pToTab }
}

export const SETTINGS_TAB_PAGE = createTabPageConfig({
  defaultTab: 'profile',
  tabs: ['profile', 'account', 'bsplus-settings', 'bs-settings'],
  tabToP: {
    profile: 'profile',
    account: 'account',
    'bsplus-settings': 'bqsettings',
    'bs-settings': 'dqsettings',
  },
})

export const ADMIN_TAB_PAGE = createTabPageConfig({
  defaultTab: 'users',
  tabs: ['users', 'clients', 'apikeys', 'activity-log', 'pfp-migration'],
  tabToP: {
    users: 'users',
    clients: 'clients',
    apikeys: 'apikeys',
    'activity-log': 'activity',
    'pfp-migration': 'pfp',
  },
})

/** Optional ?p=home on dashboard — cosmetic bookmark only. */
export const HOME_PAGE_PARAM = 'home'

export function useTabPageUrl(config: TabPageConfig) {
  const route = useRoute()
  const router = useRouter()
  const activeTab = ref(config.defaultTab)

  function resolveTabFromUrl(): string {
    const p = route.query.p
    if (typeof p === 'string' && config.pToTab[p]) {
      return config.pToTab[p]
    }
    if (import.meta.client && window.location.hash) {
      const hash = window.location.hash.slice(1)
      if (config.pToTab[hash]) return config.pToTab[hash]
      if (config.tabs.includes(hash)) return hash
    }
    return config.defaultTab
  }

  function syncUrlToTab(tab: string) {
    if (!import.meta.client) return
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (key === 'p') continue
      if (typeof value === 'string') query[key] = value
    }
    const pValue = config.tabToP[tab]
    if (pValue && tab !== config.defaultTab) {
      query.p = pValue
    }
    router.replace({ path: route.path, query, hash: '' }).catch(() => {})
  }

  function setActiveTab(tab: string) {
    if (!config.tabs.includes(tab)) return
    activeTab.value = tab
    syncUrlToTab(tab)
  }

  function initFromUrl() {
    activeTab.value = resolveTabFromUrl()
    if (import.meta.client && (window.location.hash || route.query.p)) {
      syncUrlToTab(activeTab.value)
    }
  }

  watch(
    () => route.query.p,
    () => {
      const tab = resolveTabFromUrl()
      if (tab !== activeTab.value) activeTab.value = tab
    },
  )

  onMounted(initFromUrl)

  return { activeTab, setActiveTab, initFromUrl }
}

/** Set optional ?p=home on dashboard without requiring it to load. */
export function useHomePageUrl() {
  const route = useRoute()
  const router = useRouter()

  function markHomeInUrl() {
    if (!import.meta.client) return
    if (route.query.p === HOME_PAGE_PARAM) return
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (typeof value === 'string') query[key] = value
    }
    query.p = HOME_PAGE_PARAM
    router.replace({ path: route.path, query }).catch(() => {})
  }

  onMounted(() => {
    const p = route.query.p
    if (p != null && p !== HOME_PAGE_PARAM) {
      const query: Record<string, string> = {}
      for (const [key, value] of Object.entries(route.query)) {
        if (key === 'p') continue
        if (typeof value === 'string') query[key] = value
      }
      router.replace({ path: route.path, query }).catch(() => {})
    }
  })

  return { markHomeInUrl }
}

export function settingsTabUrl(p: string) {
  return `/settings?p=${encodeURIComponent(p)}`
}

export function adminTabUrl(p: string) {
  return `/admin?p=${encodeURIComponent(p)}`
}
