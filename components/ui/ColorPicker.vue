<template>
  <div class="relative">
    <div class="flex items-center gap-2">
      <button
        @click="isOpen = !isOpen"
        class="w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        :style="{ backgroundColor: modelValue }"
        type="button"
      ></button>
      <input
        type="text"
        name="accent_color_picker"
        autocomplete="off"
        v-model="hexInput"
        @blur="updateFromHex"
        class="w-28 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 font-mono text-sm uppercase"
        maxlength="7"
      />
    </div>

    <!-- Popover -->
    <div
      v-if="isOpen"
      class="absolute z-50 mt-2 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 animate-fade-in w-64 select-none"
    >
      <!-- Saturation/Value Area -->
      <div
        class="relative w-full h-32 rounded-lg mb-3 cursor-crosshair overflow-hidden"
        :style="{ backgroundColor: `hsl(${hue}, 100%, 50%)` }"
        @mousedown.prevent="startDrag($event, 'sv')"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        <div
          class="absolute w-4 h-4 border-2 border-white rounded-full shadow-sm -translate-x-2 -translate-y-2 pointer-events-none"
          :style="{ left: `${saturation}%`, top: `${100 - value}%` }"
        ></div>
      </div>

      <!-- Hue Slider -->
      <div
        class="relative w-full h-4 rounded-full mb-3 cursor-pointer"
        style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
        @mousedown.prevent="startDrag($event, 'hue')"
      >
        <div
          class="absolute top-0 h-full w-4 bg-white border border-zinc-300 rounded-full shadow-sm -translate-x-2 pointer-events-none"
          :style="{ left: `${(hue / 360) * 100}%` }"
        ></div>
      </div>

      <!-- Backdrop -->
      <div class="fixed inset-0 -z-10" @click="isOpen = false"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const hexInput = ref(props.modelValue)

// Color State (HSV)
const hue = ref(0)
const saturation = ref(0)
const value = ref(100)

let isDragging = false
let dragType: 'sv' | 'hue' | null = null
let dragElement: HTMLElement | null = null

// Converters
const hexToHsv = (hex: string) => {
  let r = 0, g = 0, b = 0
  // Strip # if present
  if (hex.startsWith('#')) hex = hex.slice(1)
  
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else {
      return { h: 0, s: 0, v: 0 } // Fallback
  }
  
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, v = max
  const d = max - min
  s = max === 0 ? 0 : d / max
  if (max === min) {
    h = 0
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, v: v * 100 }
}

const hsvToHex = (h: number, s: number, v: number) => {
  let r: number = 0, g: number = 0, b: number = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v / 100 * (1 - s / 100);
  const q = v / 100 * (1 - f * s / 100);
  const t = v / 100 * (1 - (1 - f) * s / 100);
  const val = v / 100;

  switch (i % 6) {
    case 0: r = val; g = t; b = p; break;
    case 1: r = q; g = val; b = p; break;
    case 2: r = p; g = val; b = t; break;
    case 3: r = p; g = q; b = val; break;
    case 4: r = t; g = p; b = val; break;
    case 5: r = val; g = p; b = q; break;
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Sync local state with prop
watch(() => props.modelValue, (newVal) => {
  if (newVal !== hexInput.value) {
      hexInput.value = newVal
      const hsv = hexToHsv(newVal)
      hue.value = hsv.h
      saturation.value = hsv.s
      value.value = hsv.v
  }
}, { immediate: true })

const updateFromHex = () => {
  let val = hexInput.value
  if (!val.startsWith('#')) val = '#' + val
  if (/^#[0-9A-F]{6}$/i.test(val)) {
    const hsv = hexToHsv(val)
    hue.value = hsv.h
    saturation.value = hsv.s
    value.value = hsv.v
    emit('update:modelValue', val)
  } else {
    hexInput.value = props.modelValue
  }
}

const updateColor = () => {
  const hex = hsvToHex(hue.value, saturation.value, value.value)
  if (hex !== props.modelValue) {
      hexInput.value = hex
      emit('update:modelValue', hex)
  }
}

const startDrag = (e: MouseEvent, type: 'sv' | 'hue') => {
  isDragging = true
  dragType = type
  dragElement = e.currentTarget as HTMLElement
  onDrag(e)
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!dragElement) return
  const rect = dragElement.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))

  if (dragType === 'sv') {
    saturation.value = x * 100
    value.value = 100 - (y * 100)
  } else if (dragType === 'hue') {
    hue.value = x * 360
  }
  updateColor()
}

const stopDrag = () => {
  isDragging = false
  dragType = null
  dragElement = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
</script>
