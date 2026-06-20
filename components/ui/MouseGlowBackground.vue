<template>
  <div
    class="mouse-grid-bg pointer-events-none absolute inset-0 z-0 overflow-hidden"
    aria-hidden="true"
  >
    <div
      class="absolute inset-0 bg-white dark:bg-zinc-900 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:20px_20px]"
    />
    <canvas
      v-if="enabled"
      ref="canvasEl"
      class="mouse-grid-canvas absolute inset-0 h-full w-full"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePreferredReducedMotion, useDark } from '@vueuse/core'

const TILE = 20
const CURSOR_RADIUS_TILES = 1.35
const CURSOR_MAX_FLIP = 0.38
const TRAIL_DECAY = 0.905
const TRAIL_STEP_PX = 4
const TRAIL_STRENGTH = 0.78
const TRAIL_GHOST_STRENGTH = 0.52
/** Smoothed cursor — lags behind the real pointer. */
const POINTER_EASE = 0.13
/** Second, slower layer — the trailing “echo”. */
const GHOST_EASE = 0.065
const LAG_GLOW_STRENGTH = 0.62
const GHOST_GLOW_STRENGTH = 0.38
/** Lateral orbit of the ghost trail around the main path (px at full strength). */
const GHOST_WOBBLE_AMPLITUDE = 70
/** Main-trail speed (px/frame) at which wobble reaches full amplitude. */
const GHOST_WOBBLE_SPEED_FULL = 0.2
const GHOST_WOBBLE_PHASE_RATE = 0.0013
const GHOST_WOBBLE_PHASE_PER_PX = 0.005
const GHOST_WOBBLE_STRENGTH_EASE = 0.18
const MAX_FLIP = 0.22
const CLICK_RIPPLE_DURATION = 280
const CLICK_RIPPLE_MAX_RADIUS = 10
const RIPPLE_RING_WIDTH_PX = 8
const RIPPLE_EDGE_PEAK = 0.72
const RIPPLE_FADE_EXPONENT = 0.55
const MAX_CONCURRENT_RIPPLES = 8

interface ClickRipple {
  x: number
  y: number
  start: number
}

const clickRipples: ClickRipple[] = []

const canvasEl = ref<HTMLCanvasElement | null>(null)
const targetX = ref(0)
const targetY = ref(0)
const x = ref(0)
const y = ref(0)
const trailX = ref(0)
const trailY = ref(0)
const ghostX = ref(0)
const ghostY = ref(0)
const trailGhostX = ref(0)
const trailGhostY = ref(0)
const mouseOnScreen = ref(false)
/** False until we have a real client position — avoids animating from (0, 0). */
const pointerInitialized = ref(false)

const tileFlips = new Map<string, number>()

const reducedMotion = usePreferredReducedMotion()
const isDark = useDark()
const enabled = computed(() => reducedMotion.value !== 'reduce')

let frame = 0
let resizeObserver: ResizeObserver | null = null
let ghostWobblePhase = 0
let wobbleStrength = 0
let trailGhostDrawX = 0
let trailGhostDrawY = 0

function tileKey(col: number, row: number) {
  return `${col},${row}`
}

function setCanvasSize(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function cursorColors() {
  return {
    fill: isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.055)',
    edge: isDark.value ? 'rgba(255, 255, 255, 0.34)' : 'rgba(0, 0, 0, 0.22)',
  }
}

function rippleEdgeColor() {
  return isDark.value ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.2)'
}

function drawCursorTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  flip: number,
) {
  if (flip < 0.003) return

  const { fill, edge } = cursorColors()
  const t = Math.min(1, flip / CURSOR_MAX_FLIP)
  const squash = 1 - t * 0.18
  const drawSize = TILE * squash
  const offset = (TILE - drawSize) / 2
  const x0 = tx + 1 + offset
  const y0 = ty + 1 + offset
  const size = drawSize - 1

  ctx.fillStyle = fill
  ctx.globalAlpha = 0.35 + t * 0.65
  ctx.fillRect(x0, y0, size, size)

  ctx.strokeStyle = edge
  ctx.globalAlpha = Math.min(1, 0.45 + t * 0.55)
  ctx.lineWidth = 1
  ctx.strokeRect(tx + 0.5 + offset, ty + 0.5 + offset, drawSize - 1, drawSize - 1)

  ctx.globalAlpha = 1
}

function drawRippleTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  intensity: number,
) {
  if (intensity < 0.02) return

  ctx.strokeStyle = rippleEdgeColor()
  ctx.globalAlpha = Math.min(1, intensity)
  ctx.lineWidth = 1
  ctx.strokeRect(tx + 0.5, ty + 0.5, TILE - 1, TILE - 1)
  ctx.globalAlpha = 1
}

function clearTrail() {
  tileFlips.clear()
  trailX.value = targetX.value
  trailY.value = targetY.value
  trailGhostX.value = targetX.value
  trailGhostY.value = targetY.value
  x.value = targetX.value
  y.value = targetY.value
  ghostX.value = targetX.value
  ghostY.value = targetY.value
  ghostWobblePhase = 0
  wobbleStrength = 0
  trailGhostDrawX = targetX.value
  trailGhostDrawY = targetY.value
}

function ghostWobbleOffset(
  mainDx: number,
  mainDy: number,
  ghostDx: number,
  ghostDy: number,
) {
  const mainSpeed = Math.hypot(mainDx, mainDy)
  const targetStrength = Math.min(1, mainSpeed / GHOST_WOBBLE_SPEED_FULL)
  wobbleStrength += (targetStrength - wobbleStrength) * GHOST_WOBBLE_STRENGTH_EASE
  if (wobbleStrength < 0.015) {
    wobbleStrength = 0
    return { x: 0, y: 0 }
  }

  const ghostSpeed = Math.hypot(ghostDx, ghostDy)
  let perpX = 0
  let perpY = 0
  if (ghostSpeed > 0.4) {
    perpX = -ghostDy / ghostSpeed
    perpY = ghostDx / ghostSpeed
  } else if (mainSpeed > 0.4) {
    perpX = -mainDy / mainSpeed
    perpY = mainDx / mainSpeed
  } else {
    return { x: 0, y: 0 }
  }

  ghostWobblePhase += GHOST_WOBBLE_PHASE_RATE + mainSpeed * GHOST_WOBBLE_PHASE_PER_PX
  const offset = GHOST_WOBBLE_AMPLITUDE * wobbleStrength * Math.sin(ghostWobblePhase)
  return { x: perpX * offset, y: perpY * offset }
}

function updateTilesNear(mx: number, my: number, strength = 1) {
  const col = Math.floor(mx / TILE)
  const row = Math.floor(my / TILE)
  const radius = Math.ceil(CURSOR_RADIUS_TILES)
  const maxDistPx = CURSOR_RADIUS_TILES * TILE

  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      const cx = (col + dc + 0.5) * TILE
      const cy = (row + dr + 0.5) * TILE
      const distPx = Math.hypot(cx - mx, cy - my)
      if (distPx > maxDistPx) continue
      const t = 1 - distPx / maxDistPx
      const flip = t * t * CURSOR_MAX_FLIP * strength
      const key = tileKey(col + dc, row + dr)
      tileFlips.set(key, Math.max(tileFlips.get(key) ?? 0, flip))
    }
  }
}

function stampTrail(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strengthMul = TRAIL_STRENGTH,
) {
  const dist = Math.hypot(toX - fromX, toY - fromY)
  if (dist < 0.5) return

  const steps = Math.max(1, Math.ceil(dist / TRAIL_STEP_PX))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const sx = fromX + (toX - fromX) * t
    const sy = fromY + (toY - fromY) * t
    const strength = strengthMul * (0.3 + 0.7 * t)
    updateTilesNear(sx, sy, strength)
  }
}

function decayTiles() {
  for (const [key, value] of tileFlips) {
    const next = value * TRAIL_DECAY
    if (next < 0.003) tileFlips.delete(key)
    else tileFlips.set(key, next)
  }
}

function drawClickRipples(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
  for (let i = clickRipples.length - 1; i >= 0; i--) {
    const ripple = clickRipples[i]
    const progress = (now - ripple.start) / CLICK_RIPPLE_DURATION
    if (progress >= 1) {
      clickRipples.splice(i, 1)
      continue
    }

    const ringRadiusPx = progress * CLICK_RIPPLE_MAX_RADIUS * TILE
    const fade = 1 - Math.pow(progress, RIPPLE_FADE_EXPONENT)
    const minCol = Math.floor((ripple.x - ringRadiusPx - TILE) / TILE)
    const maxCol = Math.ceil((ripple.x + ringRadiusPx + TILE) / TILE)
    const minRow = Math.floor((ripple.y - ringRadiusPx - TILE) / TILE)
    const maxRow = Math.ceil((ripple.y + ringRadiusPx + TILE) / TILE)

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const cx = col * TILE + TILE / 2
        const cy = row * TILE + TILE / 2
        const distPx = Math.hypot(cx - ripple.x, cy - ripple.y)
        const ringDelta = Math.abs(distPx - ringRadiusPx)
        if (ringDelta > RIPPLE_RING_WIDTH_PX) continue

        const ring = 1 - ringDelta / RIPPLE_RING_WIDTH_PX
        const intensity = ring * fade * RIPPLE_EDGE_PEAK
        const tx = col * TILE
        const ty = row * TILE
        if (tx > w || ty > h) continue
        drawRippleTile(ctx, tx, ty, intensity)
      }
    }
  }
}

function drawTiles(canvas: HTMLCanvasElement, now: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.clientWidth
  const h = canvas.clientHeight
  ctx.clearRect(0, 0, w, h)

  const hasRipples = clickRipples.some((r) => now - r.start < CLICK_RIPPLE_DURATION)
  if (!mouseOnScreen.value && tileFlips.size === 0 && !hasRipples) return
  if (!pointerInitialized.value && tileFlips.size === 0 && !hasRipples) return

  for (const [key, flip] of tileFlips) {
    if (flip < 0.003) continue
    const [colStr, rowStr] = key.split(',')
    const tx = Number(colStr) * TILE
    const ty = Number(rowStr) * TILE
    if (tx > w || ty > h) continue
    drawCursorTile(ctx, tx, ty, flip)
  }

  drawClickRipples(ctx, w, h, now)
}

function needsAnimation(now: number) {
  if (mouseOnScreen.value && pointerInitialized.value) return true
  if (tileFlips.size > 0) return true
  return clickRipples.some((r) => now - r.start < CLICK_RIPPLE_DURATION)
}

function ensureTicking() {
  if (!enabled.value || frame) return
  frame = requestAnimationFrame(tick)
}

function tick(now: number) {
  frame = 0

  const ease = POINTER_EASE
  x.value += (targetX.value - x.value) * ease
  y.value += (targetY.value - y.value) * ease
  ghostX.value += (x.value - ghostX.value) * GHOST_EASE
  ghostY.value += (y.value - ghostY.value) * GHOST_EASE

  decayTiles()
  if (mouseOnScreen.value && pointerInitialized.value) {
    const mainDx = x.value - trailX.value
    const mainDy = y.value - trailY.value
    const ghostDx = ghostX.value - trailGhostX.value
    const ghostDy = ghostY.value - trailGhostY.value
    const wobble = ghostWobbleOffset(mainDx, mainDy, ghostDx, ghostDy)
    const ghostDrawX = ghostX.value + wobble.x
    const ghostDrawY = ghostY.value + wobble.y

    stampTrail(trailX.value, trailY.value, x.value, y.value)
    stampTrail(trailGhostDrawX, trailGhostDrawY, ghostDrawX, ghostDrawY, TRAIL_GHOST_STRENGTH)
    updateTilesNear(x.value, y.value, LAG_GLOW_STRENGTH)
    updateTilesNear(ghostDrawX, ghostDrawY, GHOST_GLOW_STRENGTH)
    trailX.value = x.value
    trailY.value = y.value
    trailGhostX.value = ghostX.value
    trailGhostY.value = ghostY.value
    trailGhostDrawX = ghostDrawX
    trailGhostDrawY = ghostDrawY
  }

  const canvas = canvasEl.value
  if (canvas) drawTiles(canvas, now)

  if (needsAnimation(now)) {
    frame = requestAnimationFrame(tick)
  }
}

function handleClick(event: MouseEvent) {
  if (!enabled.value || event.button !== 0) return
  if (clickRipples.length >= MAX_CONCURRENT_RIPPLES) clickRipples.shift()
  clickRipples.push({
    x: event.clientX,
    y: event.clientY,
    start: performance.now(),
  })
  ensureTicking()
}

function syncPointer(clientX: number, clientY: number) {
  targetX.value = clientX
  targetY.value = clientY
  x.value = clientX
  y.value = clientY
  ghostX.value = clientX
  ghostY.value = clientY
  trailX.value = clientX
  trailY.value = clientY
  trailGhostX.value = clientX
  trailGhostY.value = clientY
  ghostWobblePhase = 0
  wobbleStrength = 0
  trailGhostDrawX = clientX
  trailGhostDrawY = clientY
}

function armPointer(clientX: number, clientY: number) {
  syncPointer(clientX, clientY)
  pointerInitialized.value = true
  mouseOnScreen.value = true
}

function handlePointerMove(event: PointerEvent) {
  if (!enabled.value) return
  if (!pointerInitialized.value) {
    armPointer(event.clientX, event.clientY)
    ensureTicking()
    return
  }
  mouseOnScreen.value = true
  targetX.value = event.clientX
  targetY.value = event.clientY
  ensureTicking()
}

function handlePointerEnter(event: PointerEvent) {
  if (!enabled.value || pointerInitialized.value) return
  armPointer(event.clientX, event.clientY)
  ensureTicking()
}

function handleMouseEnter(event: MouseEvent) {
  armPointer(event.clientX, event.clientY)
  ensureTicking()
}

function handleMouseLeave() {
  mouseOnScreen.value = false
  pointerInitialized.value = false
  ensureTicking()
}

function handleWindowBlur() {
  mouseOnScreen.value = false
  pointerInitialized.value = false
  ensureTicking()
}

function handleScroll() {
  clearTrail()
}

function handleResize() {
  const canvas = canvasEl.value
  if (canvas) setCanvasSize(canvas)
  clearTrail()
}

onMounted(() => {
  if (!enabled.value) return

  const canvas = canvasEl.value
  if (canvas) {
    setCanvasSize(canvas)
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(document.documentElement)
  }

  document.documentElement.addEventListener('mouseenter', handleMouseEnter)
  document.documentElement.addEventListener('mouseleave', handleMouseLeave)
  document.documentElement.addEventListener('pointerenter', handlePointerEnter)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('click', handleClick, { passive: true })
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
  window.addEventListener('resize', handleResize, { passive: true })
})

onUnmounted(() => {
  if (frame) cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  document.documentElement.removeEventListener('mouseenter', handleMouseEnter)
  document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
  document.documentElement.removeEventListener('pointerenter', handlePointerEnter)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('click', handleClick)
  window.removeEventListener('blur', handleWindowBlur)
  window.removeEventListener('scroll', handleScroll, { capture: true })
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.mouse-grid-canvas {
  pointer-events: none;
}
</style>
