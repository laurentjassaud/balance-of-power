<script setup lang="ts">
// Ranking strip after the atlas: every country, from the lowest to the highest value of the current map mode.
// Each name is linked by a thin line to its place on the scale; a click opens the country's file, a second one clears the selection.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore, CATEGORICAL } from '../stores/game'
import { USA, USSR } from '../engine/core'

const store = useGameStore()
const box = ref<HTMLDivElement>()
const boxW = ref(800)
// The scale runs edge to edge; country markers sit 5 px in so their 6 px square and rotated name stay inside.
const IN = 5, NAME_H = 112, AXIS_Y = NAME_H + 62, H = AXIS_Y + 40

const strip = computed(() => {
  const w = store.w
  // Maps of the selected country rank the others, once one is picked.
  if (!w || store.needsSel) return null
  void store.version
  const m = store.mapMode
  const centred = m.startsWith('sel:')
  const ids = store.countries.filter((c) => !(store.fixedSuper && (c === USA || c === USSR)) && !(centred && c === store.selected))
  const rows = ids.map((c) => ({ c, ...store.classify(c), name: w.names[c] }))
  rows.sort((a, b) => a.n - b.n || a.name.localeCompare(b.name, 'fr'))
  const W = Math.max(boxW.value, IN * 2 + rows.length * 8.4)
  const slotX = (r: number) => IN + (r * (W - 2 * IN)) / Math.max(1, rows.length - 1)
  const colors = store.legend.colors
  // Piecewise scale, the same for every mode: each colour class gets an equal share of the axis.
  const step = W / colors.length
  const edge = (i: number) => Math.max(0.5, Math.min(W - 0.5, i * step))
  // Support runs its classes the other way (the less popular, the hotter), so its shares take their colours in reverse.
  const byValue = m === 'support' ? [...colors].reverse() : colors
  const segs = byValue.map((color, i) => ({ x: i * step, w: step, color }))
  let ticks: { x: number; t: string; anchor: string }[]
  let names: { x: number; t: string }[] = []
  let xOf: (n: number, k: number) => number
  if (CATEGORICAL.has(m)) {
    // Classes that are categories, not ranges of a number: limits without figures, each class named under its
    // share, its countries meeting at its middle.
    ticks = Array.from({ length: colors.length + 1 }, (_, i) => ({ x: edge(i), t: '', anchor: 'middle' }))
    names = store.legend.labels.map((t, k) => ({ x: (k + 0.5) * step, t }))
    xOf = (_n, k) => (k + 0.5) * step
  } else {
    // Policy levels always run 0..5, so their scale stays the same from year to year.
    // Background figures run from their lowest to their highest value.
    const cuts = store.cuts, policy = m.startsWith('policy:'), bg = !!store.bgInd
    const first = rows[0]?.n ?? 0, last = rows[rows.length - 1]?.n ?? 0
    const lo = policy ? 0 : bg ? first : Math.min(first, cuts[0] - 1)
    const hi = policy ? 5 : bg ? last : Math.max(last, cuts[cuts.length - 1] + 1)
    const dom = [lo, ...cuts, hi]
    xOf = (n) => {
      let i = 0
      while (i < dom.length - 2 && n >= dom[i + 1]) i++
      const t = (n - dom[i]) / (dom[i + 1] - dom[i] || 1)
      return (i + Math.max(0, Math.min(1, t))) * step
    }
    ticks = dom.map((d, i) => ({ x: edge(i), t: store.fmtTick(d), anchor: i === 0 ? 'start' : i === dom.length - 1 ? 'end' : 'middle' }))
  }
  const items = rows.map((r, i) => ({ ...r, x: slotX(i), vx: Math.max(IN, Math.min(W - IN, xOf(r.n, r.k))), color: store.fill(r.c) }))
  return { W, items, ticks, names, segs, title: store.legend.title }
})

function pick(c: number) {
  // A second click on the selected country clears the selection.
  if (c === store.selected) { store.selected = 0; return }
  store.selected = c
  store.tab = 'country'
}

let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => { boxW.value = box.value?.clientWidth ?? 800 })
  ro.observe(box.value!)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <section v-if="strip" class="strip">
    <div class="head">
      <span class="label">Tous les pays, classés</span>
      <span class="cap">{{ strip.title }}, de la plus basse à la plus haute valeur. Chaque trait relie le pays à sa place sur l’échelle.</span>
    </div>
    <div ref="box" class="box">
      <svg :width="strip.W" :height="H" :viewBox="`0 0 ${strip.W} ${H}`" role="img" :aria-label="`Classement des pays : ${strip.title}`">
        <rect v-for="(s, i) in strip.segs" :key="`s${i}`" :x="s.x" :y="AXIS_Y - 3" :width="s.w" height="6" :fill="s.color" />
        <line :x1="0" :x2="strip.W" :y1="AXIS_Y" :y2="AXIS_Y" class="axis" />
        <text v-for="(s, i) in strip.names" :key="`n${i}`" :x="s.x" :y="AXIS_Y + 20" text-anchor="middle" class="tk">{{ s.t }}</text>
        <g v-for="(t, i) in strip.ticks" :key="`k${i}`">
          <line :x1="t.x" :x2="t.x" :y1="AXIS_Y - 6" :y2="AXIS_Y + 6" class="axis" />
          <text :x="t.x" :y="AXIS_Y + 20" :text-anchor="t.anchor" class="tk">{{ t.t }}</text>
        </g>
        <g v-for="it in strip.items" :key="it.c" class="st" :class="{ sel: it.c === store.selected }" @click="pick(it.c)">
          <title>{{ it.name }}{{ it.v ? ` · ${it.v}` : '' }}</title>
          <path :d="`M${it.x},${NAME_H + 10} L${it.x},${NAME_H + 16} L${it.vx},${AXIS_Y - 8} L${it.vx},${AXIS_Y}`" />
          <rect :x="it.x - 3" :y="NAME_H + 3" width="6" height="6" :fill="it.color" />
          <text :transform="`translate(${it.x + 3},${NAME_H}) rotate(-90)`">{{ it.name }}</text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.strip { min-width: 0; }
.head { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; margin-bottom: 6px; }
.cap { font: 10.5px var(--font-data); color: var(--muted); }
.box { overflow-x: auto; border-top: 1px solid var(--ink); }
svg { display: block; }
.axis { stroke: var(--ink); }
.tk { font: 9.5px var(--font-data); fill: var(--ink); }
.st { cursor: pointer; }
.st path { fill: none; stroke: var(--muted); stroke-width: 0.5; opacity: 0.8; }
.st text { font: 8.2px var(--font-data); fill: var(--ink); }
.st:hover text { font-weight: 700; }
.st.sel path { stroke: var(--paper); stroke-width: 1.6; opacity: 1; }
.st.sel text { fill: var(--paper); font-weight: 700; }
</style>
