<script setup lang="ts">
// Pixel map after the Atlas Balance of Power 2026: each country is a block of grid squares,
// labelled with its name and a black tag holding its value in the current map mode.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import G from '../mapGrid.json'

const store = useGameStore()
const COLS = G.cols, ROWS = G.rows, RATIO = `${COLS} / ${ROWS}`
const anchor = G.anchor as unknown as Record<string, [number, number, number]>

// Decode the run-length grid: one country id per cell, -1 for sea.
const grid = new Int16Array(COLS * ROWS)
for (let i = 0, s = 0; i < G.rle.length; i += 2) { grid.fill(G.rle[i], s, s + G.rle[i + 1]); s += G.rle[i + 1] }
const cellsOf: Record<number, number[]> = {}
grid.forEach((k, s) => { if (k >= 0) (cellsOf[k] ??= []).push(s) })
// Faint "continental shelf" two cells wide around land.
const halo = new Uint8Array(COLS * ROWS)
for (let s = 0; s < grid.length; s++) if (grid[s] >= 0) {
  const x = s % COLS, y = (s / COLS) | 0
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) halo[ny * COLS + nx] = 1
  }
}

const box = ref<HTMLDivElement>()
const wrap = ref<HTMLDivElement>()
const cv = ref<HTMLCanvasElement>()
const tip = ref<{ x: number; y: number; name: string; v: string } | null>(null)
let W = 0, H = 0, cs = 1, dpr = 1
/** View transform: zoom factor and offset in CSS pixels. */
const T = { k: 1, x: 0, y: 0 }
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

// The map is drawn at the largest size that fits the box both ways, keeping the grid's proportions.
function resize() {
  const b = box.value, el = wrap.value, c = cv.value
  if (!b || !el || !c) return
  W = Math.floor(Math.min(b.clientWidth, b.clientHeight * COLS / ROWS)); H = Math.round(W * ROWS / COLS); cs = W / COLS
  dpr = window.devicePixelRatio || 1
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
  el.style.width = `${W}px`; el.style.height = `${H}px`
  clamp(); draw()
}

function clamp() {
  T.k = Math.max(1, Math.min(10, T.k))
  T.x = Math.min(0, Math.max(W - W * T.k, T.x))
  T.y = Math.min(0, Math.max(H - H * T.k, T.y))
}

function draw() {
  const c = cv.value, w = store.w
  if (!c || !w) return
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, W, H)
  ctx.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.x, dpr * T.y)
  const g = cs * 0.1, sq = cs - 2 * g
  ctx.fillStyle = css('--halo')
  for (let s = 0; s < halo.length; s++) if (halo[s] && grid[s] < 0) ctx.fillRect((s % COLS) * cs + g, ((s / COLS) | 0) * cs + g, sq, sq)
  for (const [id, cells] of Object.entries(cellsOf)) {
    ctx.fillStyle = store.fill(+id)
    for (const s of cells) ctx.fillRect((s % COLS) * cs + g, ((s / COLS) | 0) * cs + g, sq, sq)
  }
  // Corner brackets around countries too small to see.
  ctx.strokeStyle = css('--tag'); ctx.lineWidth = 1 / T.k
  for (const [, [x, y, n]] of Object.entries(anchor)) {
    if (n > 3) continue
    const X = x * cs - cs * 0.9, Y = y * cs - cs * 0.9, S = cs * 2.8, t = cs * 0.7
    ctx.beginPath()
    ctx.moveTo(X, Y + t); ctx.lineTo(X, Y); ctx.lineTo(X + t, Y); ctx.moveTo(X + S - t, Y); ctx.lineTo(X + S, Y); ctx.lineTo(X + S, Y + t)
    ctx.moveTo(X + S, Y + S - t); ctx.lineTo(X + S, Y + S); ctx.lineTo(X + S - t, Y + S); ctx.moveTo(X + t, Y + S); ctx.lineTo(X, Y + S); ctx.lineTo(X, Y + S - t)
    ctx.stroke()
  }
  // White outline around the selected country.
  const sel = store.selected
  if (sel && cellsOf[sel]) {
    ctx.strokeStyle = css('--paper'); ctx.lineWidth = 2.2 / T.k; ctx.beginPath()
    for (const s of cellsOf[sel]) {
      const x = s % COLS, y = (s / COLS) | 0, X = x * cs, Y = y * cs
      if (y === 0 || grid[s - COLS] !== sel) { ctx.moveTo(X, Y); ctx.lineTo(X + cs, Y) }
      if (y === ROWS - 1 || grid[s + COLS] !== sel) { ctx.moveTo(X, Y + cs); ctx.lineTo(X + cs, Y + cs) }
      if (x === 0 || grid[s - 1] !== sel) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cs) }
      if (x === COLS - 1 || grid[s + 1] !== sel) { ctx.moveTo(X + cs, Y); ctx.lineTo(X + cs, Y + cs) }
    }
    ctx.stroke()
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawLabels(ctx)
}

/** Name plus value tag, biggest countries first, skipping any label that would overlap one already drawn. */
function drawLabels(ctx: CanvasRenderingContext2D) {
  const w = store.w!, sel = store.selected
  const minCells = (40 / (T.k * T.k)) * (W < 700 ? 3 : 1)
  const fs = W < 700 ? 8.5 : 10, mono = css('--font-data')
  const boxes: number[][] = []
  const order = Object.keys(anchor).map(Number)
    .filter((i) => anchor[i][2] >= minCells || i === sel)
    .sort((a, b) => +(b === sel) - +(a === sel) || anchor[b][2] - anchor[a][2])
  ctx.save()
  ctx.textBaseline = 'middle'
  // Round joins on the names' halo: the default mitre sticks out in spikes at the letters' sharp corners.
  ctx.lineJoin = 'round'
  for (const i of order) {
    const [x, y] = anchor[i], sx = T.x + (x + 0.5) * cs * T.k, sy = T.y + (y + 0.5) * cs * T.k
    if (sx < 0 || sy < 0 || sx > W || sy > H) continue
    const name = w.names[i], val = store.classify(i).v
    ctx.font = `500 ${fs}px ${mono}`; const nw = ctx.measureText(name).width
    ctx.font = `500 ${fs - 1}px ${mono}`; const vw = val ? ctx.measureText(val).width + 6 : 0
    const bw = 8 + nw + 4 + vw, bh = fs * 1.5, by = sy - fs * 0.75
    // Labels that would run off the right edge are written to the left of their marker.
    const left = sx + bw > W, bx = left ? sx + 4 - bw : sx - 4, tx = left ? bx : sx + 6
    if (boxes.some((b) => bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1])) continue
    boxes.push([bx, by, bw, bh])
    ctx.fillStyle = css('--tag'); ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5)
    ctx.font = `500 ${fs}px ${mono}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(196,199,202,.75)'
    ctx.strokeText(name, tx, sy + 0.5)
    ctx.fillStyle = css('--tag'); ctx.fillText(name, tx, sy + 0.5)
    if (!val) continue
    ctx.fillRect(tx + 4 + nw, sy - fs * 0.65, vw, fs * 1.3)
    ctx.font = `500 ${fs - 1}px ${mono}`; ctx.fillStyle = i === sel ? css('--accent') : css('--paper')
    ctx.fillText(val, tx + 7 + nw, sy + 0.5)
  }
  ctx.restore()
}

/** Country under a point of the canvas, or 0 for sea. */
function hit(e: MouseEvent) {
  const r = cv.value!.getBoundingClientRect()
  const gx = Math.floor((e.clientX - r.left - T.x) / T.k / cs), gy = Math.floor((e.clientY - r.top - T.y) / T.k / cs)
  if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return 0
  return Math.max(0, grid[gy * COLS + gx])
}

// Drag to pan, wheel or buttons to zoom, click to open a country, click the sea to deselect.
let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null
function down(e: PointerEvent) { drag = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y, moved: false } }
function move(e: PointerEvent) {
  if (drag && (drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4)) {
    drag.moved = true; tip.value = null
    T.x = drag.tx + e.clientX - drag.x; T.y = drag.ty + e.clientY - drag.y; clamp(); draw(); return
  }
  const c = hit(e), r = wrap.value!.getBoundingClientRect()
  tip.value = c && store.w ? { x: Math.min(e.clientX - r.left, W - 190), y: e.clientY - r.top, name: store.w.names[c], v: store.classify(c).v } : null
}
function up(e: PointerEvent) {
  // A click on the selected country, or off the countries, clears the selection.
  if (drag && !drag.moved) { const c = hit(e); if (c && c !== store.selected) { store.selected = c; store.tab = 'country' } else store.selected = 0 }
  drag = null
}
function zoomAt(f: number, px = W / 2, py = H / 2) {
  const k = Math.max(1, Math.min(10, T.k * f)); f = k / T.k
  T.x = px - (px - T.x) * f; T.y = py - (py - T.y) * f; T.k = k; clamp(); draw()
}
function wheel(e: WheelEvent) {
  const r = cv.value!.getBoundingClientRect()
  zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top)
}
function reset() { T.k = 1; T.x = 0; T.y = 0; draw() }

let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(resize); ro.observe(box.value!)
  resize()
  document.fonts?.ready.then(draw)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => [store.version, store.mapMode, store.selected], () => draw())
</script>

<template>
  <div ref="box" class="map" :data-rev="store.version">
    <div ref="wrap" class="frame">
      <canvas ref="cv" role="img" aria-label="Carte du monde. Cliquez sur un pays pour ouvrir son dossier." :class="{ link: tip }"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointerleave="tip = null; drag = null" @wheel.prevent="wheel"></canvas>
      <div class="zoom">
        <button aria-label="Zoomer" @click="zoomAt(1.6)">+</button>
        <button aria-label="Dézoomer" @click="zoomAt(1 / 1.6)">−</button>
        <button aria-label="Vue entière" @click="reset">⤢</button>
      </div>
      <div v-if="tip" class="tip" :style="{ left: `${tip.x + 14}px`, top: `${tip.y + 10}px` }">
        <b>{{ tip.name }}</b><span v-if="tip.v">{{ tip.v }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The box keeps the grid's proportions unless the layout gives it a height; the map sits in its top-left corner. */
.map { position: relative; aspect-ratio: v-bind(RATIO); }
.frame { position: absolute; left: 0; top: 0; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; }
/* The tooltip shows exactly while the pointer is over a country, which a click opens. */
canvas.link { cursor: pointer; }
/* Bottom-right is open sea; bottom-left holds the Levant inset. */
.zoom { position: absolute; right: 0; bottom: 0; display: flex; gap: 2px; }
.zoom button { width: 28px; height: 28px; padding: 0; background: var(--tag); color: var(--paper); border-color: var(--tag); font-size: 14px; }
.zoom button:hover { color: var(--accent); background: var(--tag); }
.tip { position: absolute; pointer-events: none; display: flex; gap: 6px; align-items: center; font: 500 11px var(--font-data);
  background: var(--paper); border: 1px solid var(--ink); padding: 3px 6px; white-space: nowrap; }
.tip span { background: var(--tag); color: var(--paper); padding: 0 4px; }
</style>
