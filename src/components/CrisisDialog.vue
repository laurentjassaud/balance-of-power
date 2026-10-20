<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { CRISIS_STAGE } from '../engine/crisis'
import { describeNews, INTEREST } from '../engine/news'

const store = useGameStore()
const c = computed(() => {
  void store.version
  return store.game?.crisis ?? null
})
const w = computed(() => store.w!)
const head = computed(() => (c.value ? describeNews(w.value, c.value.item) : null))
const brief = computed(() => (c.value && !c.value.over ? c.value.briefing() : null))
const name = (k: number) => (k === 1 ? 'Washington' : k === 2 ? 'Moscou' : w.value.names[k])

const opening = computed(() => {
  const cr = c.value!
  if (cr.kind === 'minor') return `Vous contestez l’action de ${w.value.names[cr.who]}.`
  if (w.value.twoPlayer) return `${name(3 - cr.who)} conteste l’action de ${name(cr.who)}.`
  return cr.who === w.value.human ? `${name(w.value.cmptr)} conteste votre décision.` : `Vous contestez l’action de ${name(cr.who)}.`
})
const outcome = computed(() => {
  const cr = c.value!
  if (cr.war) return cr.accident ? 'Une erreur d’interprétation déclenche les tirs. Guerre nucléaire accidentelle.' : 'Personne n’a cédé. Les missiles sont partis.'
  if (cr.loser === w.value.human && !w.value.twoPlayer) return 'Vous avez reculé. Le monde retient que vous avez cédé.'
  if (cr.loser && cr.loser <= 2) return `${name(cr.loser)} a reculé.`
  if (cr.loser) return `${w.value.names[cr.loser]} a cédé et annule son action.`
  return 'La crise s’est éteinte d’elle-même.'
})
const stages = [9, 8, 7, 6, 5, 4, 3, 2, 1]
</script>

<template>
  <div v-if="c && head" class="veil" :data-rev="store.version">
    <section class="dlg br" role="dialog" aria-modal="true" aria-labelledby="crisis-title" :data-level="c.level">
      <p class="label">Crise · {{ CRISIS_STAGE[c.level] }}</p>
      <h2 id="crisis-title">{{ head.headline }}</h2>
      <p>{{ opening }}</p>
      <ol class="ladder" aria-label="Niveau de crise">
        <li v-for="s in stages" :key="s" :class="{ passed: s > c.level, now: s === c.level }" :title="CRISIS_STAGE[s]">{{ s }}</li>
      </ol>
      <ul class="log">
        <li v-for="(s, i) in c.steps" :key="i">
          <b>{{ name(s.actor) }}</b>
          {{ s.action === 'escalate' ? `durcit le ton : ${CRISIS_STAGE[s.level].toLowerCase()}.` : 'recule.' }}
        </li>
      </ul>
      <template v-if="!c.over && brief">
        <div class="brief">
          <div v-if="c.kind === 'super' && c.level < 8"><span class="label">Prestige en jeu</span><b class="num">{{ brief.prestigeAtRisk }}</b></div>
          <div><span class="label">Intérêt américain</span><b>{{ INTEREST[brief.usaInterest] }}</b></div>
          <div><span class="label">Intérêt soviétique</span><b>{{ INTEREST[brief.ussrInterest] }}</b></div>
        </div>
        <p v-if="w.twoPlayer" class="label">Décision : {{ name(c.decider) }}</p>
        <div class="btns">
          <button id="crisis-back" @click="store.respond(false)">Reculer</button>
          <button id="crisis-tough" class="danger strong" @click="store.respond(true)">
            {{ c.level <= 3 ? 'Lancer l’escalade' : 'Tenir bon' }}
          </button>
        </div>
      </template>
      <template v-else>
        <p class="out">{{ outcome }}</p>
        <div class="btns"><button id="crisis-ok" class="primary" @click="store.closeCrisis()">Continuer</button></div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.veil { position: fixed; inset: 0; background: color-mix(in oklab, var(--ink) 45%, transparent); display: grid; place-items: center; padding: 16px; z-index: 30; }
.dlg { padding: 22px; border-top: 4px solid var(--accent); width: min(520px, 100%); display: flex; flex-direction: column; gap: 12px; max-height: 92vh; overflow-y: auto; }
.dlg[data-level='1'], .dlg[data-level='2'], .dlg[data-level='3'] { border-top-color: var(--tag); }
h2 { font: 700 20px/1.15 var(--font-display); }
p { margin: 0; }
.ladder { list-style: none; display: flex; gap: 3px; margin: 0; padding: 0; }
.ladder li { flex: 1; text-align: center; font: 12px/24px var(--font-data); background: var(--land); color: var(--muted); }
.ladder li.passed { background: var(--good); color: var(--ink); }
.ladder li.now { background: var(--tag); color: var(--accent); font-weight: 700; }
.log { margin: 0; padding-left: 18px; font-size: 13px; }
.brief { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; padding: 10px 0; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); }
.brief b { font: 500 13px var(--font-data); }
.brief div { display: flex; flex-direction: column; gap: 2px; }
.btns { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.strong { font-weight: 600; }
.out { font-weight: 600; }
</style>
