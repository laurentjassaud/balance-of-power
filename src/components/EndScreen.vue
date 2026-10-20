<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { USA, USSR } from '../engine/core'
import { LAST_YEAR } from '../engine/game'

const store = useGameStore()
const w = computed(() => store.w!)
const verdict = computed(() => {
  const e = w.value.ended
  if (e === 'war') return { title: 'Guerre nucléaire', text: 'Personne n’a voulu céder. Il n’y a plus de score à compter, ni personne pour le lire.' }
  if (e === 'accident') return { title: 'Guerre accidentelle', text: 'La tension était telle qu’une fausse alerte a suffi. Le monde n’a pas survécu à cette crise.' }
  const a = w.value.score(USA)
  const b = w.value.score(USSR)
  const winner = a === b ? null : a > b ? 'Les États-Unis' : 'L’URSS'
  return {
    title: `La paix a tenu jusqu’en ${LAST_YEAR}`,
    text: winner ? `${winner} terminent avec le plus de prestige (${a} contre ${b}).` : `Égalité parfaite : ${a} partout.`,
  }
})
</script>

<template>
  <div class="veil" :data-rev="store.version">
    <section class="dlg br" role="dialog" aria-modal="true" :class="w.ended">
      <p class="label">Fin de partie · {{ w.year }}</p>
      <h2>{{ verdict.title }}</h2>
      <p>{{ verdict.text }}</p>
      <div class="btns">
        <button id="end-close" @click="store.tab = 'scores'; store.touch()">Voir la carte</button>
        <button id="end-new" class="primary" @click="store.quit()">Nouvelle partie</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.veil { position: fixed; inset: auto 16px 16px auto; z-index: 25; max-width: calc(100% - 32px); }
.dlg { padding: 20px; border-top: 4px solid var(--accent); width: min(420px, 100%); display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 40px color-mix(in oklab, var(--ink) 25%, transparent); }
.dlg.war, .dlg.accident { border-top-color: var(--tag); }
h2 { font: 700 22px/1.1 var(--font-display); }
p { margin: 0; }
.btns { display: flex; gap: 8px; justify-content: flex-end; }
</style>
