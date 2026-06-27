/** Matches extension `CLOUD_SETTINGS_SYNC_SCHEMA_VERSION` / server contract */
export const CLOUD_SETTINGS_SYNC_SCHEMA_VERSION = 1

/** Trim theme id for BS+ sync envelope; empty string when unset or invalid. */
export function normalizeThemeIdForSync(selectedTheme: unknown): string {
  if (typeof selectedTheme !== 'string') return ''
  const trimmed = selectedTheme.trim()
  return trimmed
}

export type CloudSummaryResponse = {
  desqta: { updated_at: string | null; revision: number } | null
  bsplus: { updated_at: string; schemaVersion: number } | null
}

export type BsPlusSyncGetResult = {
  data: Record<string, unknown>
  updated_at?: string
  schemaVersion?: number
}

const authFetchInit: RequestInit = { credentials: 'include' }

export const useSettings = () => {
  const syncSettings = async (mySettings: any) => {
    const response = await fetch('/api/settings', {
      ...authFetchInit,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mySettings),
    })

    if (!response.ok) {
      throw new Error('Failed to save settings')
    }

    const savedData = await response.json()
    if (savedData && typeof savedData === 'object' && savedData.ok === true && savedData.server) {
      const { ok: _ok, server: _server, ...settingsOnly } = savedData
      console.log('Settings saved:', settingsOnly, 'server:', _server)
      return settingsOnly
    }
    console.log('Settings saved:', savedData)
    return savedData
  }

  const getSettings = async () => {
    const response = await fetch('/api/settings', {
      ...authFetchInit,
      method: 'GET',
    })
    if (!response.ok) {
      throw new Error('Failed to fetch settings')
    }
    return await response.json()
  }

  const getBsPlusSync = async (): Promise<BsPlusSyncGetResult> => {
    const response = await fetch('/api/bsplus/settings/sync', {
      ...authFetchInit,
      method: 'GET',
    })
    if (response.status === 404) {
      return { data: {} }
    }
    if (!response.ok) {
      throw new Error('Failed to fetch BetterSEQTA+ cloud settings')
    }
    const j = (await response.json()) as {
      data?: unknown
      updated_at?: string
      schemaVersion?: number
    }
    const data =
      j.data !== undefined &&
      typeof j.data === 'object' &&
      j.data !== null &&
      !Array.isArray(j.data)
        ? (j.data as Record<string, unknown>)
        : {}
    return {
      data,
      updated_at: j.updated_at,
      schemaVersion: j.schemaVersion,
    }
  }

  const putBsPlusSync = async (flatData: Record<string, unknown>) => {
    const response = await fetch('/api/bsplus/settings/sync', {
      ...authFetchInit,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: CLOUD_SETTINGS_SYNC_SCHEMA_VERSION,
        themeId: normalizeThemeIdForSync(flatData.selectedTheme),
        data: flatData,
      }),
    })
    if (!response.ok) {
      let msg = 'Failed to save BetterSEQTA+ cloud settings'
      try {
        const err = (await response.json()) as { error?: string }
        if (err?.error) msg = err.error
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    return (await response.json()) as { updated_at: string }
  }

  const getCloudSummary = async (): Promise<CloudSummaryResponse> => {
    const response = await fetch('/api/user/cloud-summary', authFetchInit)
    if (!response.ok) {
      throw new Error('Failed to fetch cloud summary')
    }
    return (await response.json()) as CloudSummaryResponse
  }

  return {
    syncSettings,
    getSettings,
    getBsPlusSync,
    putBsPlusSync,
    getCloudSummary,
  }
}
