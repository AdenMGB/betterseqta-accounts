<template>
  <div class="hidden md:block">
    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-30 bg-black/40"
      aria-hidden="true"
      @click="close"
    />

    <aside class="sidebar-root" :aria-expanded="isOpen">
      <!-- Shell = final sidebar bounds; circle grows inside and gets clipped -->
      <div
        class="sidebar-shell"
        :class="{ 'sidebar-shell--open': isOpen }"
      >
        <div
          class="sidebar-circle"
          :class="{
            'sidebar-circle--open': isOpen,
            'sidebar-circle--ready': hasAnimated,
          }"
        />
        <div class="sidebar-content">
          <div
            class="sidebar-brand sidebar-reveal-item"
            :class="{ 'sidebar-reveal-item--visible': isOpen }"
            :style="{ '--reveal-delay': '0.1s' }"
          >
            <span class="sidebar-brand-text">BetterSEQTA+</span>
            <UserCircleIcon class="sidebar-brand-icon" />
          </div>

          <nav class="sidebar-nav">
            <NuxtLink
              v-for="(item, index) in navItems"
              :key="item.path"
              :to="item.path"
              :class="[
                'sidebar-nav-item sidebar-reveal-item',
                { 'sidebar-reveal-item--visible': isOpen },
                getLinkClass(item.path),
              ]"
              :style="{ '--reveal-delay': `${0.16 + index * 0.06}s` }"
              @click="close"
            >
              <component :is="item.icon" class="w-6 h-6 flex-shrink-0" />
              <span class="sidebar-nav-label">{{ item.label }}</span>
            </NuxtLink>
          </nav>

          <div class="sidebar-footer">
            <button
              type="button"
              class="sidebar-nav-item sidebar-logout sidebar-reveal-item"
              :class="{ 'sidebar-reveal-item--visible': isOpen }"
              :style="{ '--reveal-delay': `${0.16 + navItems.length * 0.06}s` }"
              @click="handleLogout"
            >
              <ArrowRightOnRectangleIcon class="w-6 h-6 flex-shrink-0" />
              <span class="sidebar-nav-label">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Toggle sits at the circle origin -->
      <button
        type="button"
        class="sidebar-toggle"
        :class="{ 'sidebar-toggle--open': isOpen }"
        :aria-label="isOpen ? 'Close menu' : 'Open menu'"
        @click="toggle"
      >
        <svg
          class="ham hamRotate ham8"
          :class="{ active: isOpen }"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <path
            class="line top"
            d="m 30,33 h 40 c 3.722839,0 7.5,3.126468 7.5,8.578427 0,5.451959 -2.727029,8.421573 -7.5,8.421573 h -20"
          />
          <path class="line middle" d="m 30,50 h 40" />
          <path
            class="line bottom"
            d="m 70,67 h -40 c 0,0 -7.5,-0.802118 -7.5,-8.365747 0,-7.563629 7.5,-8.634253 7.5,-8.634253 h 20"
          />
        </svg>
      </button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import {
  HomeIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline'

const auth = useAuth()
const route = useRoute()
const isOpen = ref(false)
const hasAnimated = ref(false)

const isAdmin = computed(() => {
  return auth.user.value && (auth.user.value?.admin_level ?? 0) > 0
})

const navItems = computed(() => {
  const items = [
    { path: '/', label: 'Dashboard', icon: HomeIcon },
    { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
  ]
  if (isAdmin.value) {
    items.push({ path: '/admin', label: 'Admin', icon: ShieldCheckIcon })
  }
  return items
})

function toggle() {
  hasAnimated.value = true
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

watch(() => route.path, () => {
  close()
})

function handleLogout() {
  close()
  auth.logout()
}

function getLinkClass(path: string) {
  const isActive = route.path === path
  return isActive
    ? 'bg-primary-500/10 text-primary-500 font-semibold'
    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-white'
}
</script>
