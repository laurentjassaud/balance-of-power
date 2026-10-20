<script setup lang="ts">
// One small multiple of a country's history: a year axis, one value axis, lines or bars around zero.
// Lines are 2px with an 8px end dot ringed in the surface colour; bars are at most 8px wide, rounded at their
// end and square on the axis, 2px apart; gridlines are hairlines a step off the surface. Hovering (or the arrow
// keys) snaps a crosshair to the nearest year and lists every series for it.
import { computed, ref } from 'vue'

export interface Line { label: string; color: string; values: (number | null)[] }
/** One superpower's bars: up for what supports the government, down for what fights it. */
export interface BarSide { color: string; up: (number | null)[]; down: (number | null)[] }
export interface TipRow { color: string; label: string; value: string }

const props = defineProps<{
  title: string
  years: number[]
  domain: [number, number]
  ticks: number[]
  lines?: Line[]
  bars?: BarSide[]
  /** Years of a major event, marked by a hairline across the plot. */
  events?: boolean[]
  eventLabel?: string
  tip: (i: number) => TipRow[]
  tickLabel?: (v: number) => string
}>()

const VW = 220, VH = 124, L = 26, R = 6, T = 8, B = 18
const plotW = VW - L - R, plotH = VH - T - B
const slot = computed(() => plotW / props.years.length)
const cx = (i: number) => L + slot.value * (i + 0.5)
const y = (v: number) => T + ((props.domain[1] - v) * plotH) / (props.domain[1] - props.domain[0] || 1)
const y0 = computed(() => y(Math.max(props.domain[0], Math.min(props.domain[1], 0))))
const last = computed(() => {
  const all = [...(props.lines ?? []).map((l) => l.values), ...(props.bars ?? []).flatMap((b) => [b.up, b.down])]
  let n = -1
  for (const vs of all) vs.forEach((v, i) => { if (v !== null && i > n) n = i })
  return n
})

function linePath(vs: (number | null)[]): string {
  let d = '', pen = false
  vs.forEach((v, i) => {
    if (v === null) { pen = false; return }
    d += `${pen ? 'L' : 'M'}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`
    pen = true
  })
  return d
}
/** A bar from the axis to v (up) or -v (down): rounded at its end, square on the axis. */
function barPath(x: number, w: number, v: number, down: boolean): string {
  if (!v) return ''
  const yEnd = y(down ? -v : v), base = y0.value, r = Math.min(3, w / 2, Math.abs(base - yEnd))
  const s = down ? 1 : -1 // direction from the axis to the end
  return `M${x} ${base}V${yEnd - s * r}Q${x} ${yEnd} ${x + r} ${yEnd}H${x + w - r}Q${x + w} ${yEnd} ${x + w} ${yEnd - s * r}V${base}Z`
}
const bw = computed(() => Math.min(8, (slot.value - 6) / 2))
const barX = (i: number, side: number) => (side === 0 ? cx(i) - bw.value - 1 : cx(i) + 1)

// Hover and keyboard: the crosshair finds the year.
const svg = ref<SVGSVGElement>()
const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const r = svg.value!.getBoundingClientRect()
  const px = ((e.clientX - r.left) * VW) / r.width
  hover.value = Math.max(0, Math.min(props.years.length - 1, Math.floor((px - L) / slot.value)))
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const i = hover.value ?? Math.max(0, last.value)
  hover.value = Math.max(0, Math.min(props.years.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))
}
const tipRows = computed(() => (hover.value === null ? [] : props.tip(hover.value)))
const tipLeft = computed(() => (hover.value === null ? 0 : (cx(hover.value) / VW) * 100))
</script>

<template>
  <figure class="chart">
    <figcaption class="label">{{ title }}</figcaption>
    <div class="plot">
      <svg ref="svg" :viewBox="`0 0 ${VW} ${VH}`" role="img" :aria-label="title" tabindex="0"
        @pointermove="onMove" @pointerleave="hover = null" @focus="hover = Math.max(0, last)" @blur="hover = null" @keydown="onKey">
        <g class="grid">
          <line v-for="t in ticks" :key="t" :x1="L" :x2="VW - R" :y1="y(t)" :y2="y(t)" :class="{ zero: t === 0 && domain[0] < 0 }" />
          <text v-for="t in ticks" :key="`t${t}`" :x="L - 4" :y="y(t)" text-anchor="end" dominant-baseline="middle">{{ tickLabel ? tickLabel(t) : t.toLocaleString('fr-FR') }}</text>
          <text v-for="(yr, i) in years" v-show="i % 2 === 0" :key="yr" :x="cx(i)" :y="VH - 4" text-anchor="middle">{{ String(yr).slice(2) }}</text>
        </g>
        <g class="events">
          <line v-for="(ev, i) in events ?? []" v-show="ev" :key="i" :x1="cx(i)" :x2="cx(i)" :y1="T" :y2="T + plotH" />
        </g>
        <g v-for="(b, s) in bars ?? []" :key="`b${s}`" :fill="b.color">
          <template v-for="(_, i) in years" :key="i">
            <path v-if="b.up[i]" :d="barPath(barX(i, s), bw, b.up[i]!, false)" />
            <path v-if="b.down[i]" :d="barPath(barX(i, s), bw, b.down[i]!, true)" />
          </template>
        </g>
        <g v-for="(l, s) in lines ?? []" :key="`l${s}`">
          <path class="line" :d="linePath(l.values)" :stroke="l.color" />
          <template v-for="(v, i) in l.values" :key="i">
            <circle v-if="v !== null && i === last" class="dot" :cx="cx(i)" :cy="y(v)" r="4" :fill="l.color" />
          </template>
        </g>
        <line v-if="hover !== null" class="cross" :x1="cx(hover)" :x2="cx(hover)" :y1="T" :y2="T + plotH" />
      </svg>
      <div v-if="hover !== null" class="tip" :class="{ flip: tipLeft > 55 }" :style="{ left: `${tipLeft}%` }" role="status">
        <p class="year">{{ years[hover] }}</p>
        <p v-if="!tipRows.length" class="empty">pas encore joué</p>
        <p v-for="r in tipRows" :key="r.label" class="row"><i :style="{ background: r.color }"></i><b>{{ r.value }}</b><span>{{ r.label }}</span></p>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.chart { margin: 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.plot { position: relative; }
svg { display: block; width: 100%; height: auto; overflow: visible; outline: none; touch-action: none; }
svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.grid line { stroke: #c4c7ca; stroke-width: 1; }
.grid line.zero { stroke: #747679; }
.grid text { font: 8.5px var(--font-data); fill: var(--muted); font-variant-numeric: tabular-nums; }
.events line { stroke: #747679; stroke-width: 1; }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.dot { stroke: var(--paper); stroke-width: 2; }
.cross { stroke: var(--ink); stroke-width: 1; }
/* Values lead, labels follow; a short line keys each series. */
/* Same look as the map's tooltip, so the rival's black key stays visible. */
.tip {
  position: absolute; top: 0; transform: translateX(8px); z-index: 1; pointer-events: none; min-width: 120px;
  background: var(--paper); color: var(--ink); border: 1px solid var(--ink); padding: 6px 8px; font: 10.5px/1.35 var(--font-data);
  box-shadow: 0 6px 18px rgb(20 22 24 / 0.18);
}
.tip.flip { transform: translateX(calc(-100% - 8px)); }
.tip p { margin: 0; }
.year { color: var(--muted); margin-bottom: 2px !important; }
.row { display: grid; grid-template-columns: 10px auto 1fr; gap: 6px; align-items: center; white-space: nowrap; }
.row i { width: 10px; height: 2px; }
.row b { font-weight: 600; }
.row span { color: var(--muted); }
.empty { color: var(--muted); }
</style>
