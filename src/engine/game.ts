import { World, Rng, USA, USSR, Verb, NO_CNTRY, FIRST_YEAR, div, econConv, milAidConv, intvConv, type Level, type NewsItem } from './core'
import { createWorld, type NewGameOptions } from './init'
import { Crisis, computerCrisis, type CrisisSnapshot, type NewsRef } from './crisis'
import {
  prePlanMove, developCountries, computerAI, minorAI, annualReactions, closeYear,
} from './simulation'

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
      world: Object.fromEntries(Object.entries(w).filter(([k]) => k !== 'rng')),
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
      if (
        it.subject < 3 &&
        (it.verb === Verb.IntvRebl || it.verb === Verb.InsgAid || it.verb === Verb.Destab || it.verb === Verb.Pressure)
      ) {
        w.nastiness = Math.min(127, Math.max(1, w.nastiness + it.newVal - it.oldVal))
      }
      if (it.subject === w.human && it.newVal > it.oldVal && !w.twoPlayer && !it.crisis) {
        const g = w.gImpt(it.subject, it.verb, it.object, it.oldVal, it.newVal)
        let x = -g.total
        const z = w.cmptr === USA ? g.usa : g.ussr
        if (z < 0) x = 256
        if (x < Math.abs(div(w.random(), 1024))) {
          // The computer questions the human's action.
          this.crisis = new Crisis(w, it, 'super')
          return
        }
      } else if (it.subject > 2 && it.newVal > it.oldVal && !w.twoPlayer && w.influence(w.cmptr, it.subject) > 3) {
        const g = w.gImpt(it.subject, it.verb, it.object, it.oldVal, it.newVal)
        const z = w.cmptr === USA ? g.usa : g.ussr
        if (z > Math.abs(div(w.random(), 1024))) computerCrisis(w, it)
      }
    }
    this.reacting = false
    this.mainMove()
  }

  private mainMove(): void {
    const w = this.w
    w.news = []
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

  setPolicy(country: number, verb: Verb, value: number): boolean {
    const w = this.w
    if (this.over || this.crisis || this.reacting || country < 3) return false
    if (!verbsForLevel(w.level).includes(verb)) return false
    const lim = this.limits(country, verb)
    if (value < lim.min || value > lim.max || value === lim.current) return false
    w.doPolicy(w.human, verb, country, value, value <= lim.current)
    return true
  }
}

export { USA, USSR }
