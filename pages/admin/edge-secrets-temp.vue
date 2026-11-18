<template>
  <div class="mx-auto max-w-3xl p-4 sm:p-6">
  <h1 class="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">Temp: Worker secrets for edge</h1>
  <p class="mb-6 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
    One-time setup for bs-edge-api. Senior admin only. Remove this page and
    <code class="text-xs">/api/admin/temp/worker-secrets</code> after copying values — do not leave in production.
  </p>

  <div v-if="forbidden" class="text-center py-12 text-zinc-600 dark:text-zinc-400">
    Senior admin access required.
  </div>

  <template v-else>
    <div v-if="loading" class="text-zinc-600 dark:text-zinc-400">Loading from Worker…</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

    <div v-else-if="payload" class="space-y-6">
      <section
        v-for="block in secretBlocks"
        :key="block.key"
        class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 shadow-md p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 class="text-sm font-medium text-zinc-900 dark:text-white">{{ block.label }}</h2>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-500 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            @click="copy(block.value, block.key)"
          >
            {{ copiedKey === block.key ? "Copied" : "Copy" }}
          </button>
        </div>
        <textarea
          :value="block.value || '(not set on Worker)'"
          readonly
          rows="3"
          class="w-full text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white p-3"
          @focus="($event.target as HTMLTextAreaElement).select()"
        />
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Env: <code>{{ block.envName }}</code></p>
      </section>

      <pre
        class="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-white p-4 overflow-x-auto"
      >{{ envSnippet }}</pre>
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-500 hover:scale-105 transition-all duration-200"
        @click="copy(envSnippet, 'snippet')"
      >
        {{ copiedKey === "snippet" ? "Copied .env block" : "Copy .env block" }}
      </button>
    </div>
  </template>
  </div>
</template>

<script setup lang="ts">
type SecretsPayload = {
  warning?: string
  jwt_secret: string
  edge_relay_secret: string
  jwt_secret_set: boolean
  edge_relay_secret_set: boolean
  error?: string
}

const auth = useAuth()
const loading = ref(true)
const error = ref<string | null>(null)
const forbidden = ref(false)
const payload = ref<SecretsPayload | null>(null)
const copiedKey = ref<string | null>(null)
const maxAdminLevel = ref(3)

const secretBlocks = computed(() => {
  if (!payload.value) return []
  return [
    {
      key: "jwt",
      label: "JWT_SECRET (Worker)",
      envName: "JWT_SECRET",
      value: payload.value.jwt_secret,
    },
    {
      key: "edge",
      label: "EDGE_RELAY_SECRET (Worker)",
      envName: "EDGE_RELAY_SECRET",
      value: payload.value.edge_relay_secret,
    },
  ]
})

const envSnippet = computed(() => {
  if (!payload.value) return ""
  return [
    "# paste into bs-edge-api/.env on Ubuntu",
    `JWT_SECRET=${payload.value.jwt_secret}`,
    `EDGE_RELAY_SECRET=${payload.value.edge_relay_secret}`,
  ].join("\n")
})

async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2000)
  } catch {
    error.value = "Clipboard failed — select the text manually"
  }
}

onMounted(async () => {
  if (!auth.user.value) {
    await auth.fetchUser()
  }
  try {
    const usersRes = await $fetch<{ maxAdminLevel: number }>("/api/admin/users", {
      query: { page: 1, pageSize: 1 },
    })
    maxAdminLevel.value = usersRes.maxAdminLevel || 3
  } catch {
    /* ignore */
  }

  const level = auth.user.value?.admin_level || 0
  if (level < maxAdminLevel.value) {
    forbidden.value = true
    loading.value = false
    return
  }

  try {
    payload.value = await $fetch<SecretsPayload>("/api/admin/temp/worker-secrets")
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { error?: string } }
    if (err.statusCode === 403) {
      forbidden.value = true
    } else {
      error.value = err.data?.error || "Failed to load secrets from Worker"
    }
  } finally {
    loading.value = false
  }
})
</script>