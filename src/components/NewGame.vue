<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../stores/game'
import { USA, USSR, FIRST_YEAR, type Level } from '../engine/core'
import { LEVEL_NAMES } from '../engine/news'

const store = useGameStore()
const level = ref<Level>(1)
const side = ref<number>(USA)
const twoPlayer = ref(false)
const debug = ref(false)

const LEVEL_HELP = [
  '',
  'Aide militaire, armes aux rebelles et envoi de troupes. Le monde reste calme.',
  'Ajoute l’aide économique et la déstabilisation. Les coups d’État deviennent possibles.',
  'Ajoute les traités et la pression diplomatique. Les pays peuvent se finlandiser.',
  'Ajoute le commerce. Les pays mineurs mènent leur propre politique et se font la guerre.',
]
</script>

<template>
  <div class="start">
    <div class="intro">
      <p class="label">{{ FIRST_YEAR }} · Guerre froide</p>
      <h1>Balance of Power</h1>
      <p>
        Huit ans pour accroître le prestige de votre superpuissance sans déclencher de guerre nucléaire.
        Aidez vos alliés, armez les rebelles chez l’adversaire, contestez ses initiatives… et sachez reculer à temps.
      </p>
      <p class="credit">D’après le jeu de Chris Crawford (édition 1990), porté en Vue 3.</p>
    </div>
    <form class="setup" @submit.prevent="store.newGame(level, side, twoPlayer, debug)">
      <fieldset>
        <legend class="label">Niveau</legend>
        <label v-for="l in [1, 2, 3, 4] as Level[]" :key="l" class="opt" :class="{ on: level === l }">
          <input :id="`level-${l}`" v-model="level" type="radio" name="level" :value="l" />
          <span><b>{{ LEVEL_NAMES[l] }}</b><small>{{ LEVEL_HELP[l] }}</small></span>
        </label>
      </fieldset>
      <fieldset>
        <legend class="label">Camp</legend>
        <div class="row">
          <label class="opt side" :class="{ on: side === USA }">
            <input id="side-usa" v-model="side" type="radio" name="side" :value="USA" /><b class="usa">États-Unis</b>
          </label>
          <label class="opt side" :class="{ on: side === USSR }">
            <input id="side-ussr" v-model="side" type="radio" name="side" :value="USSR" /><b class="ussr">URSS</b>
          </label>
        </div>
        <label class="check"><input id="two-player" v-model="twoPlayer" type="checkbox" /> Deux joueurs sur le même écran</label>
        <label class="check"><input id="debug" v-model="debug" type="checkbox" /> Débogage <small>· onglet Logs avec tous les calculs</small></label>
      </fieldset>
      <button id="start" class="primary big" type="submit">Commencer en {{ FIRST_YEAR }}</button>
    </form>
  </div>
</template>

<style scoped>
.start {
  max-width: 980px; margin: 0 auto; padding: 48px 20px; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 40px; align-items: start;
}
h1 { font: 700 clamp(40px, 7vw, 72px)/0.92 var(--font-display); letter-spacing: -0.02em; margin: 8px 0 18px; border-top: 1px solid var(--ink); padding-top: 14px; }
.intro p { max-width: 42ch; }
.credit { color: var(--muted); font-size: 13px; }
.setup { display: flex; flex-direction: column; gap: 18px; }
fieldset { border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
legend { margin-bottom: 6px; }
.opt {
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; cursor: pointer;
  border: 1px solid var(--ink); background: var(--panel);
}
.opt input { accent-color: var(--accent); }
.opt.on { background: var(--tag); color: var(--paper); border-color: var(--tag); }
.opt.on small { color: var(--land); }
.opt span { display: flex; flex-direction: column; }
.opt small { color: var(--muted); }
.opt b { font: 500 12px var(--font-data); text-transform: uppercase; letter-spacing: .06em; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.side b { font-size: 16px; }
.check { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
.check small { color: var(--muted); }
.big { padding: 12px; font-size: 13px; }
@media (max-width: 760px) { .start { grid-template-columns: minmax(0, 1fr); padding: 28px 16px; gap: 24px; } }
</style>
