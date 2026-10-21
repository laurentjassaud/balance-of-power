<script setup lang="ts">
// Debug mode, full view of the calculation journal: one sortable table per calculation (a row per country),
// a country's sheet (all its calculations of the year in the order of the turn), and exports to check the port.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { LOG_KINDS, varLabel, type LogEntry, type LogKind, type LogValue } from '../engine/debugLog'
import { download } from './download'

const store = useGameStore()
const view = ref<'table' | 'country'>('table')

const entries = computed<LogEntry[]>(() => {
  void store.version
  return store.w?.log?.entries.slice() ?? []
})
const name = (c: number) => (c ? store.w?.names[c] ?? `${c}` : 'Monde')

// ------------------------------------------------------------------ year

/** 0 = every year. Follows the year in play until another is picked. */
const year = ref(0)
const years = computed(() => [...new Set(entries.value.map((e) => e.year))].sort((a, b) => b - a))
let followYear = true
watch(years, (ys) => { if (followYear && ys.length) year.value = ys[0] }, { immediate: true })
function pickYear(y: number) {
  year.value = y
  followYear = y === years.value[0]
}
const ofYear = computed(() => entries.value.filter((e) => !year.value || e.year === year.value))

// ------------------------------------------------------------------ tables

/** Kinds, each with its steps, as the side list shows them. */
const tree = computed(() => {
  const by = new Map<LogKind, Map<string, number>>()
  for (const e of ofYear.value) {
    const steps = by.get(e.kind) ?? new Map<string, number>()
    steps.set(e.step, (steps.get(e.step) ?? 0) + 1)
    by.set(e.kind, steps)
  }
  return (Object.keys(LOG_KINDS) as LogKind[]).filter((k) => by.has(k))
    .map((k) => ({ kind: k, label: LOG_KINDS[k], steps: [...by.get(k)!].map(([step, count]) => ({ step, count })) }))
})
const pick = ref<{ kind: LogKind; step: string }>({ kind: 'popularite', step: 'Popularité' })
// The table on display stays if it still has rows, else the first one available.
watch(tree, (t) => {
  if (!t.some((k) => k.kind === pick.value.kind && k.steps.some((s) => s.step === pick.value.step)) && t.length) {
    pick.value = { kind: t[0].kind, step: t[0].steps[0].step }
  }
}, { immediate: true })

const filterText = ref('')
const rows = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  return ofYear.value.filter((e) => e.kind === pick.value.kind && e.step === pick.value.step &&
    (!q || `${name(e.country)} ${e.title} ${e.result}`.toLowerCase().includes(q)))
})
/** Variables of the table: every name its rows use, in the order they first appear. */
const columns = computed(() => {
  const seen = new Set<string>()
  for (const e of rows.value) for (const k of Object.keys(e.data)) seen.add(k)
  return [...seen]
})

const sort = ref<{ key: string; dir: 1 | -1 } | null>(null)
watch(pick, () => { sort.value = null; open.value = 0 }, { deep: true })
function sortBy(key: string) {
  sort.value = sort.value?.key === key ? (sort.value.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }
}
const cell = (e: LogEntry, key: string): LogValue | undefined =>
  key === '#country' ? name(e.country) : key === '#year' ? e.year : key === '#result' ? e.result : e.data[key]
function compare(a: LogValue | undefined, b: LogValue | undefined): number {
  if (a === undefined || a === '') return 1
  if (b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'fr', { numeric: true })
}
const sorted = computed(() => {
  const s = sort.value
  if (!s) return rows.value
  return rows.value.slice().sort((x, y) => {
    const a = cell(x, s.key), b = cell(y, s.key)
    // Empty cells stay last whatever the direction.
    if (a === undefined || a === '' || b === undefined || b === '') return compare(a, b)
    return s.dir * compare(a, b) || x.n - y.n
  })
})
const fmt = (v: LogValue | undefined) =>
  v === undefined ? '' : typeof v === 'boolean' ? (v ? '✓' : '') : typeof v === 'number' ? v.toLocaleString('fr-FR') : v
/** Row whose calculation is unfolded, by entry number. */
const open = ref(0)
const allYears = computed(() => !year.value)

// ------------------------------------------------------------------ country sheet

const country = ref(store.selected || 3)
watch(() => store.selected, (s) => { if (s) country.value = s })
const countryList = computed(() => {
  const w = store.w
  if (!w) return []
  return [0, ...Array.from({ length: w.names.length - 1 }, (_, i) => i + 1).sort((a, b) => w.names[a].localeCompare(w.names[b], 'fr'))]
})
function showCountry(c: number) {
  country.value = c
  view.value = 'country'
}
function step(d: number) {
  const list = countryList.value
  const i = list.indexOf(country.value)
  country.value = list[(i + d + list.length) % list.length]
}
const sheet = computed(() => ofYear.value.filter((e) => e.country === country.value))

// ------------------------------------------------------------------ exports

const csvCell = (v: LogValue | undefined) => {
  const s = v === undefined ? '' : typeof v === 'boolean' ? (v ? '1' : '0') : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (lines: (LogValue | undefined)[][]) => '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\n')
const yearTag = () => (year.value ? `${year.value}` : 'toutes-annees')
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()

/** The table on display, as it is sorted, with the variables' names as headers. */
function exportTable() {
  const head = ['year', 'n', 'country', 'country_name', 'result', ...columns.value]
  const body = sorted.value.map((e) => [e.year, e.n, e.country, name(e.country), e.result, ...columns.value.map((k) => e.data[k])])
  download(`logs-${slug(pick.value.step)}-${yearTag()}.csv`, csv([head, ...body]), 'text/csv')
}
/** Every value of the year (or game) in long form, one line per variable: easy to compare with another run. */
function exportLong() {
  const head = ['n', 'year', 'kind', 'step', 'country', 'country_name', 'variable', 'value']
  const body = ofYear.value.flatMap((e) => Object.entries(e.data).map(([k, v]) => [e.n, e.year, e.kind, e.step, e.country, name(e.country), k, v]))
  download(`logs-long-${yearTag()}.csv`, csv([head, ...body]), 'text/csv')
}
function exportJson() {
  const w = store.w
  const doc = { level: w?.level, human: w?.human, year: w?.year, entries: ofYear.value.map((e) => ({ ...e, countryName: name(e.country) })) }
  download(`logs-${yearTag()}.json`, JSON.stringify(doc, null, 1), 'application/json')
}

// ------------------------------------------------------------------ window

const root = ref<HTMLElement>()
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !store.game?.crisis && !document.querySelector('dialog[open]')) store.logsWindow = false
}
onMounted(() => { addEventListener('keydown', onKey); root.value?.focus() })
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<template>
  <section ref="root" class="lw" role="dialog" aria-modal="false" aria-labelledby="lw-title" tabindex="-1" :data-rev="store.version">
    <header>
      <h2 id="lw-title">Journal de calcul</h2>
      <select :value="year" aria-label="Année" @change="pickYear(+($event.target as HTMLSelectElement).value)">
        <option :value="0">Toutes les années</option>
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <div class="seg" role="tablist" aria-label="Vue">
        <button role="tab" :aria-selected="view === 'table'" @click="view = 'table'">Tableaux par type</button>
        <button role="tab" :aria-selected="view === 'country'" @click="view = 'country'">Fiche pays</button>
      </div>
      <div class="exports" aria-label="Exporter">
        <span class="label">Exporter</span>
        <button :disabled="view !== 'table' || !rows.length" title="Le tableau affiché, trié, avec les noms des variables en en-tête" @click="exportTable">CSV du tableau</button>
        <button :disabled="!ofYear.length" title="Toutes les valeurs, une ligne par variable : pour comparer avec une autre exécution" @click="exportLong">CSV long</button>
        <button :disabled="!ofYear.length" title="Toutes les entrées avec leur détail" @click="exportJson">JSON</button>
      </div>
      <button class="close" aria-label="Fermer" @click="store.logsWindow = false">✕</button>
    </header>

    <div v-if="view === 'table'" class="tables">
      <nav class="side" aria-label="Calculs">
        <div v-for="k in tree" :key="k.kind" class="kind">
          <div class="label">{{ k.label }}</div>
          <button v-for="s in k.steps" :key="s.step" :class="{ on: pick.kind === k.kind && pick.step === s.step }" @click="pick = { kind: k.kind, step: s.step }">
            <span>{{ s.step }}</span><small class="num">{{ s.count }}</small>
          </button>
        </div>
      </nav>
      <div class="main">
        <div class="tools">
          <b>{{ LOG_KINDS[pick.kind] }}{{ pick.step === LOG_KINDS[pick.kind] ? '' : ` · ${pick.step}` }}</b>
          <span class="muted">{{ rows.length }} ligne(s) · cliquez un en-tête pour trier, une ligne pour voir le calcul</span>
          <input v-model="filterText" type="search" placeholder="Filtrer…" aria-label="Filtrer les lignes" />
        </div>
        <div class="wrap">
          <table>
            <thead>
              <tr>
                <th v-if="allYears" class="sortable" scope="col" @click="sortBy('#year')">Année<i>{{ sort?.key === '#year' ? (sort.dir === 1 ? '▲' : '▼') : '' }}</i></th>
                <th class="sortable pin" scope="col" @click="sortBy('#country')">Pays<i>{{ sort?.key === '#country' ? (sort.dir === 1 ? '▲' : '▼') : '' }}</i></th>
                <th class="sortable res" scope="col" @click="sortBy('#result')">Résultat<i>{{ sort?.key === '#result' ? (sort.dir === 1 ? '▲' : '▼') : '' }}</i></th>
                <th v-for="k in columns" :key="k" class="sortable" scope="col" :title="k" @click="sortBy(k)">{{ varLabel(k) }}<i>{{ sort?.key === k ? (sort.dir === 1 ? '▲' : '▼') : '' }}</i></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="e in sorted" :key="e.n">
                <tr :class="{ open: open === e.n }" @click="open = open === e.n ? 0 : e.n">
                  <td v-if="allYears" class="num">{{ e.year }}</td>
                  <th scope="row" class="pin"><button class="link" title="Ouvrir la fiche du pays" @click.stop="showCountry(e.country)">{{ name(e.country) }}</button></th>
                  <td class="res">{{ e.result }}</td>
                  <td v-for="k in columns" :key="k" class="num">{{ fmt(e.data[k]) }}</td>
                </tr>
                <tr v-if="open === e.n" class="detail">
                  <td :colspan="columns.length + (allYears ? 3 : 2)"><b>{{ e.title }}</b><pre>{{ e.lines.join('\n') }}</pre></td>
                </tr>
              </template>
            </tbody>
          </table>
          <p v-if="!rows.length" class="muted">Aucune ligne.</p>
        </div>
      </div>
    </div>

    <div v-else class="sheet">
      <div class="tools">
        <button aria-label="Pays précédent" @click="step(-1)">‹</button>
        <select v-model.number="country" aria-label="Pays">
          <option v-for="c in countryList" :key="c" :value="c">{{ c ? name(c) : 'Monde (calculs globaux)' }}</option>
        </select>
        <button aria-label="Pays suivant" @click="step(1)">›</button>
        <span class="muted">{{ sheet.length }} calcul(s), dans l’ordre du tour</span>
      </div>
      <p v-if="!sheet.length" class="muted">Aucun calcul pour ce pays cette année.</p>
      <ol class="cards">
        <li v-for="e in sheet" :key="e.n">
          <div class="top">
            <span class="tagname">{{ LOG_KINDS[e.kind] }}</span>
            <b>{{ e.title }}</b>
            <span class="r num">{{ e.result }}</span>
            <span v-if="allYears" class="muted num">{{ e.year }}</span>
          </div>
          <dl v-if="Object.keys(e.data).length">
            <div v-for="(v, k) in e.data" :key="k" :title="String(k)"><dt>{{ varLabel(String(k)) }}</dt><dd class="num">{{ fmt(v) || '—' }}</dd></div>
          </dl>
          <pre v-if="e.lines.length">{{ e.lines.join('\n') }}</pre>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.lw {
  position: fixed; inset: 16px; z-index: 40; display: flex; flex-direction: column; min-height: 0;
  background: var(--paper); border: 1px solid var(--ink); box-shadow: 0 16px 48px rgb(20 22 24 / 0.35); outline: none;
}
header { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; padding: 10px 14px; border-bottom: 3px double var(--ink); }
header h2 { font: 700 18px/1 var(--font-display); margin-right: auto; }
header select { background: var(--paper); }
.seg { display: flex; gap: 2px; }
.seg button, .exports button { padding: 4px 10px; font-size: 11px; }
.seg button[aria-selected='true'] { background: var(--tag); color: var(--paper); border-color: var(--tag); }
.exports { display: flex; gap: 4px; align-items: center; }
.exports .label { margin-right: 2px; }
.close { padding: 2px 10px; font-size: 14px; }
.muted { color: var(--muted); font-size: 11.5px; }
.tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 0; }
.tools input { margin-left: auto; background: var(--paper); border: 1px solid var(--ink); padding: 4px 8px; font: 12px var(--font-data); color: var(--ink); }
.tools select { background: var(--paper); }

/* Tables: the calculations on the left, the table of the one picked on the right. */
.tables { flex: 1; min-height: 0; display: grid; grid-template-columns: 230px minmax(0, 1fr); }
.side { overflow-y: auto; border-right: 1px solid var(--ink); padding: 8px 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.kind { display: flex; flex-direction: column; gap: 2px; }
.kind .label { margin-bottom: 2px; }
.kind button { all: unset; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; font-size: 12px; }
.kind button:hover { background: var(--land); }
.kind button.on { background: var(--tag); color: var(--paper); }
.kind button small { color: inherit; opacity: .7; }
.kind button:focus-visible { outline: 2px solid var(--accent); }
.main { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 0 14px 12px; }
.wrap { flex: 1; min-height: 0; overflow: auto; }
table { border-collapse: separate; border-spacing: 0; font: 11px/1.35 var(--font-data); white-space: nowrap; }
th, td { padding: 4px 8px; border-bottom: 1px dotted var(--ink); text-align: right; font-variant-numeric: tabular-nums; background: var(--paper); }
thead th { position: sticky; top: 0; z-index: 2; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--ink); }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--ink); }
.sortable i { font-style: normal; margin-left: 3px; color: var(--accent); }
.pin { position: sticky; left: 0; z-index: 1; text-align: left; font-weight: 500; }
thead .pin { z-index: 3; }
.res { text-align: left; max-width: 26ch; overflow: hidden; text-overflow: ellipsis; }
tbody tr { cursor: pointer; }
tbody tr:hover td, tbody tr:hover th, tr.open td, tr.open th { background: color-mix(in oklab, var(--land) 45%, var(--paper)); }
.link { all: unset; cursor: pointer; text-decoration: underline dotted; }
.link:hover { color: var(--warn); }
.link:focus-visible { outline: 2px solid var(--accent); }
tr.detail td { text-align: left; white-space: normal; cursor: default; padding: 6px 10px 10px; }
pre { margin: 4px 0 0; font: 11px/1.5 var(--font-data); white-space: pre-wrap; overflow-wrap: anywhere; }

/* Country sheet: the calculations as cards, in the order the turn runs them. */
.sheet { flex: 1; min-height: 0; overflow-y: auto; padding: 0 14px 14px; }
.cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.cards li { border-left: 3px solid var(--ink); padding: 6px 10px; background: color-mix(in oklab, var(--land) 18%, var(--paper)); }
.top { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.top .r { color: var(--muted); font-size: 11.5px; }
dl { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 0; }
dl div { display: flex; border: 1px solid color-mix(in oklab, var(--ink) 35%, transparent); font-size: 11px; }
dt { padding: 1px 6px; color: var(--muted); }
dd { margin: 0; padding: 1px 6px; background: var(--paper); font-weight: 500; }
@media (max-width: 760px) {
  .lw { inset: 0; }
  .tables { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .side { max-height: 30vh; border-right: 0; border-bottom: 1px solid var(--ink); }
}
</style>
