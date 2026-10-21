<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { NO_CNTRY } from '../engine/core'
import { LOG_KINDS, type LogEntry, type LogKind } from '../engine/debugLog'
import { download } from './download'

// Debug mode: the model's calculations, grouped by the kind of result they produce.
const store = useGameStore()

/** 0 = every year. */
const year = ref(0)
/** 0 = every country, -1 = the country selected on the map. */
const country = ref(0)
const kind = ref<LogKind | 'all'>('all')
const search = ref('')
/** Entries shown per group before "more". */
const PAGE = 150
const shown = ref<Partial<Record<LogKind, number>>>({})

// The journal grows in place: a fresh array lets the filters below see the new entries.
const entries = computed<LogEntry[]>(() => {
  void store.version
  return store.w?.log?.entries.slice() ?? []
})
const years = computed(() => [...new Set(entries.value.map((e) => e.year))].sort((a, b) => b - a))
// The year in play is shown first; it follows the game as long as the player has not picked another.
let followYear = true
watch(years, (ys) => { if (followYear && ys.length) year.value = ys[0] }, { immediate: true })
function pickYear(y: number) {
  year.value = y
  followYear = y === years.value[0]
}

const countries = computed(() => {
  const w = store.w
  if (!w) return []
  return Array.from({ length: NO_CNTRY }, (_, i) => i + 1).sort((a, b) => w.names[a].localeCompare(w.names[b], 'fr'))
})
const who = computed(() => (country.value === -1 ? store.selected : country.value))

/** Entries left by the year, country and text filters (the kind filter only chooses which groups show). */
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return entries.value.filter((e) =>
    (!year.value || e.year === year.value) &&
    (!who.value || e.country === who.value) &&
    (!q || `${e.title} ${e.result} ${e.lines.join(' ')}`.toLowerCase().includes(q)))
})

const groups = computed(() => {
  const by = new Map<LogKind, LogEntry[]>()
  for (const e of filtered.value) {
    const g = by.get(e.kind)
    if (g) g.push(e)
    else by.set(e.kind, [e])
  }
  return (Object.keys(LOG_KINDS) as LogKind[]).filter((k) => by.has(k)).map((k) => ({ kind: k, label: LOG_KINDS[k], items: by.get(k)! }))
})
const visible = computed(() => groups.value.filter((g) => kind.value === 'all' || g.kind === kind.value))
watch([year, country, search, kind], () => { shown.value = {} })

/** The entries on display, as plain text, to keep or share. */
function exportText() {
  const w = store.w
  const lines = [`Balance of Power · journal de calcul · ${w ? `niveau ${w.level}, année ${w.year}` : ''}`, '']
  for (const g of visible.value) {
    lines.push(`=== ${g.label} (${g.items.length}) ===`)
    for (const e of g.items) lines.push(`[${e.year} #${e.n}] ${e.title} → ${e.result}`, ...e.lines.map((l) => `    ${l}`))
    lines.push('')
  }
  download(`balance-of-power-logs-${year.value || 'toutes-annees'}.txt`, lines.join('\n'), 'text/plain')
}
</script>

<template>
  <div class="logs" :data-rev="store.version">
    <button id="logs-window" class="primary" @click="store.logsWindow = true">Tableaux, fiches pays et exports</button>
    <div class="bar">
      <select :value="year" aria-label="Année" @change="pickYear(+($event.target as HTMLSelectElement).value)">
        <option :value="0">Toutes les années</option>
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <select v-model.number="country" aria-label="Pays">
        <option :value="0">Tous les pays</option>
        <option :value="-1">Pays choisi sur la carte{{ store.selected && store.w ? ` (${store.w.names[store.selected]})` : '' }}</option>
        <option :value="-2" disabled>──────────</option>
        <option v-for="c in countries" :key="c" :value="c">{{ store.w?.names[c] }}</option>
      </select>
    </div>
    <div class="bar">
      <input v-model="search" type="search" placeholder="Rechercher dans les calculs…" aria-label="Rechercher" />
      <button :disabled="!filtered.length" title="Télécharger les calculs affichés" @click="exportText">Exporter</button>
    </div>
    <div class="kinds" role="group" aria-label="Type de résultat">
      <button :class="{ on: kind === 'all' }" @click="kind = 'all'">Tout <small>{{ filtered.length }}</small></button>
      <button v-for="g in groups" :key="g.kind" :class="{ on: kind === g.kind }" @click="kind = g.kind">{{ g.label }} <small>{{ g.items.length }}</small></button>
    </div>
    <p v-if="!entries.length" class="empty">Aucun calcul enregistré pour l’instant.</p>
    <p v-else-if="!filtered.length" class="empty">Aucun calcul pour ces filtres.</p>
    <p v-if="country === -1 && !store.selected" class="empty">Cliquez sur un pays de la carte pour voir ses calculs.</p>
    <details v-for="g in visible" :key="g.kind" class="group" :open="kind !== 'all' || visible.length === 1">
      <summary><span class="label">{{ g.label }}</span><span class="num">{{ g.items.length }}</span></summary>
      <ol>
        <li v-for="e in g.items.slice(0, shown[g.kind] ?? PAGE)" :key="e.n">
          <details>
            <summary>
              <span class="t">{{ e.title }}</span>
              <span class="r num">{{ e.result }}</span>
            </summary>
            <pre v-if="e.lines.length">{{ e.lines.join('\n') }}</pre>
            <p class="meta num">#{{ e.n }} · {{ e.year }}</p>
          </details>
        </li>
      </ol>
      <button v-if="g.items.length > (shown[g.kind] ?? PAGE)" class="more" @click="shown[g.kind] = (shown[g.kind] ?? PAGE) + PAGE">
        Afficher {{ Math.min(PAGE, g.items.length - (shown[g.kind] ?? PAGE)) }} de plus (reste {{ g.items.length - (shown[g.kind] ?? PAGE) }})
      </button>
    </details>
  </div>
</template>

<style scoped>
.logs { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.bar { display: flex; gap: 4px; min-width: 0; }
.bar select { flex: 1; min-width: 0; }
.bar input { flex: 1; min-width: 0; background: var(--paper); border: 1px solid var(--ink); padding: 5px 8px; font: 12px var(--font-data); color: var(--ink); }
.kinds { display: flex; flex-wrap: wrap; gap: 4px; }
.kinds button { padding: 3px 7px; font-size: 10.5px; }
.kinds button small { color: var(--muted); }
.kinds button.on { background: var(--tag); color: var(--paper); border-color: var(--tag); }
.kinds button.on small { color: var(--accent); }
.empty { color: var(--muted); margin: 0; }
.group { border-top: 1px solid var(--ink); }
.group > summary { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 8px 0; cursor: pointer; }
.group > summary .num { font-size: 11px; }
.group ol { list-style: none; margin: 0; padding: 0; }
.group li { border-bottom: 1px dotted var(--ink); }
.group li summary { display: flex; flex-direction: column; gap: 1px; padding: 5px 4px; cursor: pointer; list-style: none; }
.group li summary::-webkit-details-marker { display: none; }
.group li summary:hover .t { text-decoration: underline; }
.group li details[open] { background: color-mix(in oklab, var(--paper) 25%, transparent); }
.t { font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }
.r { font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
pre { margin: 0; padding: 4px 6px 2px; font: 10.5px/1.5 var(--font-data); white-space: pre-wrap; overflow-wrap: anywhere; }
.meta { margin: 0; padding: 0 6px 6px; font-size: 10px; color: var(--muted); }
.more { width: 100%; margin: 6px 0; font-size: 11px; }
</style>
