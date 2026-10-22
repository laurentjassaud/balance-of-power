import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import { Game, verbsForLevel, type GameSnapshot } from '../engine/game'
import { NO_CNTRY, USA, USSR, Verb, type Level, type NewsItem } from '../engine/core'
import { SHAPES } from '../engine/init'
import { VERB_LABEL, levelLabel } from '../engine/news'
import { INDICATORS, indicator, bgValue, bgFormat, bgTitle, type Per } from '../engine/background'
import { DEBUG_VERBS, project, currentState, challengeOdds, type PolicyReport } from '../engine/policyDebug'

export type MapMode =
  | 'align' | 'relations' | 'prestige' | 'turmoil' | 'support' | 'finl' | 'finlMe' | 'wars' | 'events' | 'pop' | 'gnp' | 'army' | 'wing'
  | `policy:${Verb}:${1 | 2}`
  | `bg:${number}`
  | `sel:${'rel' | 'war' | Verb}`

/** Background figures for the mode selector, by group as in the original's menus. */
export const BG_GROUPS: { group: string; modes: { id: MapMode; label: string }[] }[] = [...new Set(INDICATORS.map((i) => i.group))]
  .map((group) => ({ group, modes: INDICATORS.filter((i) => i.group === group).map((i) => ({ id: `bg:${i.id}` as MapMode, label: i.label })) }))

/** Situation maps (the original's Countries menu); minLevel hides those that only make sense higher up. */
export const MAP_MODES: { id: MapMode; label: string; minLevel?: number }[] = [
  { id: 'align', label: 'Sphères d’influence' },
  { id: 'relations', label: 'Relations avec nous' },
  { id: 'prestige', label: 'Prestige' },
  { id: 'turmoil', label: 'Troubles intérieurs' },
  { id: 'support', label: 'Soutien au gouvernement' },
  { id: 'finl', label: 'Finlandisation vers l’adversaire' },
  { id: 'finlMe', label: 'Finlandisation vers nous' },
  { id: 'wars', label: 'Pays en guerre', minLevel: 4 },
  { id: 'events', label: 'Événements de l’année' },
  { id: 'wing', label: 'Orientation du régime' },
  { id: 'pop', label: 'Population' },
  { id: 'gnp', label: 'PNB' },
  { id: 'army', label: 'Armée' },
]

/**
 * Maps centred on the selected country (the original's Relations menu): its relations with every other country,
 * and from level 4, when minor countries run their own policies, what it sends or receives and whom it fights.
 */
export const SEL_MODES: { id: MapMode; label: string; minLevel?: number; verb?: Verb }[] = [
  { id: 'sel:rel', label: 'Ses relations' },
  { id: `sel:${Verb.MilAid}`, label: 'Aide militaire', minLevel: 4, verb: Verb.MilAid },
  { id: `sel:${Verb.InsgAid}`, label: 'Armes aux rebelles', minLevel: 4, verb: Verb.InsgAid },
  { id: `sel:${Verb.IntvGovt}`, label: 'Troupes pour le gouvernement', minLevel: 4, verb: Verb.IntvGovt },
  { id: `sel:${Verb.IntvRebl}`, label: 'Troupes pour les rebelles', minLevel: 4, verb: Verb.IntvRebl },
  { id: 'sel:war', label: 'En guerre avec', minLevel: 4 },
]

// Maps and charts use only the seven colours of the nuancier, from dark to orange: rival superpower, its two grey
// shades, light grey neutral, the player's two orange shades, player superpower. The two ends are kept for the superpowers.
const SUPER_RIVAL = '#1a1c1d'
const SUPER_ME = '#fe7c2c'
const LAND = '#c4c7ca'
/** Rival side → neutral → player's side: the five shades between the superpowers. */
const DIVERGING = ['#4c4c4e', '#747679', LAND, '#eebe9f', '#fd9e5d']
/** Lowest → highest, where the superpowers take their class colour: the same five shades. */
const SEQUENTIAL = DIVERGING
/** Beside the fixed superpowers, each side only has its two shades: none → strongest, three classes. */
const POLICY_ME = [LAND, '#eebe9f', '#fd9e5d']
const POLICY_RIVAL = [LAND, '#747679', '#4c4c4e']
/** Class limits of each mode: a value at or above cuts[i] is in class i + 1. */
export const CUTS: Partial<Record<string, number[]>> = {
  relations: [-60, -15, 16, 60], prestige: [20, 60, 300, 1500], turmoil: [1, 2, 3, 4],
  support: [1, 4, 8, 12], finl: [56, 104], finlMe: [56, 104], pop: [5, 15, 40, 100], gnp: [5, 20, 60, 200], army: [20, 60, 150, 400],
  wing: [-40, -10, 11, 41], events: [1, 2, 3], wars: [1], 'sel:rel': [-60, -15, 16, 60], 'sel:war': [1],
}
/** Policies: none, levels 1–2, levels 3–5. */
const POLICY_CUTS = [1, 3]
/** Modes whose classes are categories rather than ranges of a number: the strip groups them instead of placing them on a scale. */
export const CATEGORICAL = new Set(['turmoil', 'events', 'wars', 'sel:war'])
const AT_WAR = { colors: [LAND, '#4c4c4e'], labels: ['En paix', 'En guerre'] }
const TURMOIL = ['aucune', 'faible', 'sérieuse', 'guerre civile', 'au bord de la chute']

/** Legend of each situation mode: title, colour of each class, label of each class. */
const LEGENDS = {
  relations: { title: 'Relations avec nous', colors: DIVERGING, labels: ['Hostile', 'Froide', 'Neutre', 'Bonne', 'Amicale'] },
  prestige: { title: 'Prestige', colors: SEQUENTIAL, labels: ['< 20', '20 – 59', '60 – 299', '300 – 1 499', '≥ 1 500'] },
  turmoil: { title: 'Troubles intérieurs', colors: SEQUENTIAL, labels: ['Calme', 'Faible insurrection', 'Insurrection sérieuse', 'Guerre civile', 'Au bord de la chute'] },
  support: { title: 'Soutien au gouvernement', colors: SEQUENTIAL, labels: ['Très populaire (≥ 12)', 'Populaire (8 – 11)', 'Moyen (4 – 7)', 'Faible (1 – 3)', 'Nul (≤ 0)'] },
  finl: { title: 'Risque de finlandisation', colors: POLICY_RIVAL, labels: ['< 56', '56 – 103', '≥ 104'] }, // toward the rival
  finlMe: { title: 'Risque de finlandisation', colors: POLICY_ME, labels: ['< 56', '56 – 103', '≥ 104'] }, // toward the player
  wars: { title: 'Pays en guerre', ...AT_WAR },
  events: { title: 'Événements de l’année', colors: [LAND, '#eebe9f', '#fd9e5d', '#4c4c4e'], labels: ['Rien', 'Finlandisation', 'Coup d’État', 'Révolution'] },
  wing: { title: 'Orientation du régime', colors: DIVERGING, labels: ['Gauche radicale', 'Gauche', 'Centre', 'Droite', 'Droite dure'] },
  pop: { title: 'Population', colors: SEQUENTIAL, labels: ['< 5 M', '5 – 15 M', '15 – 40 M', '40 – 100 M', '≥ 100 M'] },
  gnp: { title: 'PNB', colors: SEQUENTIAL, labels: ['< 5 Md$', '5 – 20 Md$', '20 – 60 Md$', '60 – 200 Md$', '≥ 200 Md$'] },
  army: { title: 'Armée', colors: SEQUENTIAL, labels: ['< 20 000', '20 – 60 000', '60 – 150 000', '150 – 400 000', '≥ 400 000'] },
}

/** Centre of each country outline, for labels and markers. */
export const CENTERS: Record<number, [number, number]> = (() => {
  const out: Record<number, [number, number]> = {}
  for (const [id, paths] of Object.entries(SHAPES)) {
    let sx = 0, sy = 0, n = 0
    let best: [number, number] = [0, 0]
    let bestArea = -1
    for (const d of paths) {
      const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i + 1 < nums.length; i += 2) {
        sx += nums[i]; sy += nums[i + 1]; n++
        minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i])
        minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1])
      }
      const area = (maxX - minX) * (maxY - minY)
      if (area > bestArea) { bestArea = area; best = [(minX + maxX) / 2, (minY + maxY) / 2] }
    }
    out[+id] = n ? best : [sx / n, sy / n]
  }
  return out
})()

/** localStorage key of the game in progress; bump SAVE_VERSION when the snapshot format changes. */
const SAVE_KEY = 'balance-of-power/partie'
const SAVE_VERSION = 1
export type Tab = 'country' | 'news' | 'scores' | 'logs'
interface Save { v: number; game: GameSnapshot; mapMode: MapMode; selected: number; tab: Tab; bgPer?: Per; selDir?: 'out' | 'in' }

export const useGameStore = defineStore('game', () => {
  const game = shallowRef<Game | null>(null)
  /** Bumped after every change to the engine state, which is not reactive itself. */
  const version = ref(0)
  const selected = ref(0)
  const mapMode = ref<MapMode>('align')
  const tab = ref<Tab>('news')
  const focusNews = shallowRef<NewsItem | null>(null)
  /** Country whose newspaper is open, 0 when closed. */
  const journal = ref(0)
  /** Country whose history is open, 0 when closed. */
  const history = ref(0)
  /** Debug mode: the full view of the calculation journal is open. */
  const logsWindow = ref(false)
  /** Debug mode: the projected effects of the policy change just made, while their report is open. */
  const policyReport = shallowRef<PolicyReport | null>(null)
  /** Divisor of the background figure on display. */
  const bgPer = ref<Per>('none')
  /** Maps of the selected country's policies: what it sends out, or what it receives (the original's Going Out / Going In). */
  const selDir = ref<'out' | 'in'>('out')

  const w = computed(() => {
    void version.value
    return game.value?.w ?? null
  })

  function touch() {
    version.value++
  }

  // The game in progress is saved in localStorage after every change, with the map view, and resumed on the next visit.
  // Storage can be blocked or full: the game then simply goes on unsaved.
  function persist() {
    try {
      if (!game.value) { localStorage.removeItem(SAVE_KEY); return }
      const save: Save = { v: SAVE_VERSION, game: game.value.snapshot(), mapMode: mapMode.value, selected: selected.value, tab: tab.value, bgPer: bgPer.value, selDir: selDir.value }
      localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    } catch { /* not saved */ }
  }
  function resume() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return
      const save = JSON.parse(raw) as Save
      if (save.v !== SAVE_VERSION) throw new Error('old save')
      game.value = markRaw(Game.restore(save.game))
      mapMode.value = save.mapMode
      selected.value = save.selected
      tab.value = save.tab
      bgPer.value = save.bgPer ?? 'none'
      selDir.value = save.selDir ?? 'out'
    } catch {
      game.value = null
      try { localStorage.removeItem(SAVE_KEY) } catch { /* storage blocked */ }
    }
  }
  resume()
  watch([version, selected, mapMode, tab, bgPer, selDir], persist)

  function newGame(level: Level, human: number, twoPlayer: boolean, debug = false) {
    game.value = markRaw(new Game({ level, human: human as 1 | 2, twoPlayer, debug, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }))
    selected.value = 0
    focusNews.value = null
    tab.value = 'news'
    journal.value = 0
    history.value = 0
    logsWindow.value = false
    policyReport.value = null
    touch()
  }

  function quit() {
    game.value = null
    journal.value = 0
    history.value = 0
    logsWindow.value = false
    policyReport.value = null
    touch()
  }

  function nextTurn() {
    if (!game.value) return
    game.value.nextTurn()
    focusNews.value = null
    touch()
  }

  function handOver() {
    game.value?.handOver()
    touch()
  }

  function setPolicy(country: number, verb: Verb, value: number) {
    const g = game.value
    // Debug mode: a change to the weapons or troops sent opens a report of its projected effects.
    const watched = !!g?.w.debug && DEBUG_VERBS.includes(verb)
    const now = watched ? currentState(g!.w, country) : null
    const before = watched ? project(g!.w, country) : null
    const ok = g?.setPolicy(country, verb, value) ?? false
    if (ok && g && now && before) {
      const w = g.w
      const it = w.news.find((n) => n.subject === w.human && n.verb === verb && n.object === country)
      policyReport.value = {
        country, verb, sp: w.human, oldVal: it?.oldVal ?? value, newVal: value, year: w.year,
        now, before, after: project(w, country), odds: it ? challengeOdds(w, it) : null,
      }
    }
    touch()
    return ok
  }

  function challenge(item: NewsItem) {
    game.value?.challenge(item)
    touch()
  }

  function respond(escalate: boolean) {
    game.value?.respondCrisis(escalate)
    touch()
  }

  function closeCrisis() {
    game.value?.closeCrisis()
    touch()
  }

  const verbs = computed(() => (w.value ? verbsForLevel(w.value.level) : []))
  /** One map mode per policy and superpower, for the mode selector. */
  const policyModes = computed(() =>
    verbs.value.flatMap((v) => [
      { id: `policy:${v}:1` as MapMode, label: `${VERB_LABEL[v]} (USA)` },
      { id: `policy:${v}:2` as MapMode, label: `${VERB_LABEL[v]} (URSS)` },
    ]),
  )

  /** The player's superpower (orange) and the rival (black). In two-player mode the USA keep orange so colours do not swap every turn. */
  const me = computed(() => (w.value && !w.value.twoPlayer ? w.value.human : USA))
  const rival = computed(() => (me.value === USA ? USSR : USA))
  const sideName = (sp: number) => (sp === USA ? 'USA' : 'URSS')
  const sideFull = (sp: number) => (sp === USA ? 'les États-Unis' : 'l’URSS')
  /** Maps centred on the selected country wait for one to be picked. */
  const needsSel = computed(() => mapMode.value.startsWith('sel:') && !selected.value)

  /** Background figure on display, if any; its divisor falls back to the first one it offers. */
  const bgInd = computed(() => (mapMode.value.startsWith('bg:') ? indicator(+mapMode.value.slice(3)) : undefined))
  const bgDiv = computed<Per>(() => (bgInd.value?.per.includes(bgPer.value) ? bgPer.value : 'none'))

  /** Numeric value of a country in the current map mode (for policies, the level 0..5; background figures in real units). */
  function value(c: number): number {
    const world = w.value!
    const m = mapMode.value
    if (bgInd.value) return bgValue(world, bgInd.value, bgDiv.value, c)
    const s = selected.value
    switch (m) {
      // As in the original: the country's DontMess, the sphere index the crises read, against the world average;
      // in % of the average, positive on the player's side.
      case 'align': { const ave = world.sumDMess / NO_CNTRY, index = ((world.dontMess[c] - ave) / ave) * 100; return me.value === USA ? index : -index }
      case 'relations': return world.dipAff[world.human][c]
      case 'prestige': return world.prestVal[c]
      case 'turmoil': { const r = world.strngRat[c]; return r >= 512 ? 0 : r >= 32 ? 1 : r >= 8 ? 2 : r >= 2 ? 3 : 4 }
      case 'support': return world.gPopular[c]
      case 'finl': return world.finlProb[rival.value][c]
      case 'finlMe': return world.finlProb[me.value][c]
      case 'wars': { if (c < 3) return 0; for (let j = 3; j <= NO_CNTRY; j++) if (world.dipAff[c][j] === -127) return 1; return 0 }
      case 'pop': return world.popln[c] / 10
      case 'gnp': return world.gnp[c] / 5
      case 'army': return world.milMen[c]
      case 'wing': return world.govtWing[c]
      case 'events': return world.rebWinFlag[c] ? 3 : world.coupFlag[c] ? 2 : world.finlFlag[c] ? 1 : 0
      case 'sel:rel': return world.dipAff[s][c]
      case 'sel:war': return s > 2 && c > 2 && (world.dipAff[s][c] === -127 || world.dipAff[c][s] === -127) ? 1 : 0
      default: {
        if (m.startsWith('sel:')) { const verb = +m.slice(4) as Verb; return selDir.value === 'out' ? world.getPolicy(s, verb, c) : world.getPolicy(c, verb, s) }
        const [, verb, sp] = m.split(':').map(Number)
        return world.getPolicy(sp, verb as Verb, c)
      }
    }
  }

  /**
   * Class limits of the current mode: a value at or above cuts[i] is in class i + 1. Background figures have no
   * set limits, so they are cut at their quintiles, about sixteen countries a class.
   */
  const cuts = computed<number[]>(() => {
    void version.value
    const m = mapMode.value
    // Sphere classes come from the original's integer index (see classify); these limits only draw the strip's scale.
    if (m === 'align') return me.value === USA ? [-40, 20, 40] : [-40, -20, 40]
    if (!bgInd.value) return CUTS[m] ?? POLICY_CUTS
    if (!w.value) return []
    const sorted = Array.from({ length: NO_CNTRY }, (_, i) => value(i + 1)).sort((a, b) => a - b)
    return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * sorted.length)])
  })

  /** A value of the current mode as the strip's scale shows it. */
  function fmtTick(d: number): string {
    return bgInd.value ? bgFormat(bgInd.value, bgDiv.value, d) : Math.round(d).toLocaleString('fr-FR')
  }

  /** Class (0..4, or -1 for "no data"), value and value text of a country in the current map mode. */
  function classify(c: number): { k: number; n: number; v: string } {
    const world = w.value
    if (!world) return { k: -1, n: 0, v: '' }
    const m = mapMode.value
    if (m.startsWith('sel:') && (!selected.value || c === selected.value)) return { k: -1, n: 0, v: '' }
    const n = value(c)
    let k = 0
    if (m === 'align') {
      // The original's Spheres display: t = DontMess × 400 / total, cut at 3, 6 and 7 (USSR solid, USSR weak, USA weak, USA solid).
      const t = Math.trunc((world.dontMess[c] * 400) / world.sumDMess)
      const usa = t <= 2 ? 0 : t <= 5 ? 1 : t === 6 ? 2 : 3
      k = me.value === USA ? usa : 3 - usa
    } else while (k < cuts.value.length && n >= cuts.value[k]) k++
    if (m === 'support') k = 4 - k // the less popular the government, the hotter the colour
    const signed = (x: number) => (x > 0 ? `+${x}` : `${x}`)
    const fr = (x: number) => x.toLocaleString('fr-FR')
    const v = (() => {
      if (bgInd.value) return bgFormat(bgInd.value, bgDiv.value, n)
      switch (m) {
        case 'align': return signed(Math.round(n))
        case 'relations': case 'wing': case 'sel:rel': return signed(n)
        case 'turmoil': return TURMOIL[n]
        case 'pop': return `${fr(n)} M`
        case 'gnp': return `${fr(n)} Md$`
        case 'army': return `${fr(n)} k`
        case 'events': return ['', 'finlandisé', 'coup d’État', 'révolution'][n]
        case 'wars': case 'sel:war': return n ? 'en guerre' : ''
        case 'prestige': case 'support': case 'finl': case 'finlMe': return `${n}`
        default: { const verb = m.startsWith('sel:') ? +m.slice(4) : +m.split(':')[1]; return n ? levelLabel(verb as Verb, n) : '' }
      }
    })()
    return { k: Math.min(k, 4), n, v }
  }

  /** Modes where the two superpowers keep their own colour and are left out of the counts. */
  const fixedSuper = computed(() => {
    const m = mapMode.value
    if (bgInd.value || (m.startsWith('sel:') && m !== 'sel:war')) return false // the superpowers are countries like the others there
    return !['prestige', 'pop', 'gnp', 'army', 'turmoil', 'support', 'wing'].includes(m)
  })

  /** Colours and labels of the stepped legend for the current mode. */
  const legend = computed(() => {
    void version.value
    const m = mapMode.value
    const bgLabels = () => {
      const f = (x: number) => bgFormat(bgInd.value!, bgDiv.value, x), q = cuts.value
      return [`< ${f(q[0])}`, ...q.slice(1).map((x, i) => `${f(q[i])} – ${f(x)}`), `≥ ${f(q[q.length - 1])}`]
    }
    const who = selected.value && w.value ? w.value.names[selected.value] : 'pays choisi'
    const def = bgInd.value
      ? { title: bgTitle(bgInd.value, bgDiv.value), colors: SEQUENTIAL, labels: bgLabels() }
      : m.startsWith('policy:')
      ? { title: policyModes.value.find((x) => x.id === m)?.label ?? '', colors: +m.split(':')[2] === me.value ? POLICY_ME : POLICY_RIVAL, labels: ['Aucune', 'Niveau 1 – 2', 'Niveau 3 – 5'] }
      : m === 'align'
        // Four classes, no neutral one, as in the original; rival side first.
        ? { title: 'Sphères d’influence', colors: ['#4c4c4e', '#747679', '#eebe9f', '#fd9e5d'], labels: [`Sphère ${sideName(rival.value)} solide`, `Sphère ${sideName(rival.value)} fragile`, `Sphère ${sideName(me.value)} fragile`, `Sphère ${sideName(me.value)} solide`] }
        : m === 'finl' || m === 'finlMe'
          ? { ...LEGENDS[m], title: `Finlandisation vers ${sideFull(m === 'finl' ? rival.value : me.value)}` }
          : m === 'sel:rel'
            ? { title: `Relations · ${who}`, colors: DIVERGING, labels: ['Hostile', 'Froide', 'Neutre', 'Bonne', 'Amicale'] }
            : m === 'sel:war'
              ? { title: `En guerre avec · ${who}`, ...AT_WAR }
              : m.startsWith('sel:')
                ? { title: `${VERB_LABEL[+m.slice(4) as Verb]} · ${selDir.value === 'out' ? `${who} → autres pays` : `autres pays → ${who}`}`, colors: [LAND, '#747679', '#4c4c4e'], labels: ['Aucune', 'Niveau 1 – 2', 'Niveau 3 – 5'] }
                : m === 'wing' && me.value === USSR
                  ? { ...LEGENDS.wing, colors: [...DIVERGING].reverse() } // the left is the USSR's side
                  : LEGENDS[m as keyof typeof LEGENDS]
    const counts = def.colors.map(() => 0)
    if (w.value) for (let c = 1; c <= NO_CNTRY; c++) {
      if (fixedSuper.value && (c === USA || c === USSR)) continue
      const k = classify(c).k
      if (k >= 0 && k < counts.length) counts[k]++
    }
    return { ...def, counts }
  })

  /** Fill colour of a country in the current map mode. */
  function fill(c: number): string {
    if (!w.value) return LAND
    if (fixedSuper.value && c === me.value) return SUPER_ME
    if (fixedSuper.value && c === rival.value) return SUPER_RIVAL
    const k = classify(c).k
    return legend.value.colors[k] ?? LAND
  }

  const countries = computed(() => {
    void version.value
    return Array.from({ length: NO_CNTRY }, (_, i) => i + 1)
  })

  /** Rank of a country on the background figure on display, 1 for the highest, as the original's relative view. */
  function bgRank(c: number): { rank: number; of: number; v: string } | null {
    if (!bgInd.value || !w.value || !c) return null
    const mine = value(c)
    let rank = 1
    for (let i = 1; i <= NO_CNTRY; i++) if (value(i) > mine) rank++
    return { rank, of: NO_CNTRY, v: bgFormat(bgInd.value, bgDiv.value, mine) }
  }

  return {
    game, version, w, selected, mapMode, tab, focusNews, journal, history, logsWindow, policyReport, bgPer, bgInd, bgDiv, selDir, needsSel, cuts, verbs, countries,
    newGame, quit, nextTurn, handOver, setPolicy, challenge, respond, closeCrisis, fill, classify, value, legend, fixedSuper, policyModes, me, rival, touch,
    fmtTick, bgRank,
  }
})
