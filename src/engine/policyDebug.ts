// Debug mode: what a change to the weapons or troops sent to a country does to next year's fight between its
// government and its rebels, and to the superpowers' prestige. A projection, all else being equal: it runs the
// world as it stands through the turn's own formulas (simulation.ts) without changing anything.

import { World, USA, Verb, NO_CNTRY, div, clamp, type NewsItem } from './core'
import { govtPower, insgPower, combat, reactionTerms } from './simulation'

/** The policies whose change opens the report. */
export const DEBUG_VERBS = [Verb.MilAid, Verb.InsgAid, Verb.IntvGovt, Verb.IntvRebl]

export interface Projection {
  // government (the book's names in the comments)
  drafFrac: number // Draft Rate, out of 256
  popln: number
  milMen: number // Soldiers
  miltSpnd: number // Weapons
  govtAid: number // Military Aid
  weapons: number // Total Weapons
  govtBase: number
  intvGovt1: number // Intervention Power, USA troops for the government
  intvGovt2: number
  wars: number
  govtPowr: number // Government Power
  // rebels
  maturity: number
  sqrtStrg: number // Success
  fighters: number
  shipments: number // Weapons Shipments from Superpowers
  insgWeapons: number // Insurgency Weapons
  insgBase: number
  intvRebl1: number // Intervention Power, USA troops for the rebels
  intvRebl2: number
  insgPowr: number // Insurgency Power
  // a year of fighting
  milPowr: number // Military Power left to the government
  insgLeft: number
  strngRat: number
  revolution: boolean
  // prestige, by superpower (1 USA, 2 USSR)
  prestVal: number
  reaction1: number
  reaction2: number
  revlGain1: number
  revlGain2: number
  dipAff1: number
  dipAff2: number
  share1: number
  share2: number
  score1: number
  score2: number
}
export type ProjKey = Exclude<keyof Projection, 'revolution'>

/** Prestige of superpower sp if country i's relations with it were dip, the others' unchanged. */
function scoreWith(w: World, sp: number, i: number, dip: number): number {
  let s = 0
  for (let c = 3; c <= NO_CNTRY; c++) s += (c === i ? dip : w.dipAff[c][sp]) * w.prestVal[c]
  return div(s, 1024) - (sp === USA ? w.iUsaStrng : w.iUssrStrng)
}

/**
 * Next year for country i if nothing else changed: its yearly reaction to the superpowers, then the fight
 * (with its wars at level 4) and the revolution it may bring, as the turn runs them.
 */
export function project(w: World, i: number): Projection {
  const gp = govtPower(w, i)
  let wars = 0
  if (i > 2 && w.level === 4) for (let j = 3; j <= NO_CNTRY; j++) if (w.dipAff[i][j] === -127) wars += div(w.milPowr[j], 4)
  const govtPowr = gp.power - wars
  const ip = insgPower(w, i)
  const fight = combat(govtPowr, ip.power)
  const revolution = fight.ratio < 1
  const p = {
    drafFrac: w.drafFrac[i], popln: w.popln[i], milMen: gp.soldiers, miltSpnd: w.miltSpnd[i], govtAid: w.govtAid[i],
    weapons: gp.weapons, govtBase: gp.base, intvGovt1: gp.intvUsa, intvGovt2: gp.intvUssr, wars, govtPowr,
    maturity: w.maturity[i], sqrtStrg: w.sqrtStrg[i], fighters: ip.fighters, shipments: ip.shipments, insgWeapons: ip.weapons,
    insgBase: ip.base, intvRebl1: ip.intvUsa, intvRebl2: ip.intvUssr, insgPowr: ip.power,
    milPowr: fight.milPowr, insgLeft: fight.insgPowr, strngRat: fight.ratio, revolution, prestVal: w.prestVal[i],
  } as Projection
  for (const k of [1, 2] as const) {
    const reaction = div(reactionTerms(w, i, k).reduce((s, t) => s + t, 0), 8)
    const afterReaction = clamp(w.dipAff[i][k] + reaction, -127, 127)
    const dip = revolution ? w.rebelAffinity(k, i) : afterReaction
    p[`reaction${k}`] = reaction
    p[`revlGain${k}`] = revolution ? div((dip - afterReaction) * w.prestVal[i], 1024) : 0
    p[`dipAff${k}`] = dip
    p[`share${k}`] = div(dip * w.prestVal[i], 1024)
    p[`score${k}`] = scoreWith(w, k, i, dip)
  }
  return p
}

/** The figures of the projection the world holds as they stand now (the end of the year just played). */
export function currentState(w: World, i: number): Partial<Record<ProjKey, number>> {
  return {
    drafFrac: w.drafFrac[i], popln: w.popln[i], milMen: w.milMen[i], miltSpnd: w.miltSpnd[i], govtAid: w.govtAid[i],
    maturity: w.maturity[i], sqrtStrg: w.sqrtStrg[i], milPowr: w.milPowr[i], insgLeft: w.insgPowr[i], strngRat: w.strngRat[i],
    prestVal: w.prestVal[i], dipAff1: w.dipAff[i][1], dipAff2: w.dipAff[i][2],
    share1: div(w.dipAff[i][1] * w.prestVal[i], 1024), share2: div(w.dipAff[i][2] * w.prestVal[i], 1024),
    score1: w.score(1), score2: w.score(2),
  }
}

/**
 * Odds that the computer questions the human's move at the start of next year (Game.react): it does when
 * −importance < |random / 1024|, a draw of 0..31 where 0 has 2047 chances in 65535 and every other value 2048.
 * Null when the move cannot be questioned (a cut, a two-player game).
 */
export function challengeOdds(w: World, it: NewsItem): { impt: number; threshold: number; odds: number } | null {
  if (it.subject !== w.human || it.newVal <= it.oldVal || w.twoPlayer || it.crisis) return null
  const g = w.gImpt(it.subject, it.verb, it.object, it.oldVal, it.newVal)
  const threshold = (w.cmptr === USA ? g.usa : g.ussr) < 0 ? 256 : -g.total
  let n = 0
  for (let r = 0; r <= 31; r++) if (threshold < r) n += r === 0 ? 2047 : 2048
  return { impt: g.total, threshold, odds: n / 65535 }
}

export interface PolicyReport {
  country: number
  verb: Verb
  /** The superpower that made the move. */
  sp: number
  oldVal: number
  newVal: number
  year: number
  now: Partial<Record<ProjKey, number>>
  before: Projection
  after: Projection
  odds: ReturnType<typeof challengeOdds>
}
