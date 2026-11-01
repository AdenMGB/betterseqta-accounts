let webpSupportCache: boolean | null = null

/** Whether this browser can encode WebP via canvas (Safari 14+, Chromium, etc.). */
export function supportsClientWebP(): boolean {
  if (webpSupportCache !== null) return webpSupportCache
  if (typeof document === 'undefined') {
    webpSupportCache = false
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    webpSupportCache = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpSupportCache = false
  }
  return webpSupportCache
}

export const PFP_MAX_UPLOAD_WITH_WEBP = 20 * 1024 * 1024
export const PFP_MAX_UPLOAD_LEGACY = 10 * 1024 * 1024

export function maxPfpSourceUploadBytes(): number {
  return supportsClientWebP() ? PFP_MAX_UPLOAD_WITH_WEBP : PFP_MAX_UPLOAD_LEGACY
}

const IMAGE_EXT =
  /\.(heic|heif|jpe?g|png|gif|webp|bmp|avif|tiff?)$/i

export function isAllowedPfpSourceFile(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith('image/')) return true
  if (type === 'application/octet-stream' || type === '') {
    return IMAGE_EXT.test(file.name)
  }
  return false
}

export function maxPfpUploadLabelMb(): number {
  return maxPfpSourceUploadBytes() / (1024 * 1024)
}

export function cropperOutputMimeType(): string {
  return supportsClientWebP() ? 'image/webp' : 'image/jpeg'
}

export function cropperOutputQuality(): number {
  return supportsClientWebP() ? 0.82 : 0.9
}

export const PFP_OUTPUT_SIDE = 512

export function cropCanvasToPfpOutput(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = PFP_OUTPUT_SIDE
  out.height = PFP_OUTPUT_SIDE
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, 0, 0, PFP_OUTPUT_SIDE, PFP_OUTPUT_SIDE)
  return out
}

export function cropperOutputExtension(): string {
  return supportsClientWebP() ? '.webp' : '.jpg'
}
