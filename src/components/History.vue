<script setup lang="ts">
// A country's history (Briefing › History in the original, DoHistory): small multiples of its figures year by
// year, the superpowers side by side. Shown by level as in the original: the left column and the bottom row
// always, popularity and economic pressure from level 2, finlandization and treaties from level 3.
// The table view gives every value without hovering.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { FIRST_YEAR, USA, Verb, type HistoryYear } from '../engine/core'
import { LAST_YEAR } from '../engine/game'
import { levelLabel } from '../engine/news'
import FloatWindow from './FloatWindow.vue'
import HistoryChart, { type BarSide, type Line, type TipRow } from './HistoryChart.vue'

const store = useGameStore()
const country = ref(store.history)
watch(() => store.history, (c) => { if (c) country.value = c })
watch(() => store.selected, (s) => { if (s && store.history) store.history = s })

const ORANGE = '#fe7c2c', BLACK = '#1a1c1d', NEUTRAL = '#4c4c4e'
const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
const name = (sp: number) => (sp === USA ? 'États-Unis' : 'URSS')
const capital = (sp: number) => (sp === USA ? 'Washington' : 'Moscou')
const color = (sp: number) => (sp === store.me ? ORANGE : BLACK)
const sides = computed(() => [store.me, store.rival])

/** The years played, plus the year under way as it stands. */
const records = computed(() => {
  void store.version
  const w = store.w
  if (!w) return new Map<number, HistoryYear>()
  const out = new Map(w.history.filter((h) => h.year >= FIRST_YEAR).map((h) => [h.year, h]))
  out.set(w.year, w.yearRecord())
  return out
})
const series = (get: (h: HistoryYear) => number) => years.map((y) => { const h = records.value.get(y); return h ? get(h) : null })
const flags = (get: (h: HistoryYear) => boolean) => years.map((y) => !!records.value.get(y) && get(records.value.get(y)!))
/** A round top for a value axis starting at 0. */
const niceMax = (v: number) => {
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, v)))
  return ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= v) ?? 10 * mag)
}

interface Chart {
  id: string; title: string; minLevel: number; domain: [number, number]; ticks: number[]
  lines?: Line[]; bars?: BarSide[]; events?: boolean[]; eventLabel?: string; tickLabel?: (v: number) => string
  tip: (i: number) => TipRow[]
  /** Rows of the table view. */
  table: { label: string; values: (string | null)[] }[]
}

const charts = computed<Chart[]>(() => {
  const w = store.w
  if (!w) return []
  const c = country.value
  const at = (i: number) => records.value.get(years[i])
  // Bars: per superpower, up what helps the government (verb up), down what fights it (verb down).
  const policy = (id: string, title: string, minLevel: number, up: keyof HistoryYear, upVerb: Verb, upName: string, down: keyof HistoryYear, downVerb: Verb, downName: string): Chart => {
    const get = (key: keyof HistoryYear, sp: number) => series((h) => (h[key] as number[][])[sp][c])
    const bars = sides.value.map((sp) => ({ color: color(sp), up: get(up, sp), down: get(down, sp) }))
    return {
      id, title, minLevel, domain: [-5, 5], ticks: [-5, 0, 5], bars, tickLabel: (v) => String(Math.abs(v)),
      tip: (i) => (at(i) ? sides.value.flatMap((sp, s) => [
        { color: color(sp), label: `${capital(sp)} · ${upName}`, value: levelLabel(upVerb, bars[s].up[i] ?? 0) },
        { color: color(sp), label: `${capital(sp)} · ${downName}`, value: levelLabel(downVerb, bars[s].down[i] ?? 0) },
      ]) : []),
      table: sides.value.flatMap((sp, s) => [
        { label: `${title} · ${capital(sp)} · ${upName}`, values: bars[s].up.map((v) => (v === null ? null : levelLabel(upVerb, v))) },
        { label: `${title} · ${capital(sp)} · ${downName}`, values: bars[s].down.map((v) => (v === null ? null : levelLabel(downVerb, v))) },
      ]),
    }
  }
  const single = (id: string, title: string, minLevel: number, values: (number | null)[], top: number, extra?: (i: number) => TipRow[], events?: boolean[], eventLabel?: string): Chart => ({
    id, title, minLevel, domain: [0, top], ticks: [0, top / 2, top], lines: [{ label: title, color: NEUTRAL, values }], events, eventLabel,
    tip: (i) => (values[i] === null ? [] : [{ color: NEUTRAL, label: title, value: String(values[i]) }, ...(extra?.(i) ?? []), ...(events?.[i] ? [{ color: '#747679', label: 'événement', value: eventLabel! }] : [])]),
    table: [{ label: title, values: values.map((v, i) => (v === null ? null : `${v}${events?.[i] ? ` · ${eventLabel}` : ''}`)) }],
  })
  const pair = (id: string, title: string, minLevel: number, get: (h: HistoryYear, sp: number) => number, domain: [number, number], ticks: number[], who: (sp: number) => string, events?: boolean[], eventLabel?: string): Chart => {
    const lines = sides.value.map((sp) => ({ label: who(sp), color: color(sp), values: series((h) => get(h, sp)) }))
    const signed = domain[0] < 0
    const show = (v: number) => (signed && v > 0 ? `+${v}` : String(v))
    return {
      id, title, minLevel, domain, ticks, lines, events, eventLabel,
      tip: (i) => (at(i) ? [...lines.map((l) => ({ color: l.color, label: l.label, value: show(l.values[i] ?? 0) })), ...(events?.[i] ? [{ color: '#747679', label: 'événement', value: eventLabel! }] : [])] : []),
      table: lines.map((l) => ({ label: `${title} · ${l.label}`, values: l.values.map((v) => (v === null ? null : show(v))) })),
    }
  }

  const insurgency = series((h) => h.sqrtStrg[c])
  const popularity = series((h) => h.gPopular[c])
  const pressure = series((h) => h.miltPress[c])
  const finlTop = niceMax(Math.max(128, ...series((h) => Math.max(h.finlProb[1][c], h.finlProb[2][c])).map((v) => v ?? 0)))
  const list: Chart[] = [
    single('insurgency', 'Force de l’insurrection', 1, insurgency, 80,
      (i) => { const h = at(i); return h ? [{ color: NEUTRAL, label: 'au pouvoir', value: h.leftPowr[c] ? 'la gauche' : 'la droite' }] : [] },
      flags((h) => h.rebWinFlag[c]), 'révolution'),
    single('popularity', 'Popularité du gouvernement', 2, popularity, niceMax(Math.max(20, ...popularity.map((v) => v ?? 0))), undefined, flags((h) => h.coupFlag[c]), 'coup d’État'),
    pair('finl', 'Finlandisation', 3, (h, sp) => h.finlProb[sp][c], [0, finlTop], [0, finlTop / 2, finlTop], (sp) => `vers ${capital(sp)}`, flags((h) => h.finlFlag[c]), 'finlandisation'),
    policy('arms', 'Armement', 1, 'miltAid', Verb.MilAid, 'au gouvernement', 'insgAid', Verb.InsgAid, 'aux rebelles'),
    policy('econ', 'Aide et déstabilisation', 2, 'econAid', Verb.Econ, 'aide économique', 'destab', Verb.Destab, 'déstabilisation'),
    policy('treaty', 'Traités et pression', 3, 'treaty', Verb.Treaty, 'traité', 'pressure', Verb.Pressure, 'pression'),
    policy('troops', 'Interventions', 1, 'intvGovt', Verb.IntvGovt, 'pour le gouvernement', 'intvRebl', Verb.IntvRebl, 'pour les rebelles'),
    pair('relations', 'Relations', 1, (h, sp) => h.dipAff[sp][c], [-127, 127], [-100, 0, 100], (sp) => `avec ${capital(sp)}`),
    single('pressure', 'Pression militaire', 1, pressure, niceMax(Math.max(10, ...pressure.map((v) => v ?? 0)))),
  ]
  return list.filter((ch) => w.level >= ch.minLevel)
})

const played = computed(() => years.filter((y) => records.value.has(y)))
const tableView = ref(false)

// Table view: the mouse in the left or right fifth scrolls the years that way, faster nearer the edge;
// in the middle or off the table, nothing moves.
const wrap = ref<HTMLDivElement>()
const EDGE = 0.2, MAX_SPEED = 0.6 // px per ms at the very edge
let speed = 0, frame = 0, last = 0, rest = 0
function edgeScroll(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !wrap.value) return
  const r = wrap.value.getBoundingClientRect()
  const t = (e.clientX - r.left) / r.width
  const d = t < EDGE ? -(1 - t / EDGE) : t > 1 - EDGE ? (t - 1 + EDGE) / EDGE : 0
  speed = Math.sign(d) * d * d * MAX_SPEED
  if (speed && !frame) { last = performance.now(); frame = requestAnimationFrame(step) }
}
function step(now: number) {
  const el = wrap.value
  if (!el || !speed) { frame = 0; rest = 0; return }
  // Whole pixels only, the remainder carried over, so a slow drift still moves.
  rest += speed * (now - last)
  last = now
  const px = Math.trunc(rest)
  if (px) { el.scrollLeft += px; rest -= px }
  frame = requestAnimationFrame(step)
}
const stopScroll = () => { speed = 0 }
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <FloatWindow v-if="store.w" id="history" label="Historique" :width="720" labelledby="history-name" @close="store.history = 0">
    <template #tools>
      <button class="view" :aria-pressed="tableView" @click="tableView = !tableView">{{ tableView ? 'Graphiques' : 'Tableau' }}</button>
    </template>
    <template #head>
      <div class="mast">
        <h2 id="history-name">{{ store.w.names[country] }}</h2>
        <p class="label sub">Historique · {{ played[0] }} – {{ played[played.length - 1] }}</p>
        <div class="key">
          <span v-for="sp in sides" :key="sp"><i :style="{ background: color(sp) }"></i>{{ name(sp) }}</span>
          <span class="note">Barres : au-dessus de l’axe, ce qui soutient le gouvernement ; en dessous, ce qui le combat.</span>
        </div>
      </div>
    </template>
    <div v-if="!tableView" :key="country" class="grid">
      <HistoryChart v-for="(ch, i) in charts" :key="ch.id" class="rise" :style="{ '--i': i }" :title="ch.title" :years="years"
        :domain="ch.domain" :ticks="ch.ticks" :lines="ch.lines" :bars="ch.bars" :events="ch.events" :event-label="ch.eventLabel"
        :tip="ch.tip" :tick-label="ch.tickLabel" />
    </div>
    <div v-else ref="wrap" class="table-wrap" @pointermove="edgeScroll" @pointerleave="stopScroll">
      <table>
        <thead><tr><th scope="col">Série</th><th v-for="y in years" :key="y" scope="col">{{ y }}</th></tr></thead>
        <tbody>
          <template v-for="ch in charts" :key="ch.id">
            <tr v-for="row in ch.table" :key="row.label"><th scope="row">{{ row.label }}</th><td v-for="(v, i) in row.values" :key="i">{{ v ?? '—' }}</td></tr>
          </template>
        </tbody>
      </table>
    </div>
  </FloatWindow>
</template>

<style scoped>
.mast { border-top: 1px solid var(--ink); border-bottom: 3px double var(--ink); padding: 10px 0 8px; display: flex; flex-direction: column; gap: 6px; }
.mast h2 { font: 700 26px/1 var(--font-display); letter-spacing: -0.01em; }
.sub { margin: 0; color: var(--muted); }
.key { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; font: 11px var(--font-data); }
.key i { display: inline-block; width: 14px; height: 2px; margin-right: 6px; vertical-align: middle; }
.note { color: var(--muted); }
.view { padding: 3px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px 22px; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; font: 10.5px/1.35 var(--font-data); white-space: nowrap; }
th, td { padding: 4px 8px; border-bottom: 1px dotted var(--ink); text-align: right; font-variant-numeric: tabular-nums; }
th[scope='row'], thead th:first-child { text-align: left; font-weight: 500; position: sticky; left: 0; background: var(--paper); }
thead th { color: var(--muted); font-weight: 500; }
.rise { animation: rise 300ms var(--ease-out) both; animation-delay: calc(var(--i) * 35ms); }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
</style>
