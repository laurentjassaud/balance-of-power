<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useGameStore, MAP_MODES, BG_GROUPS, SEL_MODES } from './stores/game'
import { PER_LABEL } from './engine/background'
import { USA, USSR } from './engine/core'
import { LEVEL_NAMES } from './engine/news'
import NewGame from './components/NewGame.vue'
import WorldMap from './components/WorldMap.vue'
import MapLegend from './components/MapLegend.vue'
import RankStrip from './components/RankStrip.vue'
import CountryPanel from './components/CountryPanel.vue'
import NewsPanel from './components/NewsPanel.vue'
import ScoreChart from './components/ScoreChart.vue'
import CrisisDialog from './components/CrisisDialog.vue'
import EndScreen from './components/EndScreen.vue'
import Journal from './components/Journal.vue'
import History from './components/History.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import emblemUsa from './assets/emblem-usa.webp'
import emblemUssr from './assets/emblem-ussr.webp'

const store = useGameStore()
const w = computed(() => store.w)
const sideName = (sp: number) => (sp === USA ? 'États-Unis' : 'URSS')

const signed = (x: number) => (x > 0 ? `+${x}` : `${x}`)
// Side colours follow the player: their superpower is orange, the rival black (tags keep a black ground).
watchEffect(() => {
  const me = store.me, root = document.documentElement.style
  const orange = '#fe7c2c', black = '#1a1c1d', paper = '#eef0f1' // the map's superpower colours
  root.setProperty('--usa', me === USA ? orange : black)
  root.setProperty('--ussr', me === USA ? black : orange)
  root.setProperty('--usa-tx', me === USA ? orange : paper)
  root.setProperty('--ussr-tx', me === USA ? paper : orange)
})
const busy = computed(() => !!store.game?.crisis)
// Maps offered at this level, and whether the one on display is a policy of the selected country (sent or received).
const byLevel = <T extends { minLevel?: number }>(list: T[]) => list.filter((x) => (w.value?.level ?? 1) >= (x.minLevel ?? 1))
const situationModes = computed(() => byLevel(MAP_MODES))
const selModes = computed(() => byLevel(SEL_MODES))
const selPolicy = computed(() => SEL_MODES.some((x) => x.id === store.mapMode && x.verb !== undefined))
// Starting over throws the game (and its save) away, so a game in progress asks first.
const confirmNew = ref(false)
function newGame() {
  if (w.value?.ended) store.quit()
  else confirmNew.value = true
}
</script>

<template>
  <NewGame v-if="!w" />
  <!-- Poster layout after the atlas: left rail (title, year, scores, actions, map mode, legend), map, right dossier box. -->
  <div v-else class="poster" :data-rev="store.version">
    <aside class="rail">
      <div class="brand">
        <div class="label">Géopolitique de la guerre froide</div>
        <h1>Balance<br>of Power</h1>
        <div class="label sub">{{ LEVEL_NAMES[w.level] }} · {{ w.twoPlayer ? 'deux joueurs' : `vous êtes ${sideName(w.human)}` }}</div>
      </div>
      <div class="year num" aria-label="Année">{{ w.year }}</div>
      <dl class="scores">
        <dt class="label">Prestige USA</dt><dd class="num"><span class="usa">{{ signed(w.score(USA)) }}</span></dd>
        <dt class="label">Prestige URSS</dt><dd class="num"><span class="ussr">{{ signed(w.score(USSR)) }}</span></dd>
      </dl>
      <div class="actions">
        <span v-if="w.twoPlayer" class="label turn">Au tour de <span :class="w.human === USA ? 'usa' : 'ussr'">{{ sideName(w.human) }}</span></span>
        <button v-if="w.twoPlayer && !w.handedOver" id="handover" class="primary" :disabled="busy || !!w.ended" @click="store.handOver()">Passer la main {{ w.human === USA ? 'à l’URSS' : 'aux États-Unis' }}</button>
        <button v-else id="next-turn" class="primary" :disabled="busy || !!w.ended" @click="store.nextTurn()">Année suivante</button>
      </div>
      <div class="mode">
        <label class="label" for="mapmode">Indice affiché</label>
        <select id="mapmode" v-model="store.mapMode">
          <optgroup label="Situation">
            <option v-for="m in situationModes" :key="m.id" :value="m.id">{{ m.label }}</option>
          </optgroup>
          <optgroup label="Politiques">
            <option v-for="m in store.policyModes" :key="m.id" :value="m.id">{{ m.label }}</option>
          </optgroup>
          <optgroup label="Pays choisi">
            <option v-for="m in selModes" :key="m.id" :value="m.id">{{ m.label }}</option>
          </optgroup>
          <optgroup v-for="g in BG_GROUPS" :key="g.group" :label="`Données de fond · ${g.group}`">
            <option v-for="m in g.modes" :key="m.id" :value="m.id">{{ m.label }}</option>
          </optgroup>
        </select>
        <div v-if="store.bgInd && store.bgInd.per.length > 1" class="per" role="radiogroup" aria-label="Rapporter la valeur">
          <button v-for="p in store.bgInd.per" :key="p" role="radio" :aria-checked="store.bgDiv === p" @click="store.bgPer = p">{{ PER_LABEL[p] }}</button>
        </div>
        <div v-if="selPolicy" class="per" role="radiogroup" aria-label="Sens de la politique">
          <button v-for="[d, l] in ([['out', 'Accordé'], ['in', 'Reçu']] as const)" :key="d" role="radio" :aria-checked="store.selDir === d" @click="store.selDir = d">{{ l }}</button>
        </div>
        <MapLegend />
      </div>
      <div class="foot">
        <img class="emblem" :src="w.human === USA ? emblemUsa : emblemUssr" :alt="`Emblème : ${sideName(w.human)}`" />
        <button id="new-game" class="new" @click="newGame">Nouvelle partie</button>
      </div>
    </aside>

    <section class="mapcol">
      <WorldMap />
      <p class="hint label">Cliquez sur un pays pour ouvrir son dossier · molette ou + / − pour zoomer · glisser pour déplacer</p>
      <RankStrip />
    </section>

    <aside class="side br" aria-label="Dossier">
      <div class="head label">Dossier</div>
      <div class="scroll">
      <nav class="tabs" role="tablist">
        <button role="tab" :aria-selected="store.tab === 'news'" @click="store.tab = 'news'">Actualités</button>
        <button role="tab" :aria-selected="store.tab === 'country'" @click="store.tab = 'country'">Pays</button>
        <button role="tab" :aria-selected="store.tab === 'scores'" @click="store.tab = 'scores'">Prestige</button>
      </nav>
      <NewsPanel v-if="store.tab === 'news'" />
      <CountryPanel v-else-if="store.tab === 'country'" />
      <ScoreChart v-else />
      </div>
    </aside>

    <Transition name="paper" :duration="{ enter: 260, leave: 150 }">
      <Journal v-if="store.journal" />
    </Transition>
    <Transition name="paper" :duration="{ enter: 260, leave: 150 }">
      <History v-if="store.history" />
    </Transition>
    <ConfirmDialog v-if="confirmNew" title="Nouvelle partie ?" text="La partie en cours et sa sauvegarde seront effacées."
      confirm="Nouvelle partie" cancel="Continuer la partie" @confirm="confirmNew = false; store.quit()" @cancel="confirmNew = false" />
    <CrisisDialog v-if="store.game?.crisis" />
    <EndScreen v-else-if="w.ended" />
  </div>
</template>

<style scoped>
.poster {
  min-height: 100vh; display: grid; gap: 20px 28px; padding: 24px;
  grid-template-columns: 240px minmax(0, 1fr) 380px; align-items: start;
}
.rail { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.brand h1 { font: 700 30px/0.95 var(--font-display); letter-spacing: -0.01em; margin: 6px 0 8px; }
.sub { color: var(--muted); }
.year { font: 700 64px/0.9 var(--font-display); letter-spacing: -0.03em; border-top: 1px solid var(--ink); padding-top: 10px; }
.scores { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; margin: 0; align-items: center; }
.scores dd { margin: 0; font-size: 18px; font-weight: 500; }
.actions { display: flex; flex-direction: column; gap: 6px; }
.turn { display: flex; gap: 6px; align-items: center; }
.mode { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--ink); padding-top: 12px; }
.mode select { width: 100%; }
/* Divisor of a background figure: one segmented row under the selector. */
.per { display: flex; gap: 2px; }
.per button { flex: 1; padding: 4px 6px; font-size: 10.5px; transition: transform 160ms var(--ease-out); }
.per button:active { transform: scale(0.97); }
.per button[aria-checked='true'] { background: var(--tag); color: var(--paper); border-color: var(--tag); }
/* Chromium lets the map-mode list itself be styled (customizable select): it takes the poster's look and the shared scrollbar.
   Other browsers keep their native list. */
@supports (appearance: base-select) {
  .mode select, .mode select::picker(select) { appearance: base-select; }
  .mode select::picker(select) { background: var(--panel); border: 1px solid var(--ink); padding: 4px 0; margin-block: 2px; box-shadow: 0 8px 24px rgb(20 22 24 / 0.3); }
  .mode select::picker(select)::-webkit-scrollbar { width: 6px; }
  .mode select::picker(select)::-webkit-scrollbar-thumb { background: var(--ink); border-radius: 3px; }
  .mode optgroup { font: 700 10.5px/1.25 var(--font-data); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 12px 6px; padding-top:6px; border-top: 1px solid var(--muted);}
  .mode option { font: 500 12px var(--font-data); letter-spacing: normal; text-transform: none; color: var(--ink); padding: 4px 8px; }
  .mode option:hover, .mode option:focus-visible { background: var(--tag); color: var(--paper); outline: none; }
  .mode option:checked { color: var(--accent); }
  .mode option::checkmark { display: none; }
}
/* Pinned to the foot of the rail: the player's emblem, then the orange button to start over. */
.foot { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 8px; }
.emblem { width: 128px; height: 128px; object-fit: contain; }
.new { width: 100%; background: var(--accent); color: var(--ink); border-color: var(--accent); text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
.new:hover:not(:disabled) { background: var(--tag); color: var(--accent); border-color: var(--tag); }
.mapcol { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.hint { color: var(--muted); font-size: 9.5px; }
.side { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 0 16px 16px; }
.head { padding: 12px 0 10px; }
/* Scrollbar hidden until the pointer is over the panel. */
/* The scrollbar's room is always reserved (no shift when it shows); only its colour changes on hover. */
.scroll { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 12px; scrollbar-gutter: stable; }
.scroll::-webkit-scrollbar-thumb { background: transparent; }
.side:hover .scroll::-webkit-scrollbar-thumb { background: var(--ink); }
@supports not selector(::-webkit-scrollbar) {
  .scroll { scrollbar-color: transparent transparent; }
  .side:hover .scroll { scrollbar-color: var(--ink) transparent; }
}
.tabs { display: flex; gap: 2px; }
.tabs button { flex: 1; padding: 6px 8px; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; }
.tabs button[aria-selected='true'] { background: var(--tag); color: var(--paper); border-color: var(--tag); }
/* Wider than a phone, the poster is exactly one window high: the rail scrolls if it must
   and the map takes the height the hint and the ranking strip leave. The rail's 4px inset keeps focus rings unclipped. */
@media (width > 760px) {
  .poster { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; grid-template-rows: minmax(0, 1fr); align-items: stretch; }
  .rail { overflow-y: auto; margin: -4px; padding: 4px; }
  .mapcol > .map { flex: 1 1 0; min-height: 0; aspect-ratio: auto; }
}
@media (max-width: 1180px) { .poster { grid-template-columns: 220px minmax(0, 1fr) 320px; } }
@media (max-width: 760px) {
  .poster { grid-template-columns: minmax(0, 1fr); padding: 16px; gap: 16px; }
  .rail { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px 16px; }
  .brand h1 { font-size: 24px; }
  .year { font-size: 44px; border: 0; padding: 0; align-self: end; }
  .scores, .actions, .mode, .foot { grid-column: 1 / -1; }
  .emblem { width: 96px; height: 96px; }
  .actions { flex-direction: row; flex-wrap: wrap; }
}
</style>
