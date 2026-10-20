<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { USA, USSR, Verb, div } from '../engine/core'
import { VERB_LABEL, levelLabel } from '../engine/news'
import PolicyDialog from './PolicyDialog.vue'

const store = useGameStore()
const editing = ref<Verb | null>(null)

const c = computed(() => store.selected)
const info = computed(() => {
  const w = store.w
  if (!w || !c.value) return null
  const i = c.value
  const wing = w.govtWing[i]
  const ratio = w.strngRat[i]
  return {
    name: w.names[i],
    rows: [
      ['Population', `${(w.popln[i] / 10).toLocaleString('fr-FR')} M`],
      ['PNB', `${(w.gnp[i] * 2 / 10).toLocaleString('fr-FR')} Md$`],
      ['Armée', `${(w.milMen[i]).toLocaleString('fr-FR')} 000 hommes`],
      ['Régime', wing < -40 ? 'gauche radicale' : wing < -10 ? 'gauche' : wing <= 10 ? 'centre' : wing <= 40 ? 'droite' : 'droite dure'],
      ['Soutien au gouvernement', `${w.gPopular[i]}`],
      ['Insurrection', i < 3 ? '—' : ratio >= 512 ? 'aucune' : ratio >= 32 ? 'faible' : ratio >= 8 ? 'sérieuse' : ratio >= 2 ? 'guerre civile' : 'régime au bord de la chute'],
      ['Prestige', `${w.prestVal[i]}`],
    ] as [string, string][],
    rel: [w.dipAff[USA][i], w.dipAff[USSR][i]],
    finl: [div(w.finlProb[USA][i], 1), div(w.finlProb[USSR][i], 1)],
    minor: i > 2,
  }
})

const rows = computed(() => {
  const w = store.w
  if (!w || !c.value) return []
  void store.version
  return store.verbs.map((v) => ({
    verb: v,
    usa: w.getPolicy(USA, v, c.value),
    ussr: w.getPolicy(USSR, v, c.value),
  }))
})
const canEdit = computed(() => !!info.value?.minor && !store.game?.crisis && !store.w?.ended)
const others = computed(() => {
  const w = store.w
  if (!w || !c.value || w.level < 4) return []
  const out: string[] = []
  for (let k = 3; k <= 80; k++) {
    if (k === c.value) continue
    if (w.miltAid[k][c.value] || w.intvGovt[k][c.value]) out.push(`${w.names[k]} soutient le gouvernement`)
    if (w.insgAid[k][c.value] || w.intvRebl[k][c.value]) out.push(`${w.names[k]} soutient les rebelles`)
    if (w.dipAff[k][c.value] === -127) out.push(`En guerre avec ${w.names[k]}`)
  }
  return out
})
</script>

<template>
  <div v-if="!info" class="empty">
    <p>Cliquez sur un pays de la carte pour ouvrir son dossier et y définir votre politique.</p>
  </div>
  <div v-else class="panel" :data-rev="store.version">
    <div class="title">
      <h2>{{ info.name }}</h2>
      <span class="open">
        <button class="read" @click="store.journal = c">Journal</button>
        <button class="read" @click="store.history = c">Historique</button>
      </span>
    </div>
    <dl class="facts">
      <template v-for="[k, v] in info.rows" :key="k">
        <dt>{{ k }}</dt><dd>{{ v }}</dd>
      </template>
    </dl>
    <div v-if="info.minor" class="rel">
      <div><span class="label">Relations USA</span><b class="num usa">{{ info.rel[0] }}</b></div>
      <div><span class="label">Relations URSS</span><b class="num ussr">{{ info.rel[1] }}</b></div>
    </div>
    <template v-if="info.minor">
      <h3 class="label">Politiques des superpuissances</h3>
      <table>
        <thead><tr><th></th><th class="usa">USA</th><th class="ussr">URSS</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.verb">
            <th>{{ VERB_LABEL[r.verb] }}</th>
            <td>
              <button v-if="canEdit && store.w!.human === USA" class="pol" :aria-label="`Modifier ${VERB_LABEL[r.verb]}`" @click="editing = r.verb">{{ levelLabel(r.verb, r.usa) }}</button>
              <span v-else>{{ levelLabel(r.verb, r.usa) }}</span>
            </td>
            <td>
              <button v-if="canEdit && store.w!.human === USSR" class="pol" :aria-label="`Modifier ${VERB_LABEL[r.verb]}`" @click="editing = r.verb">{{ levelLabel(r.verb, r.ussr) }}</button>
              <span v-else>{{ levelLabel(r.verb, r.ussr) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <ul v-if="others.length" class="others">
        <li v-for="o in others" :key="o">{{ o }}</li>
      </ul>
    </template>
    <p v-else class="note">Superpuissance : pas de politique possible ici.</p>
    <PolicyDialog v-if="editing !== null" :country="c" :verb="editing" @close="editing = null" />
  </div>
</template>

<style scoped>
.empty { color: var(--muted); padding: 16px 0; }
.panel { display: flex; flex-direction: column; gap: 12px; }
.title { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 1px solid var(--ink); padding-bottom: 8px; }
h2 { font: 700 24px/1.05 var(--font-display); letter-spacing: -0.01em; }
/* Open the country's newspaper and history. */
.open { flex: none; display: flex; gap: 4px; }
.read { flex: none; padding: 3px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; transition: transform 160ms var(--ease-out); }
.read:active { transform: scale(0.97); }
.facts { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 14px; margin: 0; font-size: 12.5px; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; font: 500 12px var(--font-data); text-align: right; }
.rel { display: flex; gap: 22px; }
.rel div { display: flex; flex-direction: column; }
.rel b { font-size: 18px; font-weight: 500; align-self: flex-start; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 5px 4px; border-bottom: 1px dotted var(--ink); vertical-align: top; }
td { font: 11px/1.35 var(--font-data); }
thead th { font: 500 10.5px var(--font-data); letter-spacing: 0.1em; text-transform: uppercase; }
thead th.usa, thead th.ussr { padding: 3px 6px; }
tbody th { font-weight: 500; color: var(--muted); width: 34%; }
.pol { padding: 2px 6px; text-align: left; width: 100%; border-style: dashed; font: 11px/1.35 var(--font-data); letter-spacing: 0; }
.pol:hover { background: var(--tag) !important; color: var(--accent); border-style: solid; }
.others { margin: 0; padding-left: 18px; color: var(--muted); font-size: 13px; }
.note { color: var(--muted); }
</style>
