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
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="handleCancel"
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
          class="w-full max-w-lg mx-4 p-6 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-semibold text-zinc-900 dark:text-white">
              Crop Profile Picture
            </h3>
            <button
              type="button"
              @click="handleCancel"
              class="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Close"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <div class="cropper-container mb-4 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900">
            <Cropper
              ref="cropperRef"
              :src="imageSrc"
              :stencil-component="RectangleStencil"
              :stencil-props="{
                aspectRatio: 1,
                movable: true,
                resizable: true
              }"
              class="cropper h-80"
            />
          </div>

          <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Drag to reposition, use the handles to resize. The image will be cropped as a square for your profile picture.
          </p>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="handleCancel"
              class="px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleConfirm"
              :disabled="confirming"
              class="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span v-if="confirming">Cropping...</span>
              <span v-else>Apply Crop</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Cropper, RectangleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  isOpen: boolean
  imageSrc: string | null
}>()

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const confirming = ref(false)

watch(() => props.isOpen, (open) => {
  if (!open) {
    confirming.value = false
  }
})

const handleCancel = () => {
  emit('cancel')
}

const handleConfirm = () => {
  const cropper = cropperRef.value
  if (!cropper || !props.imageSrc) return

  const result = cropper.getResult()
  if (!result.canvas) {
    return
  }

  confirming.value = true

  // Use JPEG for smaller file size (profile pics typically don't need transparency)
  const mimeType = 'image/jpeg'
  const quality = 0.9

  result.canvas.toBlob(
    (blob) => {
      if (!blob) {
        confirming.value = false
        return
      }
      const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png'
      const file = new File([blob], `profile-picture${ext}`, { type: mimeType })
      emit('confirm', file)
      confirming.value = false
    },
    mimeType,
    quality
  )
}
</script>

<style scoped>
.cropper-container {
  min-height: 20rem;
}

:deep(.cropper) {
  --cropper-background-color: transparent;
}

:deep(.vue-advanced-cropper__background) {
  background: transparent;
}

:deep(.vue-advanced-cropper__stencil) {
  border: 2px solid #FF6B00;
}

:deep(.vue-advanced-cropper__handler) {
  background: #FF6B00;
}

:deep(.vue-advanced-cropper__line) {
  background: #FF6B00;
  opacity: 0.5;
}
</style>
