<script setup lang="ts">
// Debug mode: report of a change to the weapons or troops sent to a country. Every figure of the government and
// rebel model (named as in Chris Crawford's book), its equation, its value now, and next year's projected value
// without and with the change; then the prestige. Native modal dialog: Escape or the backdrop closes it.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '../stores/game'
import { USA } from '../engine/core'
import { VERB_LABEL, levelLabel } from '../engine/news'
import type { Projection, ProjKey } from '../engine/policyDebug'

const store = useGameStore()
const r = computed(() => store.policyReport!)
const dlg = ref<HTMLDialogElement>()
const sideName = (sp: number) => (sp === USA ? 'USA' : 'URSS')

interface Row {
  key: ProjKey
  /** Name in the book, then in the code. */
  book: string
  code: string
  eq: string
  /** The equation with the values after the change. */
  calc?: (p: Projection) => string
  /** Shown only when the projection is not zero. */
  ifAny?: boolean
}
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Gouvernement',
    rows: [
      { key: 'drafFrac', book: 'Draft Rate', code: 'drafFrac', eq: 'part de la population sous les drapeaux, sur 256' },
      { key: 'milMen', book: 'Soldiers', code: 'milMen', eq: 'Population × Draft Rate / 256', calc: (p) => `${p.popln} × ${p.drafFrac} / 256` },
      { key: 'miltSpnd', book: 'Weapons', code: 'miltSpnd', eq: 'dépenses militaires, part du PNB (économie de l’an passé)' },
      { key: 'govtAid', book: 'Military Aid', code: 'govtAid', eq: 'Σ aide militaire reçue : 1, 5, 20, 50, 100 par niveau' },
      { key: 'weapons', book: 'Total Weapons', code: 't', eq: 'max(1, (Weapons + Military Aid) / 2)', calc: (p) => `max(1, (${p.miltSpnd} + ${p.govtAid}) / 2)` },
      { key: 'govtBase', book: '2·S·W / (S + W)', code: 'base', eq: '4 × t × Soldiers / (t + Soldiers)', calc: (p) => `4 × ${p.weapons} × ${p.milMen} / (${p.weapons} + ${p.milMen})` },
      { key: 'intvGovt1', book: 'Intervention Power USA', code: 'intvGovt[1]', eq: 'troupes (1, 5, 20, 100, 500 k) × puissance USA / effectifs USA' },
      { key: 'intvGovt2', book: 'Intervention Power URSS', code: 'intvGovt[2]', eq: 'troupes (1, 5, 20, 100, 500 k) × puissance URSS / effectifs URSS' },
      { key: 'wars', book: 'Guerres (niveau 4)', code: 'Σ milPowr[j] / 4', eq: 'pertes face aux pays mineurs en guerre', ifAny: true },
      { key: 'govtPowr', book: 'Government Power', code: 'milPowr', eq: 'base + Intervention Power USA + URSS − guerres', calc: (p) => `${p.govtBase} + ${p.intvGovt1} + ${p.intvGovt2}${p.wars ? ` − ${p.wars}` : ''}` },
      { key: 'milPowr', book: 'Military Power (après combat)', code: 'milPowr', eq: 'max(1, Government Power − Insurgency Power / 4)', calc: (p) => `max(1, ${p.govtPowr} − ${p.insgPowr} / 4)` },
    ],
  },
  {
    title: 'Insurgés',
    rows: [
      { key: 'maturity', book: 'Maturity', code: 'maturity', eq: 'constante du pays (0 à 255)' },
      { key: 'sqrtStrg', book: 'Success', code: 'sqrtStrg', eq: '√(6400 × rebelles / gouvernement de l’an passé)' },
      { key: 'fighters', book: 'Fighters', code: 'x', eq: '((256 − Maturity) × Population / 256) × Success / 80', calc: (p) => `((256 − ${p.maturity}) × ${p.popln} / 256) × ${p.sqrtStrg} / 80` },
      { key: 'shipments', book: 'Weapons Shipments', code: 'Σ insgAid', eq: 'Σ armes aux rebelles : 1, 5, 20, 50, 100 par niveau' },
      { key: 'insgWeapons', book: 'Insurgency Weapons', code: 't', eq: 'max(2 × Weapons Shipments, Fighters / 8 + 1)', calc: (p) => `max(2 × ${p.shipments}, ${p.fighters} / 8 + 1)` },
      { key: 'insgBase', book: '2·F·W / (F + W)', code: 'base', eq: '4 × t × Fighters / (t + Fighters)', calc: (p) => `4 × ${p.insgWeapons} × ${p.fighters} / (${p.insgWeapons} + ${p.fighters})` },
      { key: 'intvRebl1', book: 'Intervention Power USA', code: 'intvRebl[1]', eq: 'troupes (1, 5, 20, 100, 500 k) × puissance USA / effectifs USA' },
      { key: 'intvRebl2', book: 'Intervention Power URSS', code: 'intvRebl[2]', eq: 'troupes (1, 5, 20, 100, 500 k) × puissance URSS / effectifs URSS' },
      { key: 'insgPowr', book: 'Insurgency Power', code: 'insgPowr', eq: 'base + Intervention Power USA + URSS', calc: (p) => `${p.insgBase} + ${p.intvRebl1} + ${p.intvRebl2}` },
      { key: 'insgLeft', book: 'Insurgency Power (après combat)', code: 'insgPowr', eq: 'max(1, Insurgency Power − Military Power / 4)', calc: (p) => `max(1, ${p.insgPowr} − ${p.milPowr} / 4)` },
      { key: 'strngRat', book: 'Rapport de forces', code: 'strngRat', eq: 'Military Power / rebelles après combat (× 4 si rebelles = 1)', calc: (p) => `${p.milPowr} / ${p.insgLeft}` },
    ],
  },
  {
    title: 'Prestige',
    rows: [
      { key: 'prestVal', book: 'Prestige Value', code: 'prestVal', eq: 'poids du pays dans le prestige' },
      ...[1, 2].flatMap((k): Row[] => [
        { key: `reaction${k}` as ProjKey, book: `Réaction annuelle à ${sideName(k)}`, code: `Δ dipAff[${k}]`, eq: 'Σ termes de réaction / 8 (aide mil. × pression mil. / 8, −12 × armes aux rebelles, troupes × pression mil. / 4, −64 × troupes aux rebelles…)' },
        { key: `revlGain${k}` as ProjKey, book: `Gain de révolution ${sideName(k)}`, code: `revlGain[${k}]`, eq: '(affinité du régime rebelle − relations) × Prestige Value / 1024', ifAny: true },
        { key: `dipAff${k}` as ProjKey, book: `Diplomatic Affinity ${sideName(k)}`, code: `dipAff[${k}]`, eq: 'relations + réaction, bornées à ±127 (affinité du régime rebelle s’il y a révolution)' },
        { key: `share${k}` as ProjKey, book: `Part du pays · ${sideName(k)}`, code: '', eq: 'Diplomatic Affinity × Prestige Value / 1024', calc: (p) => `${p[`dipAff${k}` as ProjKey]} × ${p.prestVal} / 1024` },
        { key: `score${k}` as ProjKey, book: `Prestige ${sideName(k)}`, code: `score(${k})`, eq: 'Σ pays (Diplomatic Affinity × Prestige Value) / 1024 − prestige initial' },
      ]),
    ],
  },
]
const groups = computed(() => GROUPS.map((g) => ({
  ...g,
  rows: g.rows.filter((row) => !row.ifAny || r.value.before[row.key] || r.value.after[row.key]),
})))

/** The book's labels for a strength ratio. */
function status(ratio: number): string {
  if (ratio < 1) return 'révolution'
  if (ratio < 2) return 'guerre civile'
  if (ratio < 32) return 'guérilla'
  if (ratio <= 512) return 'terrorisme'
  return 'paix'
}
const fr = (x: number) => x.toLocaleString('fr-FR')
const signed = (x: number) => (x > 0 ? `+${fr(x)}` : fr(x))
const pct = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.activeElement as HTMLElement | null
  dlg.value!.showModal()
})
onBeforeUnmount(() => {
  if (dlg.value?.open) dlg.value.close()
  if (opener?.isConnected) opener.focus({ preventScroll: true })
})
const close = () => { store.policyReport = null }
function backdrop(e: MouseEvent) {
  if (e.target === dlg.value) close()
}
</script>

<template>
  <dialog ref="dlg" class="pr" aria-labelledby="pr-title" @cancel.prevent="close" @click="backdrop">
    <div class="box br">
      <header>
        <p class="label">Débogage · {{ sideName(r.sp) }} → {{ store.w?.names[r.country] }}</p>
        <h2 id="pr-title">{{ VERB_LABEL[r.verb] }} : {{ levelLabel(r.verb, r.oldVal) }} → {{ levelLabel(r.verb, r.newVal) }}</h2>
        <p class="sub">
          Projection de {{ r.year + 1 }}, toutes choses égales par ailleurs, sans puis avec le changement.
          Rapport de forces : <b>{{ status(r.before.strngRat) }}</b> → <b :class="{ hot: status(r.before.strngRat) !== status(r.after.strngRat) }">{{ status(r.after.strngRat) }}</b>.
        </p>
      </header>

      <div class="wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" class="name">Variable</th>
              <th scope="col" class="eq">Équation</th>
              <th scope="col">Actuel</th>
              <th scope="col">Sans</th>
              <th scope="col">Avec</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody v-for="g in groups" :key="g.title">
            <tr class="group"><th colspan="6" scope="colgroup" class="label">{{ g.title }}</th></tr>
            <tr v-for="row in g.rows" :key="row.key" :class="{ moved: r.after[row.key] !== r.before[row.key] }">
              <th scope="row" class="name">{{ row.book }}<code v-if="row.code">{{ row.code }}</code></th>
              <td class="eq">{{ row.eq }}<code v-if="row.calc">= {{ row.calc(r.after) }}</code></td>
              <td class="num muted">{{ r.now[row.key] === undefined ? '—' : fr(r.now[row.key]!) }}</td>
              <td class="num">{{ fr(r.before[row.key]) }}</td>
              <td class="num">{{ fr(r.after[row.key]) }}</td>
              <td class="num d">{{ r.after[row.key] === r.before[row.key] ? '' : signed(r.after[row.key] - r.before[row.key]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="r.odds" class="note">
        Risque de contestation par l’ordinateur au début de {{ r.year + 1 }} : <b class="num">{{ pct(r.odds.odds) }}</b>
        <span class="muted">· importance {{ fr(r.odds.impt) }}, contestation si −importance ({{ fr(r.odds.threshold) }}) &lt; tirage 0..31</span>
      </p>
      <p class="note muted">
        «&nbsp;Actuel&nbsp;» : valeurs à la fin de {{ r.year }}. Les projections reprennent les formules du tour suivant sur l’état présent ;
        l’économie de l’année, les refus de politiques et une éventuelle crise changeront ces chiffres. Le calcul réel figure dans l’onglet Logs après le passage à {{ r.year + 1 }}.
      </p>
      <div class="buttons"><button autofocus @click="close">Fermer</button></div>
    </div>
  </dialog>
</template>

<style scoped>
.pr { padding: 0; border: 0; background: transparent; color: inherit; max-width: none; max-height: none; overflow: visible; }
.pr::backdrop { background: rgb(20 22 24 / 0.45); }
.box {
  width: min(1040px, calc(100vw - 32px)); max-height: calc(100dvh - 32px);
  padding: 20px 22px; border-top: 4px solid var(--accent); display: flex; flex-direction: column; gap: 10px; min-height: 0;
}
h2 { font: 700 20px/1.1 var(--font-display); margin: 4px 0; }
.sub, .note { margin: 0; font-size: 12.5px; }
.muted { color: var(--muted); }
.hot { color: var(--warn); }
.wrap { min-height: 0; overflow: auto; border-top: 1px solid var(--ink); }
table { width: 100%; border-collapse: separate; border-spacing: 0; font: 11.5px/1.35 var(--font-data); }
th, td { padding: 4px 8px; border-bottom: 1px dotted var(--ink); text-align: right; vertical-align: top; background: var(--paper); }
thead th { position: sticky; top: 0; z-index: 1; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--ink); }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.name { text-align: left; font-weight: 500; white-space: nowrap; }
.eq { text-align: left; color: var(--muted); min-width: 24ch; }
code { display: block; font: 10.5px/1.35 var(--font-data); color: var(--ink); opacity: .75; }
.name code { font-weight: 400; }
tr.group th { text-align: left; padding-top: 12px; border-bottom: 1px solid var(--ink); }
/* The figures the change moves stand out. */
tr.moved td, tr.moved th { background: color-mix(in oklab, var(--accent) 12%, var(--paper)); }
.d { font-weight: 700; }
.buttons { display: flex; justify-content: flex-end; }
.pr[open] .box { animation: pop 220ms var(--ease-out) both; }
.pr[open]::backdrop { animation: fade 220ms var(--ease-out) both; }
@keyframes pop { from { opacity: 0; transform: scale(0.97); } }
@keyframes fade { from { opacity: 0; } }
@media (max-width: 760px) { .eq { min-width: 18ch; } }
</style>
