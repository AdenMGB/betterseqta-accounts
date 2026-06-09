<template>

  <div

    class="group/stack relative shrink-0"

    :class="[compact ? 'compact' : 'transition-[width] duration-200']"

    :style="compact ? { width: '36px', height: '36px' } : { width: `${36 + Math.min(history.length, 3) * fanOffset}px`, height: '36px' }"

  >

    <template v-if="!compact">

      <img

        v-for="(h, i) in history.slice(0, 3)"

        :key="h.id"

        :src="bust(h.r2Key)"

        alt=""

        loading="lazy"

        decoding="async"

        class="absolute top-0 w-9 h-9 rounded-full object-cover border-2 border-white dark:border-zinc-800 cursor-pointer shadow-sm transition-[left] duration-200"

        :style="{ left: `${(i + 1) * fanOffset}px`, zIndex: 3 - i }"

        @click="$emit('view', bust(h.r2Key))"

      />

    </template>

    <div class="absolute top-0 left-0" style="z-index: 4">

      <img

        :src="bust(currentSrc)"

        alt=""

        loading="lazy"

        decoding="async"

        class="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-zinc-800 cursor-pointer shadow-sm"

        @click="$emit('view', bust(currentSrc))"

      />

      <button

        v-if="canEdit"

        type="button"

        class="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 hover:bg-primary-600 text-white rounded-full flex items-center justify-center shadow transition-colors"

        title="Edit profile pictures"

        @click.stop="$emit('edit')"

      >

        <PencilIcon class="w-2.5 h-2.5" />

      </button>

    </div>

  </div>

</template>



<script setup lang="ts">

import { computed } from 'vue'

import { PencilIcon } from '@heroicons/vue/24/outline'

import { withPfpCacheBust, dicebearUrl } from '~/utils/pfp'



type PfpHistoryItem = {

  id: string

  r2Key: string

  createdAt?: number

}



const props = defineProps<{

  userId: string

  pfpUrl?: string | null

  pfpHistory?: PfpHistoryItem[]

  canEdit?: boolean

  cacheVersion?: number | string

  /** List/table views: single avatar only (no history fan). */

  compact?: boolean

}>()



defineEmits<{

  edit: []

  view: [src: string]

}>()



const history = computed(() => props.pfpHistory ?? [])

const fanOffset = computed(() => 10)



const currentSrc = computed(

  () => props.pfpUrl || dicebearUrl(props.userId),

)



const bust = (url: string) => withPfpCacheBust(url, props.cacheVersion)

</script>



<style scoped>

.group\/stack:not(.compact):hover img {

  --fan: 14px;

}

.group\/stack:not(.compact):hover img:nth-child(1) { left: calc(1 * 14px) !important; }

.group\/stack:not(.compact):hover img:nth-child(2) { left: calc(2 * 14px) !important; }

.group\/stack:not(.compact):hover img:nth-child(3) { left: calc(3 * 14px) !important; }

</style>


