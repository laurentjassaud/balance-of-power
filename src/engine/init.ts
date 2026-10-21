import { World, NO_CNTRY, USA, USSR, div, clamp, milAidConv, intvConv, type Level } from './core'
import data from './worldData.json'

type Op =
  | { op: 'dipRow'; sp: number; index: number; values: number[] }
  | { op: 'country'; id: number; name: string; params: number[] }
  | { op: 'stance'; who: number; target: number; values: number[] }
  | { op: 'cont'; a: number; b: number }
  | { op: 'dip'; a: number; b: number; v: number }
  | { op: 'sphere'; a: number; b: number }

/** French country names. */
export const FRENCH_NAMES: Record<number, string> = {
  1: 'États-Unis',
  2: 'URSS',
  3: 'Mexique',
  4: 'Honduras',
  5: 'Nicaragua',
  6: 'Panama',
  7: 'Cuba',
  8: 'Argentine',
  9: 'Colombie',
  10: 'Pérou',
  11: 'Venezuela',
  12: 'Brésil',
  13: 'Chili',
  14: 'Canada',
  15: 'Grèce',
  16: 'Suède',
  17: 'Royaume-Uni',
  18: 'France',
  19: 'Espagne',
  20: 'RFA',
  21: 'Roumanie',
  22: 'Italie',
  23: 'RDA',
  24: 'Pologne',
  25: 'Tchécoslovaquie',
  26: 'Yougoslavie',
  27: 'Afrique du Sud',
  28: 'Égypte',
  29: 'Tunisie',
  30: 'Maroc',
  31: 'Algérie',
  32: 'Libye',
  33: 'Mali',
  34: 'Nigeria',
  35: 'Soudan',
  36: 'Éthiopie',
  37: 'Kenya',
  38: 'Zaïre',
  39: 'Tanzanie',
  40: 'Mozambique',
  41: 'Zambie',
  42: 'Angola',
  43: 'Japon',
  44: 'Corée du Nord',
  45: 'Corée du Sud',
  46: 'Australie',
  47: 'Chine',
  48: 'Viêt Nam',
  49: 'Turquie',
  50: 'Syrie',
  51: 'Israël',
  52: 'Taïwan',
  53: 'Irak',
  54: 'Arabie saoudite',
  55: 'Iran',
  56: 'Afghanistan',
  57: 'Pakistan',
  58: 'Inde',
  59: 'Birmanie',
  60: 'Thaïlande',
  61: 'Indonésie',
  62: 'Philippines',
  63: 'Guatemala',
  64: 'Salvador',
  65: 'Costa Rica',
  66: 'Mauritanie',
  67: 'Guinée',
  68: 'Côte d’Ivoire',
  69: 'Burkina Faso',
  70: 'Ghana',
  71: 'Niger',
  72: 'Tchad',
  73: 'Cameroun',
  74: 'Centrafrique',
  75: 'Congo',
  76: 'Zimbabwe',
  77: 'Botswana',
  78: 'Jordanie',
  79: 'Liban',
  80: 'Bolivie',
}

export const SHAPES = data.shapes as Record<string, string[]>

export interface NewGameOptions {
  level: Level
  human: typeof USA | typeof USSR
  twoPlayer?: boolean
  seed?: number
  /** Records every calculation in the world's debug journal. */
  debug?: boolean
}

function initCountry(w: World, id: number, name: string, p: number[]): void {
  const [gpIn, pop, milSIn, gWing, iWing, gStrg, iStrg, , , , invtF, , milM, dMess, deaths] = p
  const gp = div(gpIn, 2)
  const milS = div(milSIn, 2)
  w.names[id] = FRENCH_NAMES[id] ?? name
  w.popln[id] = pop
  w.gnp[id] = gp
  w.miltSpnd[id] = milS
  w.milMen[id] = milM
  w.drafFrac[id] = div(milM * 255, pop)
  w.govtWing[id] = gWing
  w.insgWing[id] = iWing
  w.leftPowr[id] = gWing < 0
  w.govtStrg[id] = gStrg
  w.insgStrg[id] = iStrg
  w.cntryRnd[id] = w.random()
  w.miltFrac[id] = div(div(255 * milS, 10), gp)
  w.invtFrac[id] = invtF
  w.consFrac[id] = 255 - w.miltFrac[id] - invtF
  w.gPopular[id] = 10 + div(128 - Math.abs(gWing), 8)
  w.consSpnd[id] = div(w.consFrac[id] * gp, 256)
  w.invtSpnd[id] = div(w.invtFrac[id] * gp, 256)
  w.dontMess[id] = dMess
  w.sumDMess += dMess
  w.maturity[id] = Math.max(0, 256 - div(deaths, pop))
  if (id > 2) {
    for (let i = 1; i <= NO_CNTRY; i++) {
      w.dipAff[id][i] = div(w.dipAff[1][id] * w.dipAff[1][i], 256) + div(w.dipAff[2][id] * w.dipAff[2][i], 256)
    }
  }
}

/**
 * Policies of minor countries set directly in the data procedures of Init.p (not through SetStance):
 * [policy, giver, target, value]. The last two, Iraq's support of the Iranian rebels, are inside `IF Level=4`.
 */
const MINOR_POLICIES: ['miltAid' | 'insgAid' | 'intvGovt' | 'intvRebl', number, number, number][] = [
  ['insgAid', 4, 5, 3], // Honduras arms the Contras
  ['insgAid', 5, 64, 1], // Nicaragua arms the Salvadoran rebels
  ['miltAid', 7, 5, 2], // Cuba arms Nicaragua
  ['miltAid', 7, 42, 3], // Cuba in Angola
  ['intvGovt', 7, 42, 3],
  ['intvGovt', 7, 36, 3], // Cuban troops in Ethiopia
  ['intvGovt', 7, 40, 2], // ... Mozambique
  ['intvGovt', 7, 75, 2], // ... Congo
  ['intvGovt', 7, 32, 2], // ... Libya
  ['miltAid', 17, 40, 3], // United Kingdom arms Mozambique
  ['miltAid', 18, 72, 2], // France in Chad
  ['intvGovt', 18, 72, 2],
  ['insgAid', 27, 40, 2], // South Africa arms RENAMO
  ['insgAid', 27, 42, 2], // South Africa with UNITA
  ['intvRebl', 27, 42, 2],
  ['insgAid', 27, 76, 1], // South Africa arms Zimbabwean rebels
  ['insgAid', 32, 72, 3], // Libya with the Chadian rebels
  ['intvRebl', 32, 72, 3],
  ['intvGovt', 39, 40, 2], // Tanzanian troops in Mozambique
  ['insgAid', 41, 27, 1], // Zambia arms the ANC
  ['insgAid', 47, 56, 2], // China arms the Afghan mujahideen
  ['insgAid', 76, 27, 1], // Zimbabwe arms the ANC
  ['insgAid', 77, 27, 1], // Botswana arms the ANC
  ['intvRebl', 53, 55, 4], // Iraq with the Iranian rebels
  ['insgAid', 53, 55, 3],
]

function randomAdjust(w: World, value: number, hi: number, lo: number, divisor: number): number {
  return clamp(value + div(w.random(), divisor), lo, hi)
}

/** Builds the starting world: the country data of the original game, then level-dependent randomisation. */
export function createWorld(opts: NewGameOptions): World {
  const w = new World(opts.seed ?? Date.now())
  w.level = opts.level
  w.human = opts.human
  w.cmptr = 3 - opts.human
  w.twoPlayer = !!opts.twoPlayer
  if (opts.debug) w.setDebug(true)

  for (let i = 1; i <= NO_CNTRY; i++) {
    for (let sp = 1; sp <= 2; sp++) w.trade[sp][i] = 4
    w.sqrtStrg[i] = 80
  }
  w.nastiness = 8 * w.level + div(w.random(), 2048)
  w.milPowr[1] = 1
  w.milPowr[2] = 1

  for (const o of data.ops as Op[]) {
    switch (o.op) {
      case 'dipRow':
        o.values.forEach((v, k) => (w.dipAff[o.sp][o.index + k + 1] = v))
        break
      case 'country':
        initCountry(w, o.id, o.name, o.params)
        break
      case 'stance': {
        const [govMAid, insMAid, govIntv, insIntv, treat, forAid, tr] = o.values
        w.treaty[o.who][o.target] = treat
        w.insgAid[o.who][o.target] = insMAid
        w.intvRebl[o.who][o.target] = insIntv
        w.miltAid[o.who][o.target] = govMAid
        w.intvGovt[o.who][o.target] = govIntv
        w.econAid[o.who][o.target] = forAid
        w.trade[o.who][o.target] = tr
        break
      }
      case 'cont':
        w.contigus[o.a][o.b] = true
        w.minorSph[o.a][o.b] = true
        break
      case 'dip':
        w.dipAff[o.a][o.b] = o.v
        break
      case 'sphere':
        w.minorSph[o.a][o.b] = true
        break
    }
  }
  // Minor countries act only at level 4; below it the original never reads these policies.
  if (w.level === 4) {
    for (const [arr, giver, target, v] of MINOR_POLICIES) {
      const m = arr === 'miltAid' ? w.miltAid : arr === 'insgAid' ? w.insgAid : arr === 'intvGovt' ? w.intvGovt : w.intvRebl
      m[giver][target] = v
    }
  }

  w.aveDMess = div(w.sumDMess, NO_CNTRY)
  for (let sp = 1; sp <= 2; sp++) w.pugnacity[sp] = 32 + 4 * w.level + div(w.random(), 4096)
  w.pugnacity[w.cmptr] += 4 * w.level
  for (let sp = 1; sp <= 2; sp++) {
    w.integrity[sp] = 128
    w.adventur[sp] = Math.max(16, w.pugnacity[sp] + w.nastiness - w.pugnacity[3 - sp] - w.miltFrac[sp] + 32)
  }

  for (let i = 1; i <= NO_CNTRY; i++) {
    w.govtWing[i] = randomAdjust(w, w.govtWing[i], 127, -127, 8192 >> w.level)
    w.govtStrg[i] = randomAdjust(w, w.govtStrg[i], 32767, 1, 4096 >> w.level)
    w.maturity[i] = randomAdjust(w, w.maturity[i], 255, 0, 8192 >> w.level)
    w.gPopular[i] = randomAdjust(w, w.gPopular[i], 20, 0, 16384 >> w.level)
    for (let who = 1; who <= w.cntryCount; who++) {
      const x = w.miltAid[who][i]
      w.govtAid[i] += milAidConv(x)
      w.govtAid[who] -= milAidConv(x)
      w.govtAid[who] -= milAidConv(w.insgAid[who][i])
      w.totlIntv[who] += intvConv(w.intvGovt[who][i]) + intvConv(w.intvRebl[who][i])
    }
    const x = w.milMen[i]
    let temp = Math.max(1, div(w.miltSpnd[i] + w.govtAid[i], 2))
    let y = 0
    for (let who = 1; who <= w.cntryCount; who++) y += div(intvConv(w.intvGovt[who][i]) * w.milPowr[who], w.milMen[who])
    w.milPowr[i] = div(4 * temp * x, temp + x) + y
    temp = div(w.miltSpnd[i], 2)
    w.prestVal[i] = div(16 * temp * x, temp + x)
    const xi = div((256 - w.maturity[i]) * w.popln[i], 2048)
    let ti = 0
    for (let who = 1; who <= w.cntryCount; who++) ti += 2 * milAidConv(w.insgAid[who][i])
    if (ti < div(xi, 8) + 1) ti = div(xi, 8) + 1
    w.insgPowr[i] = div(4 * ti * xi, ti + xi)
    w.virgin[i] = true
  }
  return w
}
