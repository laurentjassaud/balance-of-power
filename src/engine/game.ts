import { World, Rng, USA, USSR, Verb, NO_CNTRY, FIRST_YEAR, div, econConv, milAidConv, intvConv, type Level, type NewsItem } from './core'
import { createWorld, type NewGameOptions } from './init'
import { Crisis, computerCrisis, type CrisisSnapshot, type NewsRef } from './crisis'
import {
  prePlanMove, developCountries, computerAI, minorAI, annualReactions, closeYear,
} from './simulation'
import { VERB_LABEL, levelLabel } from './news'

/** Eight years of play, as in the original. */
export const LAST_YEAR = FIRST_YEAR + 8

/** Policies the human can use, by difficulty level. */
export function verbsForLevel(level: Level): Verb[] {
  const v = [Verb.MilAid, Verb.InsgAid, Verb.IntvGovt, Verb.IntvRebl]
  if (level >= 2) v.push(Verb.Econ, Verb.Destab)
  if (level >= 3) v.push(Verb.Treaty, Verb.Pressure)
  if (level >= 4) v.push(Verb.Trade)
  return v
}

/** Plain data of a game, for saving: the world and its generator, plus a crisis or the computer's pending reactions mid-year. */
export interface GameSnapshot {
  world: Record<string, unknown>
  rng: number
  crisis: CrisisSnapshot | null
  reacting: boolean
  reactQueue: NewsRef[]
  reactIdx: number
}

export interface PolicyLimits {
  current: number
  min: number
  max: number
  /** Remaining resource, for weapons, troops and economic aid. */
  available: number | null
}

/**
 * One game: the world plus the turn sequence of the original
 * (pre-move, reactions to the news with possible crises, main move).
 */
export class Game {
  readonly w: World
  crisis: Crisis | null = null
  /** True while the computer is reacting to the news of the year (a crisis may interrupt it). */
  private reacting = false
  private reactQueue: NewsItem[] = []
  private reactIdx = 0

  constructor(opts: NewGameOptions) {
    this.w = createWorld(opts)
    this.w.log?.add({
      kind: 'tour', step: 'Partie', country: 0, title: 'Nouvelle partie', result: `niveau ${opts.level}, graine ${opts.seed ?? '—'}`,
      data: { level: opts.level, seed: opts.seed ?? '', human: this.w.names[this.w.human], twoPlayer: this.w.twoPlayer, nastiness: this.w.nastiness },
      lines: [
        `Joueur : ${this.w.nm(this.w.human)}${this.w.twoPlayer ? ' (deux joueurs)' : ''} · tension initiale ${this.w.nastiness}`,
        'L’année de départ est jouée automatiquement pour fixer les scores de référence.',
      ],
    })
    // The first year is played automatically to set the baseline.
    this.advance()
  }

  get over(): boolean {
    return this.w.ended !== null
  }

  // ---------------------------------------------------------------- saving

  /** Plain data of the whole game. News items shared with the crisis or the reactions are saved as indexes into the world's news. */
  snapshot(): GameSnapshot {
    const w = this.w
    const ref = (it: NewsItem): NewsRef => { const i = w.news.indexOf(it); return i >= 0 ? i : it }
    return {
      world: Object.fromEntries(Object.entries(w).filter(([k]) => k !== 'rng' && k !== 'log')),
      rng: w.rng.state,
      crisis: this.crisis?.snapshot(ref) ?? null,
      reacting: this.reacting,
      reactQueue: this.reactQueue.map(ref),
      reactIdx: this.reactIdx,
    }
  }

  /** A game resumed from a snapshot, exactly where it was (its first year is not played again). */
  static restore(s: GameSnapshot): Game {
    const w = Object.assign(new World(1), s.world, { rng: Rng.fromState(s.rng) })
    // The debug journal is not saved: a resumed game starts a fresh one.
    if (w.debug) {
      w.setDebug(true)
      w.log?.add({
        kind: 'tour', step: 'Partie', country: 0, title: 'Partie reprise', result: `année ${w.year}`, data: { level: w.level },
        lines: ['Le journal n’est pas sauvegardé : les calculs antérieurs à la reprise ne sont plus disponibles.'],
      })
    }
    const deref = (r: NewsRef): NewsItem => (typeof r === 'number' ? w.news[r] : r)
    const g = Object.assign(Object.create(Game.prototype) as Game, { w })
    g.crisis = s.crisis ? Crisis.restore(w, s.crisis, deref) : null
    g.reacting = s.reacting
    g.reactQueue = s.reactQueue.map(deref)
    g.reactIdx = s.reactIdx
    return g
  }

  // ---------------------------------------------------------------- turn sequence

  /**
   * Ends the year. In two-player mode both sides must have played: the mouse has to change hands at least once.
   * It is not handed back at the new year, so the side that played second starts the next one, as in the original.
   */
  nextTurn(): void {
    if (this.over || this.crisis || this.reacting) return
    if (this.w.twoPlayer && !this.w.handedOver) return
    this.advance()
  }

  private advance(): void {
    const w = this.w
    // The year just played goes into the history, with the player's moves and its events (as the original saved it here).
    if (w.year >= FIRST_YEAR) w.recordYear()
    w.handedOver = false
    prePlanMove(w)
    this.reactQueue = [...w.news]
    this.reactIdx = 0
    this.reacting = true
    this.react()
  }

  private react(): void {
    const w = this.w
    while (this.reactIdx < this.reactQueue.length) {
      const it = this.reactQueue[this.reactIdx++]
      if (it.subject === it.object) continue
      const what = w.log ? `${w.nm(it.subject)} · ${VERB_LABEL[it.verb]} → ${w.nm(it.object)} (${it.oldVal} → ${it.newVal})` : ''
      if (
        it.subject < 3 &&
        (it.verb === Verb.IntvRebl || it.verb === Verb.InsgAid || it.verb === Verb.Destab || it.verb === Verb.Pressure)
      ) {
        const before = w.nastiness
        w.nastiness = Math.min(127, Math.max(1, w.nastiness + it.newVal - it.oldVal))
        w.log?.add({
          kind: 'tension', step: 'Action hostile', country: it.object, title: `Tension après ${what}`, result: `${before} → ${w.nastiness}`,
          data: { subject: w.names[it.subject], verb: VERB_LABEL[it.verb], oldVal: it.oldVal, newVal: it.newVal, nastiness0: before, nastiness: w.nastiness },
          lines: [`Action hostile d’une superpuissance : tension ${before} + (${it.newVal} − ${it.oldVal}), bornée 1..127 = ${w.nastiness}`],
        })
      }
      if (it.subject === w.human && it.newVal > it.oldVal && !w.twoPlayer && !it.crisis) {
        const g = w.gImpt(it.subject, it.verb, it.object, it.oldVal, it.newVal)
        let x = -g.total
        const z = w.cmptr === USA ? g.usa : g.ussr
        if (z < 0) x = 256
        const r = Math.abs(div(w.random(), 1024))
        w.log?.add({
          kind: 'crise', step: 'Examen d’une action du joueur', country: it.object, title: `L’ordinateur examine : ${what}`, result: x < r ? 'il conteste → crise' : 'il laisse faire',
          data: { verb: VERB_LABEL[it.verb], oldVal: it.oldVal, newVal: it.newVal, impt: g.total, imptUsa: g.usa, imptUssr: g.ussr, threshold: x, draw: r, challenged: x < r },
          lines: [
          ...w.gImptLines(it.subject, it.verb, it.object, it.oldVal, it.newVal),
          `Seuil = −importance totale = ${-g.total}${z < 0 ? ' → 256 (l’ordinateur y perd : il ne conteste jamais)' : ''}`,
          `Contestation si seuil ${x} < tirage |aléa / 1024| = ${r}`,
        ]})
        if (x < r) {
          // The computer questions the human's action.
          this.crisis = new Crisis(w, it, 'super')
          return
        }
      } else if (it.subject > 2 && it.newVal > it.oldVal && !w.twoPlayer && w.influence(w.cmptr, it.subject) > 3) {
        const g = w.gImpt(it.subject, it.verb, it.object, it.oldVal, it.newVal)
        const z = w.cmptr === USA ? g.usa : g.ussr
        const r = Math.abs(div(w.random(), 1024))
        w.log?.add({
          kind: 'crise', step: 'Examen d’une action d’un pays mineur', country: it.object, title: `L’ordinateur examine : ${what}`, result: z > r ? 'il conteste le pays mineur' : 'il laisse faire',
          data: { subject: w.names[it.subject], verb: VERB_LABEL[it.verb], oldVal: it.oldVal, newVal: it.newVal, influence: w.influence(w.cmptr, it.subject), impt: g.total, imptUsa: g.usa, imptUssr: g.ussr, threshold: z, draw: r, challenged: z > r },
          lines: [
          `Influence de l’ordinateur sur ${w.nm(it.subject)} = ${w.influence(w.cmptr, it.subject)} (> 3)`,
          ...w.gImptLines(it.subject, it.verb, it.object, it.oldVal, it.newVal),
          `Contestation si importance pour l’ordinateur ${z} > tirage ${r}`,
        ]})
        if (z > r) computerCrisis(w, it)
      }
    }
    this.reacting = false
    this.mainMove()
  }

  private mainMove(): void {
    const w = this.w
    w.news = []
    w.log?.add({ kind: 'tour', step: 'Coup principal', country: 0, title: `Coup principal de ${w.year}`, result: 'réactions, développement, ordinateur', data: {}, lines: [
      `${w.year > FIRST_YEAR ? 'Réactions annuelles des pays · ' : ''}développement des pays${w.twoPlayer ? '' : ' · décisions de l’ordinateur'}${w.level === 4 ? ' · politique des pays mineurs' : ''} · bilan de l’année`,
    ]})
    if (w.year > FIRST_YEAR) annualReactions(w)
    developCountries(w)
    if (!w.twoPlayer) computerAI(w)
    if (w.level === 4) minorAI(w)
    closeYear(w)
    if (w.year >= LAST_YEAR && !this.over) w.ended = 'peace'
  }

  /** Two-player mode: the other superpower takes the keyboard. */
  handOver(): void {
    const w = this.w
    if (!w.twoPlayer || this.over || this.crisis || this.reacting) return
    w.handedOver = true
    w.human = 3 - w.human
    w.cmptr = 3 - w.cmptr
  }

  // ---------------------------------------------------------------- crises

  canChallenge(it: NewsItem): boolean {
    const w = this.w
    if (this.over || this.crisis || this.reacting) return false
    if (it.subject === w.human || it.subject === it.object || it.newVal <= it.oldVal) return false
    if (it.verb === Verb.Trade) return false
    if (it.subject === w.cmptr) return !it.crisis
    // A minor country can be questioned only by a superpower with some hold on it, as in the original. The original
    // ignores the crisis mark here (MinorAI marks all its moves with it); an action is questioned only once, though.
    return w.level === 4 && it.subject > 2 && !it.questioned && w.influence(w.human, it.subject) > 3
  }

  challenge(it: NewsItem): Crisis | null {
    if (!this.canChallenge(it)) return null
    if (it.subject > 2) it.questioned = true
    this.crisis = new Crisis(this.w, it, it.subject <= 2 ? 'super' : 'minor')
    return this.crisis
  }

  respondCrisis(escalate: boolean): void {
    this.crisis?.respond(escalate)
  }

  /** Called by the interface once the outcome of a finished crisis has been shown. */
  closeCrisis(): void {
    if (!this.crisis?.over) return
    // A cancelled action leaves a withdrawal in the news; as in the original, the reactions still to come see it.
    const wd = this.reacting ? this.crisis.withdrawal() : undefined
    if (wd && !this.reactQueue.includes(wd)) this.reactQueue.splice(this.reactIdx, 0, wd)
    this.crisis = null
    if (this.reacting && !this.over) this.react()
  }

  // ---------------------------------------------------------------- human policies

  limits(country: number, verb: Verb): PolicyLimits {
    const w = this.w
    const h = w.human
    const dip = w.dipAff[h][country]
    const current = w.getPolicy(h, verb, country)
    let max = 5
    let min = 0
    let available: number | null = null
    const capBy = (avail: number, conv: (v: number) => number) => {
      let x = 5
      for (let i = 4; i >= 0; i--) if (conv(i + 1) > avail) x = i
      if (x < max) max = x
    }
    switch (verb) {
      case Verb.MilAid: {
        max = w.milMax(dip)
        const avail = div(w.miltSpnd[h], 8) + w.govtAid[h]
        capBy(avail, milAidConv)
        available = 2 * avail
        break
      }
      case Verb.InsgAid: {
        const r = w.strngRat[country]
        max = 0
        if (r < 512) max = 1
        if (r < 128) max = 2
        if (r < 32) max = 3
        if (r < 8) max = 4
        if (r < 2) max = 5
        max = Math.min(max, w.insgAMax(h, country))
        const avail = div(w.miltSpnd[h], 8) + w.govtAid[h]
        capBy(avail, milAidConv)
        available = 2 * avail
        break
      }
      case Verb.IntvGovt: {
        max = w.intvGMax(w.treaty[h][country], dip)
        const avail = div(w.milMen[h], 4) - w.totlIntv[h]
        capBy(avail, intvConv)
        available = avail
        break
      }
      case Verb.IntvRebl: {
        max = w.insgIMax(h, country)
        const avail = div(w.milMen[h], 4) - w.totlIntv[h]
        capBy(avail, intvConv)
        available = avail
        break
      }
      case Verb.Econ: {
        max = w.econAMax(dip)
        let sum = 0
        for (let i = 3; i <= NO_CNTRY; i++) sum += econConv(w.econAid[h][i])
        const avail = div(w.gnp[h], 44) - 2 * sum
        capBy(div(avail, 2) + econConv(current), econConv)
        available = avail
        break
      }
      case Verb.Treaty:
        max = Math.max(current, w.treatMax(w.integrity[h] + dip - w.pugnacity[h]))
        min = current
        break
    }
    // A policy already in place is never forced down by the dialog.
    if (max < current) max = current
    return { current, min, max: Math.max(0, max), available }
  }

  /**
   * What the side to play still has to give out, in the units the policies are shown in (see levelLabel): weapons in
   * M$ (one pool for the government and the rebels), troops in soldiers, economic aid in M$ a year (null below level 2).
   * Same pools as limits(), which caps the levels by them.
   */
  resources(): { arms: number; troops: number; econ: number | null } {
    const w = this.w
    const h = w.human
    let sum = 0
    for (let i = 3; i <= NO_CNTRY; i++) sum += econConv(w.econAid[h][i])
    return {
      arms: Math.max(0, div(w.miltSpnd[h], 8) + w.govtAid[h]) * 10,
      troops: Math.max(0, div(w.milMen[h], 4) - w.totlIntv[h]) * 1000,
      econ: verbsForLevel(w.level).includes(Verb.Econ) ? Math.max(0, div(div(w.gnp[h], 44) - 2 * sum, 2)) * 100 : null,
    }
  }

  setPolicy(country: number, verb: Verb, value: number): boolean {
    const w = this.w
    if (this.over || this.crisis || this.reacting || country < 3) return false
    if (!verbsForLevel(w.level).includes(verb)) return false
    const lim = this.limits(country, verb)
    if (value < lim.min || value > lim.max || value === lim.current) return false
    // Written before the move, so that its importance is the one the computer will weigh.
    const data = w.log ? { oldVal: lim.current, newVal: value, min: lim.min, max: lim.max, available: lim.available ?? '', ...w.imptData(w.human, verb, country, lim.current, value) } : {}
    const lines = w.log ? [
      `${levelLabel(verb, lim.current)} → ${levelLabel(verb, value)}`,
      `Bornes autorisées ${lim.min}..${lim.max}${lim.available !== null ? ` · ressource disponible ${lim.available}` : ''}`,
      ...w.gImptLines(w.human, verb, country, lim.current, value),
    ] : []
    w.doPolicy(w.human, verb, country, value, value <= lim.current)
    w.log?.add({ kind: 'joueur', step: VERB_LABEL[verb], country, title: `${w.nm(w.human)} · ${VERB_LABEL[verb]} → ${w.nm(country)}`, result: `${lim.current} → ${value}`, data, lines })
    return true
  }
}

export { USA, USSR }
