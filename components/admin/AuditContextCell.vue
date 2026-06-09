<template>
  <div class="text-sm text-zinc-600 dark:text-zinc-400 min-w-0 max-w-full overflow-hidden">
    <div v-if="pfpResolved" class="flex items-center gap-2 min-w-0 overflow-hidden">
      <button
        v-if="pfpResolved.from.available && pfpResolved.from.url"
        type="button"
        class="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
        @click="$emit('view', bust(pfpResolved.from.url))"
      >
        <img :src="bust(pfpResolved.from.url)" alt="Before" class="w-10 h-10 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-600" />
      </button>
      <div v-else class="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] text-zinc-500 text-center px-1" title="No longer available">N/A</div>
      <span class="text-zinc-400 shrink-0">→</span>
      <button
        v-if="pfpResolved.to.available && pfpResolved.to.url"
        type="button"
        class="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
        @click="$emit('view', bust(pfpResolved.to.url))"
      >
        <img :src="bust(pfpResolved.to.url)" alt="After" class="w-10 h-10 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-600" />
      </button>
      <div v-else class="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] text-zinc-500 text-center px-1" title="No longer available">N/A</div>
    </div>

    <div v-else-if="ctx.fromLevel !== undefined && ctx.toLevel !== undefined" class="flex items-center gap-2 flex-wrap min-w-0 overflow-hidden">
      <span class="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-700">{{ roleLabel(ctx.fromLevel) }}</span>
      <span class="text-zinc-400">→</span>
      <span class="px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{{ roleLabel(ctx.toLevel) }}</span>
      <span v-if="ctx.targetUsername" class="text-xs text-zinc-500">({{ ctx.targetUsername }})</span>
    </div>

    <ul v-else-if="hasFieldChanges" class="space-y-1 text-xs min-w-0 overflow-hidden">
      <li v-for="(change, field) in ctx.changes" :key="String(field)" class="truncate">
        <span class="font-medium capitalize">{{ field }}:</span>
        <span class="line-through text-zinc-400 mx-1">{{ change.from || '—' }}</span>
        <span>→</span>
        <span class="ml-1 text-zinc-800 dark:text-zinc-200">{{ change.to || '—' }}</span>
      </li>
    </ul>

    <div v-else-if="entry.action === 'user.delete'" class="text-xs">
      <span v-if="ctx.username">{{ ctx.username }}</span>
      <span v-if="ctx.email" class="text-zinc-500 ml-1">({{ ctx.email }})</span>
    </div>

    <div v-else-if="entry.action === 'user.password_reset'" class="text-xs">
      Reset email sent<span v-if="ctx.email"> to {{ ctx.email }}</span>
    </div>

    <div v-else-if="ctx.name" class="text-xs">
      {{ ctx.name }}
      <span v-if="ctx.clientId || ctx.keyId" class="text-zinc-500 font-mono ml-1">{{ ctx.clientId || ctx.keyId }}</span>
    </div>

    <div v-else-if="ctx.total !== undefined" class="text-xs">
      {{ ctx.succeeded ?? ctx.migrated ?? ctx.fixed ?? 0 }} / {{ ctx.total }} succeeded
      <span v-if="ctx.failed" class="text-red-500 ml-1">({{ ctx.failed }} failed)</span>
      <span v-if="ctx.rowsDeleted !== undefined" class="ml-1">{{ ctx.rowsDeleted }} rows pruned</span>
    </div>

    <div v-else-if="ctx.error" class="text-xs text-red-500">{{ ctx.error }}</div>
    <div v-else class="text-xs text-zinc-500 truncate">{{ summary }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolvePfpAuditContextClient, type PfpAuditRef } from '~/utils/pfpAudit'
import { withPfpCacheBust } from '~/utils/pfp'

const props = defineProps<{
  entry: {
    action: string
    targetId?: string
    summary?: string
    details?: Record<string, unknown>
    contextResolved?: {
      from: { available: boolean; url?: string; label: string }
      to: { available: boolean; url?: string; label: string }
    }
  }
  maxAdminLevel?: number
  cacheVersion?: number | string
}>()

defineEmits<{ view: [src: string] }>()

const ctx = computed(() => (props.entry.details?.context ?? {}) as Record<string, any>)
const pfpResolved = computed(() => {
  if (props.entry.contextResolved) return props.entry.contextResolved
  if (!props.entry.action.startsWith('pfp.')) return null
  const context = ctx.value as { from?: PfpAuditRef; to?: PfpAuditRef }
  return resolvePfpAuditContextClient(props.entry.targetId ?? '', context)
})

const hasFieldChanges = computed(() => {
  const changes = ctx.value.changes
  return changes && typeof changes === 'object' && Object.keys(changes).length > 0
})

const bust = (url: string) => withPfpCacheBust(url, props.cacheVersion)

const roleLabel = (level: number) => {
  const max = props.maxAdminLevel ?? 3
  if (level === 0) return 'User'
  if (level === max) return 'Senior Admin'
  if (level === 1) return 'Junior Admin'
  if (level === 2) return 'Middle Admin'
  return `Level ${level} Admin`
}

const summary = computed(() => props.entry.summary || JSON.stringify(ctx.value).slice(0, 80))
</script>
