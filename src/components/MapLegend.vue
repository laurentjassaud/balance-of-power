<script setup lang="ts">
// Stepped legend after the atlas: one swatch per class, its label and how many countries fall in it
// (not on background figures, whose quintile classes always hold about sixteen countries each).
// When the superpowers keep their own colour, each sits at its own end of the scale: the rival above, the player below.
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
const store = useGameStore()
const name = (sp: number) => (sp === 1 ? 'États-Unis' : 'URSS')
// On a background figure, the selected country's value and rank (the original's relative view).
const rank = computed(() => store.bgRank(store.selected))
</script>

<template>
  <div class="legend" :data-rev="store.version">
    <div class="label">{{ store.legend.title }}</div>
    <div class="steps" aria-hidden="true">
      <i v-for="(c, k) in store.legend.colors" :key="k" :style="{ background: c }"></i>
    </div>
    <div v-if="store.fixedSuper" class="row sup"><i class="s"></i><span>{{ name(store.rival) }}</span></div>
    <div v-for="(c, k) in store.legend.colors" :key="k" class="row">
      <i :style="{ background: c }"></i><span>{{ store.legend.labels[k] }}</span><b v-if="!store.bgInd" class="num">{{ store.legend.counts[k] }}</b>
    </div>
    <div v-if="store.fixedSuper" class="row sup"><i class="u"></i><span>{{ name(store.me) }}</span></div>
    <p v-if="store.needsSel" class="pick">Choisissez un pays sur la carte.</p>
    <p v-if="rank && store.w" class="pick"><b>{{ store.w.names[store.selected] }}</b> : {{ rank.v }} · {{ rank.rank }}<sup>{{ rank.rank === 1 ? 'er' : 'e' }}</sup> sur {{ rank.of }}</p>
  </div>
</template>

<style scoped>
.legend { display: grid; gap: 5px; }
.steps { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; height: 10px; margin: 2px 0 4px; }
.row { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: 9px; align-items: center; font: 11px var(--font-data); }
.row i { width: 12px; height: 12px; }
.row b { font-weight: 500; background: var(--tag); color: var(--paper); padding: 0 5px; min-width: 2.2em; text-align: right; }
.sup { margin-top: 4px; }
.pick { margin: 6px 0 0; padding-top: 6px; border-top: 1px dotted var(--ink); font: 11px/1.4 var(--font-data); }
.pick sup { font-size: 0.75em; }
.u { background: #fe7c2c; } /* the player's superpower, as on the map */
.s { background: #1a1c1d; } /* the rival */
</style>
