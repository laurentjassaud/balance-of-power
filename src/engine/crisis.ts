import { World, NO_CNTRY, USA, Verb, div, clamp, obligation, type NewsItem } from './core'

// Crises between superpowers (and between the human player and a minor country).
// The crisis level starts at 9 (back channel) and goes down at each escalation;
// level 1 means nuclear war.

export type CrisisKind = 'super' | 'minor'

export interface CrisisStep {
  /** Who acted at this step (1 = USA, 2 = USSR, or a minor country). */
  actor: number
  action: 'escalate' | 'backdown'
  level: number
}

/** Shown to the human before each decision. */
export interface CrisisBriefing {
  prestigeAtRisk: number
  /** 0..7, how much each superpower seems to care. */
  usaInterest: number
  ussrInterest: number
}

/** A saved news item: its index in the world's news when it is one of them, so that shared items stay shared. */
export type NewsRef = number | NewsItem

/** Plain data of a crisis in progress; the world is saved with the game. */
export type CrisisSnapshot = Record<string, unknown> & { item: NewsRef }

/** Names of the crisis levels, from 9 (back channel) down to 1 (nuclear war). */
export const CRISIS_STAGE = [
  '',
  'Guerre nucléaire',
  'Frappe imminente',
  'DEFCON 2',
  'DEFCON 3',
  'Alerte militaire',
  'Mise en alerte',
  'Protestation publique',
  'Note diplomatique',
  'Canal discret',
]

/**
 * A crisis in progress. The human acts through `respond()`; the computer side
 * (and the minor country) answers automatically inside it.
 */
export class Crisis {
  readonly kind: CrisisKind
  readonly item: NewsItem
  readonly who: number
  readonly victim: number
  readonly verb: Verb
  oldVal: number
  newVal: number
  level = 9
  steps: CrisisStep[] = []
  over = false
  /** Who backed down, when the crisis ended peacefully. */
  loser = 0
  war = false
  accident = false
  /** Superpower that must decide now (the human, or the current player in two-player mode). */
  decider: number

  private rand1: number
  private rand2: number

  constructor(private w: World, item: NewsItem, kind: CrisisKind) {
    this.kind = kind
    this.item = item
    this.who = item.subject
    this.victim = item.object
    this.verb = item.verb
    this.oldVal = item.oldVal
    this.newVal = item.newVal
    this.rand1 = w.random()
    this.rand2 = w.random()
    this.decider = w.human

    if (kind === 'minor') {
      w.chgDMess(this.victim, w.human === USA ? 1 : -1)
      this.minorTurn()
      return
    }
    // In two-player mode the author of the action answers first.
    if (w.twoPlayer) this.decider = this.who
    // The challenger is the human when the computer's action is questioned.
    const aggr = this.who === w.cmptr
    if (aggr) w.chgDMess(this.victim, w.human === USA ? 1 : -1)
    if (aggr && !w.twoPlayer) this.computerTurn()
  }

  /** Plain data for saving: every field but the world, with the news item as a reference. */
  snapshot(ref: (it: NewsItem) => NewsRef): CrisisSnapshot {
    const data = Object.fromEntries(Object.entries(this).filter(([k]) => k !== 'w'))
    return { ...data, item: ref(this.item) }
  }

  /** A crisis resumed from a snapshot, in the restored world. */
  static restore(w: World, s: CrisisSnapshot, deref: (r: NewsRef) => NewsItem): Crisis {
    return Object.assign(Object.create(Crisis.prototype) as Crisis, s, { w, item: deref(s.item) })
  }

  // ------------------------------------------------------------ superpower crisis

  private hangTough(actor: number): void {
    const w = this.w
    this.level--
    const t = obligation(w.treaty[actor][this.victim])
    const y = w.impt(actor, this.verb, this.victim, this.oldVal, this.newVal)
    w.integrity[actor] = clamp(w.integrity[actor] + div(t * y, 256), 1, 127)
    w.chgDipAff(1, 2, this.level - 9)
    let x = 0
    if (this.level === 2) x = 16
    else if (this.level === 3) x = 8
    else if (this.level === 4) x = 2
    x = w.dipAff[1][2] > 0 ? 0 : div(x * -w.dipAff[1][2], 64)
    if (x > Math.abs(div(w.random(), 128))) {
      this.level = 1
      this.accident = true
    }
    w.nastiness = Math.min(127, w.nastiness + 9 - this.level)
    this.steps.push({ actor, action: 'escalate', level: this.level })
  }

  private hangLoose(loser: number, winner: number): void {
    const w = this.w
    const cl = this.level
    if (cl < 8) {
      w.pugnacity[winner] += div(130 - w.pugnacity[winner], 4)
      const t = w.impt(loser, this.verb, this.victim, this.oldVal, this.newVal)
      w.integrity[loser] = clamp(w.integrity[loser] - 2 * div(obligation(w.treaty[loser][this.victim]) * t, 256), 1, 127)
      const g = w.gImpt(this.who, this.verb, this.victim, this.oldVal, this.newVal)
      const x = div(Math.abs(g.usa), cl) + div(Math.abs(g.ussr), cl) + 8 - cl
      let y = 0
      for (let j = 3; j <= NO_CNTRY; j++) {
        let z = div(x, 32)
        y += x % 32
        if (y > 32) {
          z++
          y -= 32
        }
        w.chgDipAff(j, loser, -z)
        w.chgDipAff(j, winner, z)
      }
    }
    if (cl % 2 === 1) this.revoke()
    let x = 9 - cl
    if (x > w.dontMess[this.victim]) x = w.dontMess[this.victim]
    if (loser === USA) x = -x
    w.chgDMess(this.victim, x)
    w.calcScores()
    this.steps.push({ actor: loser, action: 'backdown', level: cl })
    this.loser = loser
    this.over = true
  }

  /** The challenged action is cancelled. */
  private revoke(): void {
    const tmp = this.newVal
    this.newVal = this.oldVal
    this.oldVal = tmp
    this.item.crisis = true
    this.w.doPolicy(this.who, this.verb, this.victim, this.newVal, true)
  }

  private computerTurn(): void {
    const w = this.w
    let x = w.gImpt(this.who, this.verb, this.victim, this.oldVal, this.newVal).total
    if (this.who === w.human) x = -x
    if (x < 4 * this.level - 36 + Math.abs(div(w.random(), 1024))) {
      this.hangTough(w.cmptr)
      this.checkWar()
    } else {
      this.item.crisis = true
      this.hangLoose(w.cmptr, w.human)
    }
  }

  private checkWar(): void {
    if (this.level <= 1) {
      this.level = 1
      this.war = true
      this.over = true
      this.w.ended = this.accident ? 'accident' : 'war'
    }
  }

  /** What the human is shown before deciding. */
  briefing(): CrisisBriefing {
    const w = this.w
    const cl = this.level
    let sumLoser = 0
    if (this.kind === 'super' && cl < 8) {
      const g = w.gImpt(this.who, this.verb, this.victim, this.oldVal, this.newVal)
      const x = div(Math.abs(g.usa), cl) + div(Math.abs(g.ussr), cl) + 8 - cl
      let y = 0
      const human = this.decider
      for (let i = 3; i <= NO_CNTRY; i++) {
        let usez = div(x, 32)
        y += x % 32
        if (y > 32) {
          usez++
          y -= 32
        }
        let usex = -usez
        const daol = w.dipAff[i][human]
        if (daol + usex < -127) usex = -127 - daol
        if (daol + usex > 127) usex = 127 - daol
        sumLoser += usex * w.prestVal[i]
      }
      sumLoser = clamp(sumLoser, -8132352, 8132352)
    }
    const y = [0, 2048, 1024, 512, 512][w.level]
    const g = w.gImpt(this.who, this.verb, this.victim, this.oldVal, this.newVal)
    return {
      prestigeAtRisk: -div(sumLoser, 1024),
      usaInterest: Math.min(7, Math.abs(div(g.usa + div(this.rand1, y), 16))),
      ussrInterest: Math.min(7, Math.abs(div(g.ussr + div(this.rand2, y), 16))),
    }
  }

  /** The human (or current player) escalates (true) or backs down (false). */
  respond(escalate: boolean): void {
    if (this.over) return
    const w = this.w
    if (this.kind === 'minor') {
      if (escalate) {
        this.minorTough(w.human)
        if (this.level > 1) this.minorTurn()
        else this.over = true
      } else {
        this.item.crisis = true
        this.steps.push({ actor: w.human, action: 'backdown', level: this.level })
        this.loser = w.human
        this.over = true
      }
      return
    }
    const me = this.decider
    const other = 3 - me
    if (escalate) {
      this.hangTough(me)
      this.checkWar()
    } else {
      this.item.crisis = true
      this.hangLoose(me, other)
    }
    if (this.over) return
    if (w.twoPlayer) this.decider = other
    else this.computerTurn()
  }

  // ------------------------------------------------------------ minor country crisis

  private minorTough(actor: number): void {
    this.level--
    const x = [0, 0, 32, 16, 8, 4, 2, 1, 0][this.level] ?? 0
    this.w.chgDipAff(this.who, this.w.human, -x)
    this.steps.push({ actor, action: 'escalate', level: this.level })
  }

  private minorTurn(): void {
    const w = this.w
    const x = div(Math.abs(w.dontMess[this.victim] - w.aveDMess) * w.influence(w.human, this.who), 8)
    const y = [16, 16, 8, 8, 4, 4, 2, 2, 1, 1][this.level]
    if (x * y < 4 * this.level - 36 + Math.abs(div(w.random(), y * 256))) {
      this.minorTough(this.who)
      if (this.level <= 1) this.over = true
    } else {
      this.item.crisis = true
      this.w.doPolicy(this.who, this.verb, this.victim, this.oldVal, true)
      this.steps.push({ actor: this.who, action: 'backdown', level: this.level })
      this.loser = this.who
      this.over = true
    }
  }
}

/** The computer challenges a minor country's action, entirely automatically. */
export function computerCrisis(w: World, item: NewsItem): void {
  const who = item.subject
  const victim = item.object
  let level = 9
  w.chgDMess(victim, w.cmptr === USA ? 1 : -1)
  const tough = () => {
    level--
    const x = [0, 0, 32, 16, 8, 4, 2, 1, 0][level] ?? 0
    w.chgDipAff(who, w.cmptr, -x)
  }
  let backDown = false
  while (!backDown && level > 1) {
    const x = div(Math.abs(w.dontMess[victim] - w.aveDMess) * w.influence(w.cmptr, who), 8)
    const y = [16, 16, 8, 8, 4, 4, 2, 2, 1, 1][level]
    if (x * y < 4 * level - 36 + Math.abs(div(w.random(), y * 256))) tough()
    else {
      backDown = true
      item.crisis = true
      w.doPolicy(who, item.verb, victim, item.oldVal, true)
    }
    if (!backDown && level > 1) {
      const g = w.gImpt(who, item.verb, victim, item.oldVal, item.newVal)
      const z = w.cmptr === USA ? g.usa : g.ussr
      if (z > 4 * level - 36 + Math.abs(div(w.random(), 1024))) tough()
      else {
        backDown = true
        item.crisis = true
      }
    }
  }
}
