<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import type { NewsItem } from '../engine/core'
import { describeNews, advise } from '../engine/news'

const store = useGameStore()
type Filter = 'all' | 'rival' | 'mine' | 'minor' | 'country'
const filter = ref<Filter>('all')

const items = computed(() => {
  const w = store.w
  if (!w) return []
  void store.version
  return w.news
    .filter((n) => {
      switch (filter.value) {
        case 'rival': return n.subject === w.cmptr
        case 'mine': return n.subject === w.human
        case 'minor': return n.subject > 2
        case 'country': return n.subject === store.selected || n.object === store.selected
        default: return true
      }
    })
    .map((n) => ({ n, t: describeNews(w, n) }))
})

function open(n: NewsItem, focus: number) {
  store.focusNews = store.focusNews === n ? null : n
  store.selected = focus
}
const advice = computed(() => (store.w && store.focusNews ? advise(store.w, store.focusNews) : []))
const actorClass = (s: number) => (s === 1 ? 'usa' : s === 2 ? 'ussr' : 'minor')
</script>

<template>
  <div class="news" :data-rev="store.version">
    <div class="filters" role="group" aria-label="Filtrer les actualités">
      <button v-for="[k, l] in ([['all', 'Toutes'], ['rival', 'Adversaire'], ['mine', 'Mes actions'], ['minor', 'Pays mineurs'], ['country', 'Pays choisi']] as [Filter, string][])"
        :key="k" :class="{ on: filter === k }" @click="filter = k">{{ l }}</button>
    </div>
    <p v-if="!items.length" class="empty">Rien à signaler pour ce filtre cette année.</p>
    <ol class="list">
      <li v-for="{ n, t } in items" :key="`${n.subject}-${n.verb}-${n.object}`" :class="[actorClass(n.subject), { open: store.focusNews === n }]">
        <button class="head" :aria-expanded="store.focusNews === n" @click="open(n, t.focus)">
          <span class="h">{{ t.headline }}</span>
          <span class="d">{{ t.detail }}<em v-if="n.crisis && n.subject !== n.object && n.newVal > n.oldVal"> · déjà contesté</em></span>
        </button>
        <div v-if="store.focusNews === n" class="more">
          <p class="label">L’avis des conseillers · {{ n.subject === store.w?.human ? 'à gauche risqué, à droite sans risque' : 'à gauche contester, à droite laisser faire' }}</p>
          <ul class="advisors">
            <li v-for="a in advice" :key="a.name">
              <b>{{ a.name }}</b>
              <span class="meter" :style="{ '--v': (a.score + 15) / 31 }"></span>
              <span>{{ a.text }}</span>
            </li>
          </ul>
          <button v-if="store.game?.canChallenge(n)" class="danger" @click="store.challenge(n)">Contester cette action</button>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.news { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.filters { display: flex; flex-wrap: wrap; gap: 4px; }
.filters button { padding: 3px 8px; font-size: 11px; }
.filters button.on { background: var(--tag); color: var(--paper); border-color: var(--tag); }
.empty { color: var(--muted); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.list > li { border-left: 4px solid var(--land); border-bottom: 1px dotted var(--ink); }
.list > li.usa, .list > li.ussr { background: none; padding: 0; color: inherit; }
.list > li.usa { border-left-color: var(--usa); }
.list > li.ussr { border-left-color: var(--ussr); }
.list > li.open { background: color-mix(in oklab, var(--paper) 25%, transparent); }
.head { all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; width: 100%; box-sizing: border-box; }
.head:focus-visible { outline: 2px solid var(--accent); }
.head:hover .h { text-decoration: underline; }
.h { font-weight: 500; }
.d { font: 11px/1.4 var(--font-data); color: var(--muted); }
.d em { background: var(--tag); color: var(--accent); font-style: normal; padding: 0 3px; }
.more { padding: 0 10px 10px; display: flex; flex-direction: column; gap: 10px; }
.advisors { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.advisors li { display: grid; grid-template-columns: 7.5em 60px minmax(0, 1fr); gap: 8px; align-items: center; }
.meter { height: 6px; background: linear-gradient(90deg, var(--accent), var(--land) 50%, var(--muted)); position: relative; }
.meter::after { content: ''; position: absolute; top: -3px; left: calc(var(--v) * 100% - 1px); width: 2px; height: 12px; background: var(--ink); }
</style>
