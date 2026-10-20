<script setup lang="ts">
// The country's newspaper (Events › Newspaper in the original): masthead, front page, what really happened that
// year (src/data/journal.json), the year's news about the country, closing item. Clicking another country on the
// map turns to that country's paper.
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/game'
import { journal } from '../engine/journal'
import { describeNews } from '../engine/news'
import FloatWindow from './FloatWindow.vue'

const store = useGameStore()
// The country shown outlives the closing (store.journal back to 0) so the paper stays on screen while it fades out.
const country = ref(store.journal)
watch(() => store.journal, (c) => { if (c) country.value = c })
watch(() => store.selected, (s) => { if (s && store.journal) store.journal = s })
const page = computed(() => {
  void store.version
  return store.w && country.value ? journal(store.w, country.value) : null
})
const articles = computed(() =>
  (page.value?.news ?? []).map((n) => {
    const t = describeNews(store.w!, n)
    const [kicker, title] = t.headline.includes(' · ') ? t.headline.split(' · ') : ['', t.headline]
    return { n, kicker, title, detail: t.detail, contested: n.crisis && n.subject !== n.object && n.newVal > n.oldVal }
  }),
)
</script>

<template>
  <FloatWindow v-if="page && store.w" id="journal" label="Journal" :width="440" labelledby="journal-name" @close="store.journal = 0">
    <template #head>
      <div class="mast">
        <h2 id="journal-name">{{ page.masthead }}</h2>
        <p class="label edition">{{ store.w.names[country] }} · Édition {{ store.w.year }}</p>
      </div>
    </template>
    <div :key="country" class="paper">
      <article class="front rise" style="--i: 0">
        <span class="tagname">À la une</span>
        <h3>{{ page.front }}</h3>
      </article>
      <aside v-if="page.chronicle" class="chronicle rise" style="--i: 1">
        <span class="label">Chronique {{ store.w.year }}</span>
        <p>{{ page.chronicle }}</p>
      </aside>
      <ol v-if="articles.length" class="news">
        <li v-for="(a, i) in articles" :key="`${a.n.subject}-${a.n.verb}-${a.n.object}`" class="rise" :style="{ '--i': Math.min(i + 2, 8) }">
          <p v-if="a.kicker" class="label kicker">{{ a.kicker }}</p>
          <h4>{{ a.title }}</h4>
          <p class="detail">{{ a.detail }}<em v-if="a.contested"> · déjà contesté</em></p>
          <button v-if="store.game?.canChallenge(a.n)" class="danger contest" @click="store.challenge(a.n)">Contester</button>
        </li>
      </ol>
      <p v-else class="none rise" style="--i: 2">Aucune autre nouvelle de ce pays cette année.</p>
      <footer class="brief rise" :style="{ '--i': Math.min(articles.length + 2, 9) }">
        <span class="label">En bref</span>
        <p>{{ page.close }}</p>
      </footer>
    </div>
  </FloatWindow>
</template>

<style scoped>
.mast { text-align: center; border-top: 1px solid var(--ink); border-bottom: 3px double var(--ink); padding: 10px 0 8px; }
.mast h2 { font: 700 26px/1 var(--font-display); letter-spacing: -0.01em; text-wrap: balance; }
.edition { margin: 6px 0 0; color: var(--muted); }
.paper { display: flex; flex-direction: column; gap: 14px; }
.front { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--ink); }
.front h3 { font: 600 21px/1.18 var(--font-body); text-transform: none; letter-spacing: 0; text-wrap: balance; }
.news { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.news li { padding: 10px 0; border-bottom: 1px dotted var(--ink); display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.kicker { color: var(--muted); }
.news h4 { margin: 0; font: 600 15px/1.3 var(--font-body); text-wrap: pretty; }
.detail { margin: 0; font: 11px/1.4 var(--font-data); color: var(--muted); }
.contest { margin-top: 4px; padding: 3px 10px; font-size: 11px; }
.none { margin: 0; color: var(--muted); }
/* What really happened that year, under the front page: set apart from the game's news by a rule below. */
.chronicle { display: flex; flex-direction: column; gap: 4px; padding-bottom: 12px; border-bottom: 1px solid var(--ink); }
.chronicle p { margin: 0; font: 13px/1.4 var(--font-body); text-wrap: pretty; }
.brief { display: flex; flex-direction: column; gap: 4px; padding-top: 2px; }
.brief p { margin: 0; font-style: italic; }
/* Articles come in one after the other, quickly. */
.rise { animation: rise 300ms var(--ease-out) both; animation-delay: calc(var(--i) * 40ms); }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
</style>
