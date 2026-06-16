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

export const useSettings = () => {
  const getAuthToken = () => {
    if (process.client) {
      return localStorage.getItem('token');
    }
    return null;
  }

  const syncSettings = async (mySettings: any) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(mySettings)
    });
    
    if (!response.ok) {
        throw new Error('Failed to save settings');
    }

    const savedData = await response.json();
    // POST /api/settings returns { ok, server, ...mergedSettings } after sync-metadata migration
    if (savedData && typeof savedData === 'object' && savedData.ok === true && savedData.server) {
      const { ok: _ok, server: _server, ...settingsOnly } = savedData;
      console.log('Settings saved:', settingsOnly, 'server:', _server);
      return settingsOnly;
    }
    console.log("Settings saved:", savedData);
    return savedData;
  };

  const getSettings = async () => {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/settings', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return await response.json();
  }

  const getBsPlusSync = async (): Promise<BsPlusSyncGetResult> => {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    const response = await fetch('/api/bsplus/settings/sync', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
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
    const token = getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    const response = await fetch('/api/bsplus/settings/sync', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
    const token = getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }
    const response = await fetch('/api/user/cloud-summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
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
  };
};

