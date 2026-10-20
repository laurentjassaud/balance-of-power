<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { Verb } from '../engine/core'
import { VERB_LABEL, levelLabel } from '../engine/news'

const props = defineProps<{ country: number; verb: Verb }>()
const emit = defineEmits<{ close: [] }>()
const store = useGameStore()

const lim = computed(() => store.game!.limits(props.country, props.verb))
const choice = ref(lim.value.current)
const levels = [0, 1, 2, 3, 4, 5]

const UNITS: Partial<Record<Verb, string>> = {
  [Verb.MilAid]: 'en armement disponible',
  [Verb.InsgAid]: 'en armement disponible',
  [Verb.IntvGovt]: '000 soldats disponibles',
  [Verb.IntvRebl]: '000 soldats disponibles',
  [Verb.Econ]: 'en budget d’aide disponible',
}

function apply() {
  if (choice.value !== lim.value.current) store.setPolicy(props.country, props.verb, choice.value)
  emit('close')
}
</script>

<template>
  <div class="veil" @click.self="emit('close')">
    <form class="dlg br" role="dialog" aria-modal="true" @submit.prevent="apply">
      <p class="label">{{ store.w?.names[country] }}</p>
      <h3>{{ VERB_LABEL[verb] }}</h3>
      <p v-if="lim.available !== null" class="avail num">Ressources : {{ lim.available }} {{ UNITS[verb] }}</p>
      <div class="levels">
        <label v-for="l in levels" :key="l" :class="{ off: l < lim.min || l > lim.max, on: choice === l }">
          <input :id="`pol-${l}`" v-model="choice" type="radio" name="pol" :value="l" :disabled="l < lim.min || l > lim.max" />
          <span class="num">{{ l }}</span> {{ levelLabel(verb, l) }}
        </label>
      </div>
      <p v-if="lim.max < 5" class="hint">Les niveaux grisés sont hors de portée : relations insuffisantes, traité manquant ou ressources épuisées.</p>
      <div class="btns">
        <button type="button" @click="emit('close')">Annuler</button>
        <button type="submit" class="primary">Appliquer</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.veil { position: fixed; inset: 0; background: color-mix(in oklab, var(--bg) 70%, transparent); display: grid; place-items: center; padding: 16px; z-index: 20; }
.dlg { padding: 20px; width: min(420px, 100%); display: flex; flex-direction: column; gap: 10px; }
h3 { font: 700 20px/1.1 var(--font-display); }
.avail { color: var(--muted); font-size: 13px; margin: 0; }
.levels { display: flex; flex-direction: column; gap: 4px; }
.levels label { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border: 1px solid var(--ink); cursor: pointer; font-size: 12.5px; }
.levels input { accent-color: var(--accent); }
.levels label.on { background: var(--tag); color: var(--paper); border-color: var(--tag); }
.levels label.on .num { color: var(--accent); }
.levels label.off { opacity: 0.4; cursor: not-allowed; }
.levels .num { width: 1.2em; color: var(--muted); }
.hint { font-size: 12px; color: var(--muted); margin: 0; }
.btns { display: flex; justify-content: flex-end; gap: 8px; }
</style>
