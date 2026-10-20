<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { FIRST_YEAR } from '../engine/core'
import { LAST_YEAR } from '../engine/game'

const store = useGameStore()
const W = 380, H = 220, L = 40, R = 12, T = 12, B = 26
const data = computed(() => {
  const w = store.w
  if (!w) return null
  void store.version
  const n = w.year - FIRST_YEAR + 1
  const usa = Array.from({ length: n }, (_, i) => w.usaScore[i] ?? 0)
  const ussr = Array.from({ length: n }, (_, i) => w.ussrScore[i] ?? 0)
  let lo = Math.min(0, ...usa, ...ussr)
  let hi = Math.max(10, ...usa, ...ussr)
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(1, hi - lo)))) / (hi - lo < 300 ? 2 : 1)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const x = (i: number) => L + (i * (W - L - R)) / (LAST_YEAR - FIRST_YEAR)
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo || 1)
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return { usa, ussr, x, y, ticks, line, n, years: Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i) }
})
</script>

<template>
  <div v-if="data" class="chart">
    <p class="label">Prestige gagné depuis {{ FIRST_YEAR }}</p>
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="Évolution du prestige">
      <g class="grid">
        <g v-for="t in data.ticks" :key="t">
          <line :x1="L" :x2="W - R" :y1="data.y(t)" :y2="data.y(t)" :class="{ zero: t === 0 }" />
          <text :x="L - 6" :y="data.y(t) + 4" text-anchor="end">{{ t }}</text>
        </g>
        <text v-for="(yr, i) in data.years" :key="yr" :x="data.x(i)" :y="H - 8" text-anchor="middle">{{ i % 2 ? '' : yr }}</text>
      </g>
      <path :d="data.line(data.usa)" class="l usa" />
      <path :d="data.line(data.ussr)" class="l ussr" />
      <circle :cx="data.x(data.n - 1)" :cy="data.y(data.usa[data.n - 1])" r="3.5" fill="var(--usa)" />
      <circle :cx="data.x(data.n - 1)" :cy="data.y(data.ussr[data.n - 1])" r="3.5" fill="var(--ussr)" />
    </svg>
    <div class="keys">
      <span class="usa">● États-Unis {{ data.usa[data.n - 1] }}</span>
      <span class="ussr">● URSS {{ data.ussr[data.n - 1] }}</span>
    </div>
    <p class="note">Le prestige vient de l’amitié des pays qui comptent. La partie s’arrête en {{ LAST_YEAR }} ; le plus prestigieux l’emporte, sauf si la guerre éclate.</p>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; gap: 8px; }
svg { width: 100%; height: auto; }
.grid line { stroke: #c4c7ca; stroke-width: 1; }
.grid line.zero { stroke: var(--ink); }
.grid text { fill: var(--muted); font: 10px var(--font-data); }
.l { fill: none; stroke-width: 2.2; }
.l.usa { stroke: var(--usa); }
.l.usa, .l.ussr { background: none; padding: 0; }
.l.ussr { stroke: var(--ussr); }
.keys { display: flex; gap: 8px; font-family: var(--font-data); font-size: 12px; }
.keys span { padding: 2px 6px; }
.note { color: var(--muted); font-size: 13px; margin: 0; }
</style>
