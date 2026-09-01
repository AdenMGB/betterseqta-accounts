<template>
  <div
    v-if="hasBadges"
    class="inline-flex flex-wrap items-center gap-1.5"
  >
    <AdminRoleBadge
      v-if="adminLevel > 0"
      :level="adminLevel"
    />
    <UserBadge
      v-if="founderBadge"
      :badge="founderBadge"
      :signup-number="signupNumber"
      :signed-up-at="signedUpAt"
      @open-detail="openDetail"
    />
    <span
      v-else-if="signupNumber != null"
      class="signup-chip inline-flex items-center rounded-md border border-zinc-200/80 bg-zinc-100/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-300"
      :title="`BetterSEQTA Cloud user #${signupNumber.toLocaleString()}`"
    >
      #{{ signupNumber.toLocaleString() }}
    </span>
  </div>

  <BadgeDetailModal
    :is-open="detailOpen"
    :badge="detailBadge"
    :signup-number="signupNumber"
    :signed-up-at="signedUpAt"
    @close="detailOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminRoleBadge from '~/components/badges/AdminRoleBadge.vue'
import BadgeDetailModal from '~/components/badges/BadgeDetailModal.vue'
import UserBadge from '~/components/badges/UserBadge.vue'
import { displayFounderBadges, type BadgeItem } from '~/utils/badges'

const props = withDefaults(
  defineProps<{
    adminLevel?: number
    signupNumber?: number | null
    signedUpAt?: number | string | null
    badges?: BadgeItem[]
  }>(),
  {
    adminLevel: 0,
    signupNumber: null,
    signedUpAt: null,
    badges: () => [],
  },
)

const detailOpen = ref(false)
const detailBadge = ref<BadgeItem | null>(null)

function openDetail(badge: BadgeItem) {
  detailBadge.value = badge
  detailOpen.value = true
}

const founderBadge = computed(() => {
  const displayed = displayFounderBadges(props.badges ?? [], props.signupNumber)
  return displayed[0] ?? null
})

const hasBadges = computed(
  () =>
    (props.adminLevel ?? 0) > 0
    || founderBadge.value != null
    || props.signupNumber != null,
)
</script>

<style scoped>
.signup-chip {
  letter-spacing: 0.01em;
}
</style>
