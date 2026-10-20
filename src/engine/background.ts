import { World } from './core'
import { ARCHIVES } from './archives'

// The Background displays of the original (Briefing › Background, Background.p): six figures of the game's own
// economy, which can be divided by population or GNP, and 23 real-world statistics of the 1980s kept in the
// resources. Values here are in real units, so they can be shown as the reader expects them.

/** What a figure is divided by: nothing, the population, or the GNP. */
export type Per = 'none' | 'capita' | 'gnp'

export interface Indicator {
  /** Number in the original (STR# 601): 1–6 game figures, 7–29 archives. */
  id: number
  group: string
  label: string
  /** Divisors offered, the first being the default. */
  per: readonly Per[]
  /** Value in real units before any divisor. */
  raw: (w: World, c: number) => number
  /** Value as read, for each divisor. */
  fmt: Partial<Record<Per, (v: number) => string>>
}

const fr = (v: number, digits = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
/** One decimal under 10, none above: 2,4 · 37 · 1 690. */
const num = (v: number) => fr(v, Math.abs(v) < 10 ? 1 : 0)
const money = (v: number) => (Math.abs(v) >= 1e9 ? `${num(v / 1e9)} Md$` : `${num(v / 1e6)} M$`)
const share = (v: number) => `${num(v * 100)} %`
const archive = (a: number, factor = 1) => (_w: World, c: number) => ARCHIVES[a][c] * factor

export const INDICATORS: readonly Indicator[] = [
  // Resources: the game's figures (GNP and spending in units of 200 M$ or 10 M$, population in 100 000, troops in 1 000).
  { id: 1, group: 'Ressources', label: 'PNB', per: ['none', 'capita'], raw: (w, c) => w.gnp[c] * 2e8, fmt: { none: money, capita: (v) => `${num(v)} $ par hab.` } },
  { id: 2, group: 'Ressources', label: 'Dépenses militaires', per: ['none', 'capita', 'gnp'], raw: (w, c) => w.miltSpnd[c] * 1e7, fmt: { none: money, capita: (v) => `${num(v)} $ par hab.`, gnp: share } },
  { id: 3, group: 'Ressources', label: 'Consommation', per: ['none', 'capita', 'gnp'], raw: (w, c) => w.consSpnd[c] * 2e8, fmt: { none: money, capita: (v) => `${num(v)} $ par hab.`, gnp: share } },
  { id: 4, group: 'Ressources', label: 'Investissement', per: ['none', 'capita', 'gnp'], raw: (w, c) => w.invtSpnd[c] * 2e8, fmt: { none: money, capita: (v) => `${num(v)} $ par hab.`, gnp: share } },
  { id: 5, group: 'Ressources', label: 'Population', per: ['none'], raw: (w, c) => w.popln[c] * 1e5, fmt: { none: (v) => `${num(v / 1e6)} M hab.` } },
  { id: 6, group: 'Ressources', label: 'Effectifs militaires', per: ['none', 'capita'], raw: (w, c) => w.milMen[c] * 1e3, fmt: { none: (v) => `${fr(v)} hommes`, capita: (v) => `${num(v * 1000)} pour 1 000 hab.` } },
  // Well-being. The original labels energy in pounds, but its figures are kilograms (about 11 t for the USA).
  { id: 7, group: 'Bien-être', label: 'Alphabétisation', per: ['none'], raw: archive(1), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 8, group: 'Bien-être', label: 'Énergie par habitant', per: ['none'], raw: archive(2), fmt: { none: (v) => `${fr(v)} kg éq. charbon` } },
  { id: 9, group: 'Bien-être', label: 'Calories par jour', per: ['none'], raw: archive(3), fmt: { none: (v) => `${fr(v)} kcal` } },
  { id: 10, group: 'Bien-être', label: 'Médecins', per: ['none'], raw: archive(4), fmt: { none: (v) => `${fr(v)} par M hab.` } },
  { id: 11, group: 'Bien-être', label: 'Mortalité infantile', per: ['none'], raw: archive(5), fmt: { none: (v) => `${fr(v)} ‰` } },
  { id: 12, group: 'Bien-être', label: 'Scolarisation', per: ['none'], raw: archive(6), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 13, group: 'Bien-être', label: 'Téléviseurs', per: ['none'], raw: archive(7, 0.1), fmt: { none: (v) => `${num(v)} pour 1 000 hab.` } },
  { id: 14, group: 'Bien-être', label: 'Téléphones', per: ['none'], raw: archive(8, 0.1), fmt: { none: (v) => `${num(v)} pour 1 000 hab.` } },
  // Violence: counts over the period of the source, which the original could also divide by population.
  { id: 15, group: 'Violence', label: 'Manifestations', per: ['none', 'capita'], raw: archive(9), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 16, group: 'Violence', label: 'Morts de la violence politique', per: ['none', 'capita'], raw: archive(10, 100), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 17, group: 'Violence', label: 'Émeutes', per: ['none', 'capita'], raw: archive(11), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 18, group: 'Violence', label: 'Attaques armées', per: ['none', 'capita'], raw: archive(12), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 19, group: 'Violence', label: 'Assassinats', per: ['none', 'capita'], raw: archive(13), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 20, group: 'Violence', label: 'Exécutions politiques', per: ['none', 'capita'], raw: archive(14), fmt: { none: (v) => fr(v), capita: (v) => `${num(v * 1e6)} par M hab.` } },
  { id: 21, group: 'Politique', label: 'Droits politiques', per: ['none'], raw: archive(15), fmt: { none: (v) => `${fr(v)} pts` } },
  { id: 22, group: 'Politique', label: 'Libertés civiles', per: ['none'], raw: archive(16), fmt: { none: (v) => `${fr(v)} pts` } },
  { id: 23, group: 'Économie (% du PNB)', label: 'Agriculture', per: ['none'], raw: archive(17), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 24, group: 'Économie (% du PNB)', label: 'Industrie', per: ['none'], raw: archive(18), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 25, group: 'Économie (% du PNB)', label: 'Services', per: ['none'], raw: archive(19), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 26, group: 'Économie (% du PNB)', label: 'Commerce extérieur', per: ['none'], raw: archive(20), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 27, group: 'Économie (% du PNB)', label: 'Impôts', per: ['none'], raw: archive(21), fmt: { none: (v) => `${fr(v)} %` } },
  { id: 28, group: 'Économie (% du PNB)', label: 'Éducation publique', per: ['none'], raw: archive(22, 0.1), fmt: { none: (v) => `${num(v)} %` } },
  { id: 29, group: 'Économie (% du PNB)', label: 'Santé publique', per: ['none'], raw: archive(23, 0.1), fmt: { none: (v) => `${num(v)} %` } },
]

export const PER_LABEL: Record<Per, string> = { none: 'Brut', capita: 'Par habitant', gnp: '% du PNB' }

export function indicator(id: number): Indicator | undefined {
  return INDICATORS.find((i) => i.id === id)
}

/** Value of a country, divided as asked (population and GNP in real units too). */
export function bgValue(w: World, ind: Indicator, per: Per, c: number): number {
  const v = ind.raw(w, c)
  if (per === 'capita') return v / Math.max(1, w.popln[c] * 1e5)
  if (per === 'gnp') return v / Math.max(1, w.gnp[c] * 2e8)
  return v
}

export function bgFormat(ind: Indicator, per: Per, v: number): string {
  return (ind.fmt[per] ?? ind.fmt.none!)(v)
}

/** Title of the display: the figure and its divisor. */
export function bgTitle(ind: Indicator, per: Per): string {
  return per === 'capita' ? `${ind.label} par habitant` : per === 'gnp' ? `${ind.label} (% du PNB)` : ind.label
}
