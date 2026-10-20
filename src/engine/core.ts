// Core state and shared rules of the Balance of Power model (1990 edition).
// Country 1 is the USA, country 2 the USSR, 3..80 are minor countries.
// Arrays are 1-based (index 0 unused) to stay close to the original model.

export const NO_CNTRY = 80
export const USA = 1
export const USSR = 2
/** First year of play (the 1990 edition started in 1989). */
export const FIRST_YEAR = 1982

export enum Verb {
  Destab = 0,
  Econ = 1,
  MilAid = 2,
  InsgAid = 3,
  IntvGovt = 4,
  IntvRebl = 5,
  Pressure = 6,
  Treaty = 7,
  Trade = 8,
}

export type Level = 1 | 2 | 3 | 4

/** Pascal-style integer division (truncates toward zero, never divides by zero). */
export function div(a: number, b: number): number {
  return Math.trunc(a / (b === 0 ? 1 : b))
}

export function isqrt(v: number): number {
  return v <= 0 ? 0 : Math.floor(Math.sqrt(v))
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Seeded generator returning integers in [-32767, 32767], like the Mac Toolbox Random. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return Math.floor(u * 65535) - 32767
  }
  get state(): number {
    return this.s
  }
  /** A generator resumed from a saved state. */
  static fromState(state: number): Rng {
    const r = new Rng(1)
    r.s = state >>> 0
    return r
  }
}

/** Level 0..5 of a policy converted to an amount (weapons). */
export function econConv(v: number): number {
  return [0, 1, 2, 5, 10, 20][v] ?? 0
}
export function milAidConv(v: number): number {
  return [0, 1, 5, 20, 50, 100][v] ?? 0
}
export function intvConv(v: number): number {
  return [0, 1, 5, 20, 100, 500][v] ?? 0
}
/** Treaty level 0..5 converted to an obligation 0..128. */
export function obligation(treaty: number): number {
  return [0, 16, 32, 64, 96, 128][treaty] ?? 0
}

export interface NewsItem {
  subject: number
  verb: Verb
  object: number
  oldVal: number
  newVal: number
  host: number
  crisis: boolean
  worth: number
  /** Set once the human has questioned this action of a minor country, so that it cannot be questioned again. */
  questioned?: boolean
}

/** A year of a country's history. Per country arrays; [superpower][country] for the policies of USA (1) and USSR (2). */
export interface HistoryYear {
  year: number
  sqrtStrg: number[]
  gPopular: number[]
  miltPress: number[]
  leftPowr: boolean[]
  rebWinFlag: boolean[]
  coupFlag: boolean[]
  finlFlag: boolean[]
  dipAff: number[][]
  miltAid: number[][]
  insgAid: number[][]
  intvGovt: number[][]
  intvRebl: number[][]
  econAid: number[][]
  destab: number[][]
  finlProb: number[][]
  treaty: number[][]
  pressure: number[][]
}

type Arr = number[]
type Mat = number[][]

const arr = (v = 0): Arr => new Array(NO_CNTRY + 1).fill(v)
const mat = (rows: number, v = 0): Mat => Array.from({ length: rows + 1 }, () => arr(v))

export class World {
  level: Level = 1
  human = USA
  cmptr = USSR
  twoPlayer = false
  /** Two-player mode: the mouse has changed hands this year (the original's TwoPActF); a new year needs it. */
  handedOver = false
  year = FIRST_YEAR - 1
  rng: Rng

  names: string[] = new Array(NO_CNTRY + 1).fill('')
  popln = arr()
  gnp = arr()
  govtWing = arr()
  insgWing = arr()
  govtAid = arr()
  prestVal = arr()
  consFrac = arr()
  miltFrac = arr()
  invtFrac = arr()
  consSpnd = arr()
  miltSpnd = arr()
  invtSpnd = arr()
  milPowr = arr()
  milMen = arr()
  drafFrac = arr()
  dontMess = arr()
  maturity = arr()
  strngRat = arr()
  cntryRnd = arr()
  govtStrg = arr()
  insgStrg = arr()
  insgPowr = arr()
  gPopular = arr()
  miltPress = arr()
  sqrtStrg = arr()
  totlIntv = arr()
  oldGStrg = arr()
  oldIStrg = arr()
  oldGPopl = arr()

  leftPowr: boolean[] = new Array(NO_CNTRY + 1).fill(false)
  finlFlag: boolean[] = new Array(NO_CNTRY + 1).fill(false)
  coupFlag: boolean[] = new Array(NO_CNTRY + 1).fill(false)
  rebWinFlag: boolean[] = new Array(NO_CNTRY + 1).fill(false)
  virgin: boolean[] = new Array(NO_CNTRY + 1).fill(true)

  // [superpower][country]
  revlGain = mat(2)
  coupGain = mat(2)
  finlGain = mat(2)
  pressure = mat(2)
  treaty = mat(2)
  finlProb = mat(2)
  destab = mat(2)
  econAid = mat(2)
  trade = mat(2)
  oldFinPb = mat(2)

  // [country][country]
  dipAff = mat(NO_CNTRY)
  miltAid = mat(NO_CNTRY)
  intvGovt = mat(NO_CNTRY)
  insgAid = mat(NO_CNTRY)
  intvRebl = mat(NO_CNTRY)
  contigus: boolean[][] = Array.from({ length: NO_CNTRY + 1 }, () => new Array(NO_CNTRY + 1).fill(false))
  minorSph: boolean[][] = Array.from({ length: NO_CNTRY + 1 }, () => new Array(NO_CNTRY + 1).fill(false))

  pugnacity = [0, 0, 0]
  integrity = [0, 0, 0]
  adventur = [0, 0, 0]
  nastiness = 0
  sumDMess = 0
  aveDMess = 1

  usaStrng = 0
  ussrStrng = 0
  iUsaStrng = 0
  iUssrStrng = 0
  oldAScor = 0
  oldRScor = 0
  usaScore: number[] = []
  ussrScore: number[] = []

  news: NewsItem[] = []
  /** Set when the game is over: 'peace' after the last year, 'war' or 'accident' after a nuclear war. */
  ended: null | 'peace' | 'war' | 'accident' = null
  /** One record per year played, taken when the year closes (the original read them back from its save file). */
  history: HistoryYear[] = []

  constructor(seed: number) {
    this.rng = new Rng(seed)
  }

  random(): number {
    return this.rng.next()
  }

  /** The figures the History window shows, for every country, as they stand now. */
  yearRecord(): HistoryYear {
    const sp = (m: number[][]) => [[], m[1].slice(), m[2].slice()]
    return {
      year: this.year,
      sqrtStrg: this.sqrtStrg.slice(), gPopular: this.gPopular.slice(), miltPress: this.miltPress.slice(),
      leftPowr: this.leftPowr.slice(), rebWinFlag: this.rebWinFlag.slice(), coupFlag: this.coupFlag.slice(), finlFlag: this.finlFlag.slice(),
      dipAff: sp(this.dipAff), miltAid: sp(this.miltAid), insgAid: sp(this.insgAid), intvGovt: sp(this.intvGovt), intvRebl: sp(this.intvRebl),
      econAid: sp(this.econAid), destab: sp(this.destab), finlProb: sp(this.finlProb), treaty: sp(this.treaty), pressure: sp(this.pressure),
    }
  }

  recordYear(): void {
    this.history = this.history.filter((h) => h.year !== this.year)
    this.history.push(this.yearRecord())
  }

  /** Number of countries that can run foreign policies (minor countries act only at level 4). */
  get cntryCount(): number {
    return this.level === 4 ? NO_CNTRY : 2
  }

  // ---------------------------------------------------------------- limits

  econAMax(x: number): number {
    let m = 0
    if (x > -60) m = 1
    if (x > -40) m = 2
    if (x > -20) m = 3
    if (x > 0) m = 4
    if (x > 20) m = 5
    return m
  }

  milMax(x: number): number {
    let m = 0
    if (x > -40) m = 1
    if (x > -20) m = 2
    if (x > 0) m = 3
    if (x > 20) m = 4
    if (x > 40) m = 5
    return m
  }

  /** Max troops for the government, from treaty level (expert levels) or affinity. */
  intvGMax(treatyLevel: number, dipAff: number): number {
    if (this.level >= 3) {
      if (treatyLevel === 5) return 5
      if (treatyLevel === 4) return 4
      if (treatyLevel === 3) return 2
      return 0
    }
    let m = 0
    if (dipAff > 0) m = 1
    if (dipAff > 20) m = 2
    if (dipAff > 40) m = 3
    if (dipAff > 60) m = 4
    if (dipAff > 80) m = 5
    return m
  }

  /** x = integrity + diplomatic affinity - pugnacity. */
  treatMax(x: number): number {
    if (this.level < 3) return 5
    let m = 0
    if (x > -60) m = 1
    if (x > 0) m = 2
    if (x > 40) m = 3
    if (x > 60) m = 4
    if (x > 100) m = 5
    return m
  }

  /** Remaining weapons and troops a country can still commit. */
  maxPolicy(giver: number): { maxIntv: number; maxInsg: number } {
    let maxIntv = 5
    let maxInsg = 5
    for (let i = 4; i >= 0; i--) if (milAidConv(i + 1) > div(this.miltSpnd[giver], 8) + this.govtAid[giver]) maxInsg = i
    for (let i = 4; i >= 0; i--) if (intvConv(i + 1) > div(this.milMen[giver], 4) - this.totlIntv[giver]) maxIntv = i
    return { maxIntv, maxInsg }
  }

  /** Max weapons to insurgents: needs a border or troops in a neighbouring country. */
  insgAMax(sp: number, minor: number): number {
    if (this.contigus[sp][minor]) return 5
    let max = 1
    for (let i = 3; i <= NO_CNTRY; i++) {
      if (this.contigus[i][minor]) {
        let x = this.intvGovt[sp]?.[i] ?? 0
        if (x < 5) x++
        if (x > max) max = x
      }
    }
    return max
  }

  /** Max troops for rebels. */
  insgIMax(sp: number, minor: number): number {
    if (this.contigus[sp][minor]) return 5
    let y = 2
    for (let i = 3; i <= NO_CNTRY; i++) {
      if (this.contigus[i][minor]) {
        let x = this.intvGovt[sp]?.[i] ?? 0
        if (x < 5) x++
        if (x > y) y = x
      }
    }
    return y
  }

  chgDipAff(i: number, j: number, delta: number): void {
    const x = clamp(this.dipAff[i][j] + delta, -127, 127)
    this.dipAff[i][j] = x
    this.dipAff[j][i] = x
  }

  chgDMess(who: number, howMuch: number): void {
    this.dontMess[who] += howMuch
    this.sumDMess += howMuch
    if (this.sumDMess < 1) this.sumDMess = 1
    this.aveDMess = div(this.sumDMess, NO_CNTRY)
  }

  /** How much a superpower is engaged on the side of a minor country's government. */
  influence(sp: number, minor: number): number {
    const x =
      this.treaty[sp][minor] +
      this.econAid[sp][minor] +
      this.miltAid[sp][minor] +
      2 * this.intvGovt[sp][minor] -
      2 * this.destab[sp][minor] -
      2 * this.insgAid[sp][minor] -
      4 * this.intvRebl[sp][minor]
    return Math.max(0, x)
  }

  calcScores(): void {
    let s1 = 0
    let s2 = 0
    for (let i = 3; i <= NO_CNTRY; i++) {
      s1 += this.dipAff[i][1] * this.prestVal[i]
      s2 += this.dipAff[i][2] * this.prestVal[i]
    }
    this.usaStrng = div(s1, 1024)
    this.ussrStrng = div(s2, 1024)
  }

  score(sp: number): number {
    return sp === USA ? this.usaStrng - this.iUsaStrng : this.ussrStrng - this.iUssrStrng
  }

  // ---------------------------------------------------------------- policies

  getPolicy(sub: number, verb: Verb, obj: number): number {
    switch (verb) {
      case Verb.Destab: return this.destab[sub][obj]
      case Verb.Econ: return this.econAid[sub][obj]
      case Verb.MilAid: return this.miltAid[sub][obj]
      case Verb.InsgAid: return this.insgAid[sub][obj]
      case Verb.IntvGovt: return this.intvGovt[sub][obj]
      case Verb.IntvRebl: return this.intvRebl[sub][obj]
      case Verb.Pressure: return this.pressure[sub][obj]
      case Verb.Treaty: return this.treaty[sub][obj]
      case Verb.Trade: return this.trade[sub][obj]
    }
  }

  /** Executes a policy declaration (not its consequences) and records it in the news. */
  doPolicy(sub: number, verb: Verb, obj: number, newVal: number, crisis: boolean): void {
    let oldVal = 0
    switch (verb) {
      case Verb.Destab:
        oldVal = this.destab[sub][obj]
        this.destab[sub][obj] = newVal
        break
      case Verb.Econ:
        oldVal = this.econAid[sub][obj]
        this.econAid[sub][obj] = newVal
        break
      case Verb.MilAid:
        oldVal = this.miltAid[sub][obj]
        this.miltAid[sub][obj] = newVal
        this.govtAid[obj] += milAidConv(newVal) - milAidConv(oldVal)
        this.govtAid[sub] -= milAidConv(newVal) - milAidConv(oldVal)
        break
      case Verb.InsgAid:
        oldVal = this.insgAid[sub][obj]
        this.insgAid[sub][obj] = newVal
        this.govtAid[sub] -= milAidConv(newVal) - milAidConv(oldVal)
        break
      case Verb.IntvGovt:
        oldVal = this.intvGovt[sub][obj]
        this.intvGovt[sub][obj] = newVal
        this.totlIntv[sub] += intvConv(newVal) - intvConv(oldVal)
        break
      case Verb.IntvRebl:
        oldVal = this.intvRebl[sub][obj]
        this.intvRebl[sub][obj] = newVal
        this.totlIntv[sub] += intvConv(newVal) - intvConv(oldVal)
        break
      case Verb.Pressure:
        oldVal = this.pressure[sub][obj]
        this.pressure[sub][obj] = newVal
        break
      case Verb.Treaty:
        oldVal = this.treaty[sub][obj]
        this.treaty[sub][obj] = newVal
        break
      case Verb.Trade:
        oldVal = this.trade[sub][obj]
        this.trade[sub][obj] = newVal
        crisis = false
        break
    }
    if (oldVal !== newVal || sub === this.human) this.insertNews(sub, verb, obj, oldVal, newVal, obj, crisis)
  }

  /** Inserts a news item, sorted by newsworthiness; replaces an earlier item on the same subject. */
  insertNews(sub: number, verb: Verb, obj: number, oldVal: number, newVal: number, host: number, crisis: boolean): void {
    let imp: number
    if (sub === obj) {
      imp = [5, 14, 10, 2, 2, 2, 2, 0, 2][verb]
    } else {
      imp = [4, 3, 5, 5, 10, 10, newVal > oldVal ? 2 : 12, 5, 2][verb]
    }
    imp *= 1 + Math.abs(newVal - oldVal)
    if (oldVal > newVal) imp -= 1
    imp = isqrt((isqrt(this.prestVal[sub] * this.prestVal[obj]) + 1) * imp)
    if (imp < 1) imp = 1

    let loclOld = oldVal
    let loclCri = crisis
    const idx = this.news.findIndex((n) => n.subject === sub && n.verb === verb && n.object === obj)
    let culled = false
    if (idx >= 0) {
      loclOld = this.news[idx].oldVal
      loclCri = newVal <= loclOld
      this.news.splice(idx, 1)
      culled = true
    }
    if (!culled || loclOld !== newVal) {
      const item: NewsItem = { subject: sub, verb, object: obj, oldVal: loclOld, newVal, host, crisis: loclCri, worth: imp }
      let pos = this.news.findIndex((n) => n.worth < imp)
      if (pos < 0) pos = this.news.length
      this.news.splice(pos, 0, item)
      if (this.news.length > 128) this.news.length = 128
    }
  }

  // ---------------------------------------------------------------- importance

  /** Damage done to a country by a policy change (negative = help). */
  hurt(verb: Verb, obj: number, oldVal: number, newVal: number): number {
    let x = 0
    switch (verb) {
      case Verb.Destab:
        x = 16 * (newVal - oldVal)
        break
      case Verb.Econ:
        x = -div(div(1024 * (econConv(newVal) - econConv(oldVal)), this.gnp[obj]), this.gPopular[obj] + 1)
        if (x === 0) x = oldVal - newVal
        break
      case Verb.MilAid:
      case Verb.Treaty:
        x = div((oldVal - newVal) * this.miltPress[obj], 4)
        if (x === 0) x = oldVal - newVal
        break
      case Verb.InsgAid:
        x = 12 * (newVal - oldVal)
        break
      case Verb.IntvGovt:
        x = div((oldVal - newVal) * this.miltPress[obj], 2)
        if (x === 0) x = oldVal - newVal
        break
      case Verb.IntvRebl:
        x = 25 * (newVal - oldVal)
        break
      case Verb.Pressure:
        x = 8 * newVal
        break
      case Verb.Trade:
        // The original has no case for trade (its value is left undefined). A value of 0 would make the computer
        // react to almost every trade increase, so trade gets the fallback the original uses for aid and troops.
        x = oldVal - newVal
        break
    }
    return clamp(x, -127, 127)
  }

  impt(toWhom: number, verb: Verb, obj: number, oldVal: number, newVal: number): number {
    return div(this.hurt(verb, obj, oldVal, newVal) * this.dipAff[toWhom][obj], 128)
  }

  /**
   * Affinity superpower k would have for country i if its rebels took power now, by the revolution rule: how much
   * closer the new government stands to k's ideology, plus 8 per level of support k gave the rebels, minus 8 per
   * level the other superpower gave them. Only the advisors use it; the computer keeps the original reasoning.
   */
  rebelAffinity(k: number, i: number): number {
    let regime = this.insgWing[i]
    if (this.intvRebl[1][i] + this.intvRebl[2][i] > 0) regime = div(this.govtWing[this.intvRebl[1][i] > this.intvRebl[2][i] ? 1 : 2] + regime, 2)
    const support = (s: number) => this.insgAid[s][i] + 2 * this.intvRebl[s][i] - this.miltAid[s][i] - 2 * this.intvGovt[s][i]
    const x = div(Math.abs(this.govtWing[i] - this.govtWing[k]) - Math.abs(regime - this.govtWing[k]), 2) + 8 * support(k) - 8 * support(3 - k)
    return clamp(x, -127, 127)
  }

  /**
   * Importance (outrage) of an action for each superpower, and their sum.
   * bias 0 is the real computation; 1..4 are the four advisors' distorted views.
   * aff, indexed by superpower, replaces their affinity for obj (the advisors' look at a rebel regime).
   */
  gImpt(sub: number, verb: Verb, obj: number, oldVal: number, newVal: number, bias = 0, aff?: number[]): { total: number; usa: number; ussr: number } {
    const MAX = 134144000
    const res = [0, 0, 0]
    const raw = [0, 0, 0]
    for (let i = 1; i <= 2; i++) {
      let x = div(aff ? aff[i] : this.dipAff[i][obj], 4)
      if (x === 0) x = 1
      let y = div(obligation(this.treaty[i][obj]), 4) + 1
      let z = div(this.dontMess[obj] * 1280, this.sumDMess)
      z = clamp(z, 1, 32)
      if (i === 2) z = 33 - z
      let t = clamp(div(this.adventur[i], 2), 1, 32)
      let v = this.hurt(verb, obj, oldVal, newVal)
      if (sub === 3 - i && (verb === Verb.MilAid || verb === Verb.IntvGovt || verb === Verb.Treaty) && this.dipAff[i][obj] > 0) v = -v
      switch (bias) {
        case 1:
          x = x * isqrt(Math.abs(x))
          y = isqrt(y)
          break
        case 2:
          y = y * isqrt(y)
          z = isqrt(z)
          break
        case 3:
          z = z * isqrt(z)
          t = isqrt(t)
          break
        case 4:
          t = t * isqrt(t)
          x = x > 0 ? isqrt(x) : -isqrt(Math.abs(x))
          break
      }
      const lx = div(z * x * y * t * v, 64) * this.prestVal[obj]
      raw[i] = lx
      res[i] = div(clamp(lx, -MAX, MAX), 4096)
    }
    const total = div(clamp(raw[1] + raw[2], -MAX, MAX), 4096)
    return { total, usa: res[1], ussr: res[2] }
  }
}
