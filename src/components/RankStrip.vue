<script setup lang="ts">
// Ranking strip after the atlas: every country, from the lowest to the highest value of the current map mode.
// Each name is linked by a thin line to its place on the scale; a click opens the country's file.
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
  const cat = CATEGORICAL.has(m)
  let ticks: { x: number; t: string; anchor: string }[] = []
  let segs: { x: number; w: number; color: string; t: string; dy: number; tx: number; anchor: string }[] = []
  let xOf: (n: number, r: number) => number = (_n, r) => slotX(r)
  if (cat) {
    // One coloured segment per class, as wide as the countries it holds.
    let i0 = 0, lab = 0
    colors.forEach((color, k) => {
      const cnt = rows.filter((r) => r.k === k).length
      if (!cnt) return
      const a = Math.max(0, slotX(i0) - 4), b = Math.min(W, slotX(i0 + cnt - 1) + 4)
      // Labels in the right third are aligned on the segment's end so they stay inside the strip.
      const end = a > W * 0.66
      segs.push({ x: a, w: b - a, color, t: `${store.legend.labels[k].toUpperCase()} · ${cnt}`, dy: (lab++ % 2) * 12, tx: end ? b : a, anchor: end ? 'end' : 'start' })
      i0 += cnt
    })
  } else {
    // Piecewise scale: each colour class gets an equal share of the axis.
    // Policy levels always run 0..5, so their scale stays the same from year to year.
    // Background figures run from their lowest to their highest value.
    const cuts = store.cuts, policy = m.startsWith('policy:'), bg = !!store.bgInd
    const first = rows[0]?.n ?? 0, last = rows[rows.length - 1]?.n ?? 0
    const lo = policy ? 0 : bg ? first : Math.min(first, cuts[0] - 1)
    const hi = policy ? 5 : bg ? last : Math.max(last, cuts[cuts.length - 1] + 1)
    const dom = [lo, ...cuts, hi]
    const step = W / (dom.length - 1)
    xOf = (n) => {
      let i = 0
      while (i < dom.length - 2 && n >= dom[i + 1]) i++
      const t = (n - dom[i]) / (dom[i + 1] - dom[i] || 1)
      return Math.max(IN, Math.min(W - IN, (i + Math.max(0, Math.min(1, t))) * step))
    }
    ticks = dom.map((d, i) => ({ x: Math.max(0.5, Math.min(W - 0.5, i * step)), t: store.fmtTick(d), anchor: i === 0 ? 'start' : i === dom.length - 1 ? 'end' : 'middle' }))
    segs = colors.map((color, k) => ({ x: k * step, w: step, color, t: '', dy: 0, tx: 0, anchor: 'start' }))
  }
  const items = rows.map((r, i) => ({ ...r, x: slotX(i), vx: xOf(r.n, i), color: store.fill(r.c) }))
  return { W, items, ticks, segs, cat, title: store.legend.title }
})

function pick(c: number) {
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
        <template v-if="strip.cat">
          <text v-for="(s, i) in strip.segs" :key="`t${i}`" :x="s.tx" :y="AXIS_Y + 20 + s.dy" :text-anchor="s.anchor" class="tk">{{ s.t }}</text>
        </template>
        <g v-for="(t, i) in strip.ticks" v-else :key="`k${i}`">
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
