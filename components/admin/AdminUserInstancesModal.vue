<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && user"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="presentation"
      @click.self="emit('close')"
    >
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          class="w-full max-w-2xl max-h-[min(90vh,640px)] flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-tq-instances-modal-title"
        >
          <div class="flex items-start justify-between gap-4 p-6 pb-4 shrink-0">
            <div class="min-w-0">
              <h3
                id="admin-tq-instances-modal-title"
                class="text-xl font-semibold text-zinc-900 dark:text-white"
              >
                SEQTA instances
              </h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                <template v-if="displayName && displayName !== displayUsername">
                  {{ displayName }} · @{{ displayUsername }}
                </template>
                <template v-else>
                  @{{ displayUsername }}
                </template>
              </p>
              <p class="text-xs font-mono text-zinc-400 dark:text-zinc-500 mt-1 truncate" :title="user.id">
                {{ user.id }}
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
              aria-label="Close"
              @click="emit('close')"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="px-6 pb-6 overflow-y-auto overscroll-contain admin-table-scroll space-y-4">
            <div v-if="loading" class="flex justify-center py-12">
              <LoadingSpinner size="md" />
            </div>

            <div
              v-else-if="loadError"
              class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
            >
              {{ loadError }}
            </div>

            <div
              v-else-if="!available"
              class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
            >
              Timetable classmates tables are not available. Run migrations 0020+ on this database.
            </div>

            <p v-else-if="!instances.length" class="text-sm text-center text-zinc-500 dark:text-zinc-400 py-8">
              No SEQTA school registrations for this account.
            </p>

            <div
              v-else
              class="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/40 dark:border-zinc-700/60 dark:bg-zinc-950/20"
            >
              <div class="overflow-x-auto admin-table-scroll">
                <table class="w-full text-left min-w-[32rem]">
                  <thead class="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th class="py-2.5 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Instance</th>
                      <th class="py-2.5 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Status</th>
                      <th class="py-2.5 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Student ID</th>
                      <th class="py-2.5 px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Last seen</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-200 dark:divide-zinc-700">
                    <tr v-for="row in instances" :key="row.membershipId" class="text-sm">
                      <td class="py-3 px-3 align-top min-w-0">
                        <p class="font-mono text-xs sm:text-sm text-zinc-900 dark:text-white break-all [overflow-wrap:anywhere]">
                          {{ row.instanceHost }}
                        </p>
                        <div class="flex flex-wrap gap-1.5 mt-1.5">
                          <span
                            v-if="row.isInstanceCoordinator"
                            class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-700 dark:text-primary-200"
                          >
                            Coordinator
                          </span>
                          <span
                            v-if="row.hasRelayShare"
                            class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                          >
                            Relay share
                          </span>
                        </div>
                      </td>
                      <td class="py-3 px-3 align-top whitespace-nowrap">
                        <span
                          class="text-xs font-semibold px-2 py-0.5 rounded-full"
                          :class="row.active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'"
                        >
                          {{ row.active ? 'Active' : 'Revoked' }}
                        </span>
                      </td>
                      <td class="py-3 px-3 align-top tabular-nums text-zinc-700 dark:text-zinc-200">
                        {{ row.seqtaStudentId }}
                      </td>
                      <td class="py-3 px-3 align-top text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {{ formatWhen(row.lastSeenAt) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40 rounded-b-xl">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import LoadingSpinner from '~/components/ui/LoadingSpinner.vue'

type AdminUserRef = {
  id: string
  username: string
  displayName?: string | null
}

type InstanceRow = {
  membershipId: string
  instanceHost: string
  seqtaStudentId: number
  seqtaPersonUuid: string
  optedInAt: string
  lastSeenAt: string
  revokedAt: string | null
  active: boolean
  isInstanceCoordinator: boolean
  hasRelayShare: boolean
}

const props = defineProps<{
  isOpen: boolean
  user: AdminUserRef | null
}>()

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const loadError = ref('')
const available = ref(true)
const instances = ref<InstanceRow[]>([])
const displayUsername = ref('')
const displayName = ref<string | null>(null)

const formatWhen = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

async function loadInstances() {
  if (!props.user?.id) return
  displayUsername.value = props.user.username
  displayName.value = props.user.displayName ?? null
  loading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<{
      available: boolean
      instances: InstanceRow[]
      username?: string
      displayName?: string | null
    }>('/api/admin/user/tq-instances', {
      query: { userId: props.user.id },
      credentials: 'include',
    })
    available.value = res.available
    instances.value = res.instances ?? []
    if (res.username) displayUsername.value = res.username
    if (res.displayName !== undefined) displayName.value = res.displayName
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    loadError.value = err?.data?.error || 'Failed to load SEQTA instances'
    instances.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.isOpen, props.user?.id] as const,
  ([open]) => {
    if (open && props.user?.id) void loadInstances()
  },
)
</script>
