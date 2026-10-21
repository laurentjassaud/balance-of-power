import {
  World, NO_CNTRY, FIRST_YEAR, Verb, div, isqrt, clamp, econConv, milAidConv, intvConv, obligation,
} from './core'
import { VERB_LABEL } from './news'

// In debug mode (w.log set) every step records its calculation; `w.log?.add(...)` builds nothing when it is off.

const SP = ['', 'USA', 'URSS']

// ------------------------------------------------------------------ start of turn

/** Year advance, snapshots for "rate of change" displays, superpower-vs-superpower battles. */
export function prePlanMove(w: World): void {
  w.year++
  w.log?.add({
    kind: 'tour', step: 'Début d’année', country: 0, title: `Début de l’année ${w.year}`, result: `tension ${w.nastiness}`,
    data: { nastiness: w.nastiness, pugnacity1: w.pugnacity[1], pugnacity2: w.pugnacity[2], integrity1: w.integrity[1], integrity2: w.integrity[2], adventur1: w.adventur[1], adventur2: w.adventur[2] },
  })
  for (let i = 1; i <= NO_CNTRY; i++) {
    w.oldGStrg[i] = w.govtStrg[i]
    w.oldIStrg[i] = w.insgStrg[i]
    w.oldGPopl[i] = w.gPopular[i]
    for (let j = 1; j <= 2; j++) {
      w.revlGain[j][i] = 0
      w.coupGain[j][i] = 0
      w.finlGain[j][i] = 0
      w.oldFinPb[j][i] = w.finlProb[j][i]
    }
    if (w.govtStrg[i] === 0) w.govtStrg[i] = 1
    if (w.insgStrg[i] > w.govtStrg[i]) w.insgStrg[i] = w.govtStrg[i]
    w.sqrtStrg[i] = isqrt(clamp(div(6400 * w.insgStrg[i], w.govtStrg[i]), 1, 6400))

    if ((w.intvGovt[1][i] > 0 && w.intvRebl[2][i] > 0) || (w.intvGovt[2][i] > 0 && w.intvRebl[1][i] > 0)) {
      // American and Soviet troops fight each other
      w.dipAff[1][2] = -127
      w.dipAff[2][1] = -127
      w.nastiness = 127
      w.pugnacity[1] = 127
      w.pugnacity[2] = 127
      w.log?.add({
        kind: 'tension', step: 'Affrontement des superpuissances', country: i, title: `Troupes américaines et soviétiques face à face en ${w.nm(i)}`,
        result: 'tension 127, relations USA–URSS −127',
        data: { intvGovt1: w.intvGovt[1][i], intvGovt2: w.intvGovt[2][i], intvRebl1: w.intvRebl[1][i], intvRebl2: w.intvRebl[2][i] },
        lines: ['Les deux camps s’affrontent : tension et agressivité des deux superpuissances à 127'],
      })
    }
    if (w.level === 4) {
      const opposed = (gov: number, reb: number, j: number) => w.log?.add({
        kind: 'relations', step: 'Troupes opposées', country: i, title: `Troupes opposées en ${w.nm(j)} : ${w.nm(gov)} (gouv.) / ${w.nm(reb)} (rebelles)`,
        result: `${-div(w.nastiness, 8)} → ${w.dipAff[gov][reb]}`,
        data: { other: i === gov ? reb : gov, host: j, nastiness: w.nastiness, delta: -div(w.nastiness, 8), dipAff: w.dipAff[gov][reb] },
        lines: [`Variation = −tension / 8 = −${w.nastiness} / 8 = ${-div(w.nastiness, 8)} (appliquée deux fois)`],
      })
      for (let j = 3; j <= NO_CNTRY; j++) {
        if (w.intvGovt[i][j] > 0) {
          for (let k = 1; k <= NO_CNTRY; k++) if (w.intvRebl[k][j] > 0) {
            w.chgDipAff(k, i, -div(w.nastiness, 8))
            w.chgDipAff(i, k, -div(w.nastiness, 8))
            opposed(i, k, j)
          }
        }
        if (w.intvRebl[i][j] > 0) {
          for (let k = 1; k <= NO_CNTRY; k++) if (w.intvGovt[k][j] > 0) {
            w.chgDipAff(k, i, -div(w.nastiness, 8))
            w.chgDipAff(i, k, -div(w.nastiness, 8))
            opposed(k, i, j)
          }
        }
      }
    }
  }
}

/** Minor country i refuses superpower j's policies that its relations no longer allow. */
export function minorRej(w: World, i: number, j: number): void {
  const x = w.dipAff[j][i] + 2 * w.pugnacity[j]
  const before = w.log ? { treaty0: w.treaty[j][i], intvGovt0: w.intvGovt[j][i], econAid0: w.econAid[j][i], miltAid0: w.miltAid[j][i] } : null
  const refused: string[] = []
  let value = w.treatMax(x + w.integrity[j])
  let treatz = w.treaty[j][i]
  if (value < treatz) {
    w.insertNews(i, Verb.Treaty, j, treatz, value, i, false)
    refused.push(`Traité : max(relations + 2 × agressivité + intégrité ${w.integrity[j]} = ${x + w.integrity[j]}) = ${value} < ${treatz}`)
    treatz = value
  }
  const intvGovtz = w.intvGovt[j][i]
  value = w.intvGMax(treatz, x)
  if (value < intvGovtz) {
    w.totlIntv[j] += intvConv(value) - intvConv(intvGovtz)
    w.insertNews(j, Verb.IntvGovt, i, intvGovtz, value, i, false)
    w.intvGovt[j][i] = value
    refused.push(`Troupes : max ${value} < ${intvGovtz}`)
  }
  value = w.econAMax(x)
  if (w.econAid[j][i] > value) {
    refused.push(`Aide économique : max ${value} < ${w.econAid[j][i]}`)
    w.insertNews(j, Verb.Econ, i, w.econAid[j][i], value, i, false)
    w.econAid[j][i] = value
  }
  const miltAidz = w.miltAid[j][i]
  value = w.milMax(x)
  if (value < miltAidz) {
    w.govtAid[i] += milAidConv(value) - milAidConv(miltAidz)
    w.govtAid[j] -= milAidConv(value) - milAidConv(miltAidz)
    w.insertNews(j, Verb.MilAid, i, miltAidz, value, i, false)
    w.miltAid[j][i] = value
    refused.push(`Aide militaire : max ${value} < ${miltAidz}`)
  }
  w.treaty[j][i] = treatz
  if (refused.length) {
    w.log?.add({
      kind: 'rejet', step: 'Refus', country: i, title: `${w.nm(i)} refuse des politiques ${SP[j] ?? w.nm(j)}`, result: `${refused.length} politique(s) réduite(s)`,
      data: { sp: SP[j] ?? j, x, integrity: w.integrity[j], ...before!, treaty: w.treaty[j][i], intvGovt: w.intvGovt[j][i], econAid: w.econAid[j][i], miltAid: w.miltAid[j][i] },
      lines: [`x = relations ${w.dipAff[j][i]} + 2 × agressivité ${w.pugnacity[j]} = ${x}`, ...refused],
    })
  }
}

// ------------------------------------------------------------------ Finlandization

function doFinliz(w: World, i: number): void {
  if (w.level < 3) return
  const y = w.milPowr[i] - w.insgPowr[i]
  const projPowr = [0, 0, 0]
  const selfPowr = [0, 0, 0]
  const prob = (j: number) =>
    clamp(div((w.adventur[j] - w.dipAff[j][i]) * projPowr[j] * (w.pressure[j][i] + 4), selfPowr[j]), 0, 2048)
  const L = w.log ? [`Puissance propre y = armée ${w.milPowr[i]} − rebelles ${w.insgPowr[i]} = ${y}`] : null
  for (let j = 1; j <= 2; j++) {
    projPowr[j] = div(intvConv(w.insgIMax(j, i)) * w.milPowr[j], w.milMen[j])
    const x = div(obligation(w.treaty[3 - j][i]) * w.milPowr[3 - j], 128)
    selfPowr[j] = Math.max(1, y + div(x * w.integrity[3 - j], 128))
    w.finlProb[j][i] = div(prob(j), 8)
    L?.push(
      `${SP[j]} : projection = troupes max ${intvConv(w.insgIMax(j, i))} × puissance ${w.milPowr[j]} / effectifs ${w.milMen[j]} = ${projPowr[j]}`,
      `   défense = max(1, y + garantie ${SP[3 - j]} ${x} × intégrité ${w.integrity[3 - j]} / 128) = ${selfPowr[j]}`,
      `   proba = (aventurisme ${w.adventur[j]} − relations ${w.dipAff[j][i]}) × ${projPowr[j]} × (pression ${w.pressure[j][i]} + 4) / ${selfPowr[j]} = ${prob(j)} (borné 0..2048) / 8 = ${w.finlProb[j][i]}`,
    )
  }
  const data = w.log ? {
    y, projPowr1: projPowr[1], selfPowr1: selfPowr[1], finlProb1: w.finlProb[1][i], projPowr2: projPowr[2], selfPowr2: selfPowr[2], finlProb2: w.finlProb[2][i],
    pressure1: w.pressure[1][i], pressure2: w.pressure[2][i],
  } : null
  const pc = w.finlProb[w.cmptr][i]
  const ph = w.finlProb[w.human][i]
  let who = 0
  if (pc > 127 || ph > 127) {
    who = pc > ph ? w.cmptr : w.human
    const notWho = 3 - who
    w.finlFlag[i] = true
    w.govtWing[i] += div(w.govtWing[who] - w.govtWing[i], 4)
    if (w.govtWing[i] * w.insgWing[i] > 0) {
      w.insgWing[i] = -w.govtWing[i]
      w.leftPowr[i] = w.govtWing[i] < 0
    }
    w.finlGain[who][i] = div(32 * w.prestVal[i], 1024)
    w.finlGain[notWho][i] = div(-32 * w.prestVal[i], 1024)
    w.chgDipAff(i, who, 32)
    w.chgDipAff(i, notWho, -32)
    w.insertNews(i, Verb.Destab, who, 0, 0, 0, false) // "i Finlandizes to who"
    for (let j = 1; j <= 2; j++) w.finlProb[j][i] = div(prob(j), 16)
    L?.push(`Seuil 127 dépassé : se finlandise vers ${SP[who]} · relations +32 / −32 · gain de prestige ${w.finlGain[who][i]}`)
  }
  w.log?.add({
    kind: 'finlandisation', step: 'Risque', country: i, title: `Risque de finlandisation de ${w.nm(i)}`,
    result: who ? `finlandisé vers ${SP[who]}` : `USA ${w.finlProb[1][i]} · URSS ${w.finlProb[2][i]}`,
    data: { ...data!, finlFlag: !!who, toward: who ? SP[who] : '' }, lines: L!,
  })
}

// ------------------------------------------------------------------ revolution and coup

function revolution(w: World, i: number): void {
  w.rebWinFlag[i] = true
  w.virgin[i] = false
  const d = w.govtWing[i]
  w.govtWing[i] = w.insgWing[i]
  w.insgWing[i] = d
  if (w.intvRebl[1][i] + w.intvRebl[2][i] > 0) {
    const patron = w.intvRebl[1][i] > w.intvRebl[2][i] ? 1 : 2
    w.govtWing[i] = div(w.govtWing[patron] + w.govtWing[i], 2)
  }
  w.leftPowr[i] = w.govtWing[i] < 0
  w.gPopular[i] = 10 + div(128 - Math.abs(w.govtWing[i]), 8)
  w.govtStrg[i] = w.insgStrg[i]
  w.insgStrg[i] = 1
  w.insgPowr[i] = 1
  w.strngRat[i] = div(w.govtStrg[i], w.insgStrg[i])
  if (w.cntryRnd[i] > 0) w.insertNews(i, Verb.Econ, i, 4, 0, i, false)
  else w.insertNews(i, Verb.Econ, i, 0, 4, i, false)
  w.govtAid[i] = 0
  const L = w.log ? [`Orientation du nouveau régime ${w.govtWing[i]} (ancien ${d}) · popularité 10 + (128 − |orientation|) / 8 = ${w.gPopular[i]}`] : null
  for (let k = 1; k <= w.cntryCount; k++) {
    if (k === i) continue
    const support = (s: number) => w.insgAid[s][i] + 2 * w.intvRebl[s][i] - w.miltAid[s][i] - 2 * w.intvGovt[s][i]
    let x: number
    if (k < 3) {
      w.integrity[k] = div(w.integrity[k] * (128 - obligation(w.treaty[k][i])), 128)
      x = div(Math.abs(w.insgWing[i] - w.govtWing[k]) - Math.abs(w.govtWing[i] - w.govtWing[k]), 2)
      const ideo = x
      x += 8 * support(k)
      x -= 8 * support(3 - k)
      x = clamp(x, -127, 127)
      w.revlGain[k][i] = div((x - w.dipAff[k][i]) * w.prestVal[i], 1024)
      L?.push(`${SP[k]} : affinité idéologique ${ideo} + 8 × soutien ${support(k)} − 8 × soutien adverse ${support(3 - k)} = ${x} · gain de prestige (${x} − ${w.dipAff[k][i]}) × ${w.prestVal[i]} / 1024 = ${w.revlGain[k][i]} · intégrité → ${w.integrity[k]}`)
      w.treaty[k][i] = 0
      w.econAid[k][i] = 0
    } else {
      x = 8 * support(k)
    }
    x = clamp(x, -127, 127)
    w.dipAff[k][i] = x
    w.dipAff[i][k] = x
    // former government aid becomes rebel aid and vice versa
    let t = w.miltAid[k][i]
    w.miltAid[k][i] = w.insgAid[k][i]
    w.insgAid[k][i] = t
    t = w.intvGovt[k][i]
    w.intvGovt[k][i] = w.intvRebl[k][i]
    w.intvRebl[k][i] = t
    if (k < 3) {
      for (let j = 0; j <= 4; j++) if (w.intvGMax(j, w.dipAff[k][i]) < w.intvGovt[k][i]) w.treaty[k][i] = j + 1
    }
  }
  w.log?.add({
    kind: 'regime', step: 'Révolution', country: i, title: `Révolution en ${w.nm(i)}`, result: `les rebelles prennent le pouvoir · USA ${w.revlGain[1][i]}, URSS ${w.revlGain[2][i]}`,
    data: { govtWing0: d, govtWing: w.govtWing[i], gPopular: w.gPopular[i], revlGain1: w.revlGain[1][i], revlGain2: w.revlGain[2][i], dipAff1: w.dipAff[1][i], dipAff2: w.dipAff[2][i], integrity1: w.integrity[1], integrity2: w.integrity[2] },
    lines: L!,
  })
}

function coup(w: World, i: number): void {
  w.coupFlag[i] = true
  w.virgin[i] = false
  const x0 = w.govtWing[i]
  w.govtWing[i] = w.insgWing[i]
  w.insgWing[i] = x0
  w.leftPowr[i] = w.govtWing[i] < 0
  w.gPopular[i] = 10 + div(128 - Math.abs(w.govtWing[i]), 8)
  w.govtStrg[i] -= div(w.govtStrg[i], 8)
  w.insertNews(i, Verb.MilAid, i, 0, div(w.maturity[i], 64) + 1, i, false)
  const L = w.log ? [`Orientation ${x0} → ${w.govtWing[i]} · popularité ${w.gPopular[i]} · force du gouvernement −1/8 → ${w.govtStrg[i]}`] : null
  for (let j = 1; j <= 2; j++) {
    const loss = clamp(obligation(w.treaty[j][i]) - div(w.maturity[i], 2), 0, 128)
    w.integrity[j] = div(w.integrity[j] * (128 - loss), 128)
    const x = div(Math.abs(w.insgWing[i] - w.govtWing[j]) - Math.abs(w.govtWing[i] - w.govtWing[j]), 2)
    w.coupGain[j][i] = div(x * w.prestVal[i], 1024)
    L?.push(`${SP[j]} : perte d’intégrité ${loss} → ${w.integrity[j]} · affinité idéologique ${x} · gain de prestige ${x} × ${w.prestVal[i]} / 1024 = ${w.coupGain[j][i]}`)
    w.chgDipAff(i, j, x)
    minorRej(w, i, j)
  }
  w.log?.add({
    kind: 'regime', step: 'Coup d’État', country: i, title: `Coup d’État en ${w.nm(i)}`, result: `USA ${w.coupGain[1][i]}, URSS ${w.coupGain[2][i]}`,
    data: { govtWing0: x0, govtWing: w.govtWing[i], gPopular: w.gPopular[i], govtStrg: w.govtStrg[i], coupGain1: w.coupGain[1][i], coupGain2: w.coupGain[2][i], integrity1: w.integrity[1], integrity2: w.integrity[2], dipAff1: w.dipAff[1][i], dipAff2: w.dipAff[2][i] },
    lines: L!,
  })
}

// ------------------------------------------------------------------ yearly development

/** Military balance, insurgency, economy, popularity, coups and Finlandization for every country. */
export function developCountries(w: World): void {
  const arf = (m: number[][], who: number, sp: number) => div(intvConv(m[sp][who]) * w.milPowr[sp], w.milMen[sp])
  for (let i = 1; i <= NO_CNTRY; i++) {
    w.finlFlag[i] = false
    w.coupFlag[i] = false
    w.rebWinFlag[i] = false

    let temp = Math.max(1, div(w.miltSpnd[i] + w.govtAid[i], 2))
    let x = w.milMen[i]
    const g1 = arf(w.intvGovt, i, 1), g2 = arf(w.intvGovt, i, 2)
    w.milPowr[i] = div(4 * temp * x, temp + x) + g1 + g2
    w.log?.add({
      kind: 'militaire', step: 'Puissance', country: i, title: `Puissance militaire de ${w.nm(i)}`, result: `${w.milPowr[i]}`,
      data: { miltSpnd: w.miltSpnd[i], govtAid: w.govtAid[i], temp, milMen: x, base: div(4 * temp * x, temp + x), intvUsa: g1, intvUssr: g2, milPowr: w.milPowr[i] },
      lines: [
        `Moyens t = max(1, (dépenses militaires ${w.miltSpnd[i]} + aide reçue ${w.govtAid[i]}) / 2) = ${temp}`,
        `Effectifs x = ${x}`,
        `4 × t × x / (t + x) = ${div(4 * temp * x, temp + x)}`,
        `+ troupes étrangères pour le gouvernement : USA ${g1}, URSS ${g2}`,
      ],
    })

    if (i > 2 && w.level === 4) {
      for (let j = 3; j <= NO_CNTRY; j++) {
        if (w.dipAff[i][j] !== -127) continue
        // war between minor countries
        const before = w.milPowr[i]
        w.milPowr[i] -= div(w.milPowr[j], 4)
        w.gnp[i] = Math.max(1, w.gnp[i] - div(w.milPowr[j], 4))
        const surrender = w.milPowr[i] < 1
        if (surrender) {
          for (let k = 1; k <= NO_CNTRY; k++) w.dipAff[i][k] = w.dipAff[j][k] <= -127 ? -120 : w.dipAff[j][k]
          w.govtWing[i] = w.govtWing[j]
          w.insgWing[i] = -w.govtWing[j]
          w.insertNews(i, Verb.Pressure, j, 2, 1, i, false) // surrender
          w.dipAff[i][j] = 0
          w.dipAff[j][i] = 0
          w.dipAff[i][i] = 127
          const k = w.news.findIndex((n) => n.subject === j && n.verb === Verb.Pressure && n.object === i && n.newVal === 1 && n.oldVal === 1)
          if (k >= 0) w.news.splice(k, 1)
        } else {
          w.insertNews(i, Verb.Pressure, j, 1, 1, i, true) // fighting
          w.dipAff[j][i] = -127
        }
        w.log?.add({
          kind: 'militaire', step: 'Guerre', country: i, title: `Guerre : ${w.nm(i)} contre ${w.nm(j)}`, result: surrender ? 'capitulation' : `puissance ${w.milPowr[i]}`,
          data: { enemy: w.names[j], milPowr0: before, enemyPowr: w.milPowr[j], milPowr: w.milPowr[i], gnp: w.gnp[i], surrender },
          lines: [`Puissance ${before} − puissance ennemie ${w.milPowr[j]} / 4 = ${w.milPowr[i]}`, `PNB → ${w.gnp[i]}`, ...(surrender ? [`Capitule : adopte les relations et l’orientation de ${w.nm(j)}`] : [])],
        })
      }
    }

    // insurgency
    x = div(div((256 - w.maturity[i]) * w.popln[i], 256) * w.sqrtStrg[i], 80)
    temp = 0
    for (let j = 1; j <= w.cntryCount; j++) temp += 2 * milAidConv(w.insgAid[j][i])
    const rebelArms = temp
    if (temp < div(x, 8) + 1) temp = div(x, 8) + 1
    const r1 = arf(w.intvRebl, i, 1), r2 = arf(w.intvRebl, i, 2)
    w.insgPowr[i] = div(4 * temp * x, temp + x) + r1 + r2
    if (i < 3) w.insgPowr[i] = 1
    // combat: each side loses a quarter of the other's strength
    const milBefore = w.milPowr[i], insBefore = w.insgPowr[i]
    w.milPowr[i] = Math.max(1, w.milPowr[i] - div(w.insgPowr[i], 4))
    w.insgPowr[i] = Math.max(1, w.insgPowr[i] - div(w.milPowr[i], 4))
    w.govtStrg[i] = w.milPowr[i]
    w.insgStrg[i] = w.insgPowr[i]
    w.strngRat[i] = div(w.govtStrg[i], w.insgStrg[i])
    if (w.insgStrg[i] === 1 && w.govtStrg[i] < 8192) w.strngRat[i] *= 4
    w.log?.add({
      kind: 'insurrection', step: 'Combat', country: i, title: `Insurrection en ${w.nm(i)}`, result: `rapport de forces ${w.strngRat[i]}${w.strngRat[i] < 1 ? ' → révolution' : ''}`,
      data: {
        maturity: w.maturity[i], popln: w.popln[i], sqrtStrg: w.sqrtStrg[i], recruits: x, rebelArms, temp, intvUsa: r1, intvUssr: r2,
        milPowr0: milBefore, insgPowr0: insBefore, milPowr: w.milPowr[i], insgPowr: w.insgPowr[i], strngRat: w.strngRat[i], revolution: w.strngRat[i] < 1,
      },
      lines: [
        `Recrues x = ((256 − maturité ${w.maturity[i]}) × population ${w.popln[i]} / 256) × √rapport ${w.sqrtStrg[i]} / 80 = ${x}`,
        `Armes t = 2 × armes reçues (${rebelArms}), au moins x / 8 + 1 → ${temp}`,
        `Rebelles = 4 × t × x / (t + x) ${div(4 * temp * x, temp + x)} + troupes USA ${r1} + URSS ${r2}${i < 3 ? ' (superpuissance : 1)' : ''} = ${insBefore}`,
        `Combat : armée ${milBefore} − rebelles / 4 = ${w.milPowr[i]} ; rebelles ${insBefore} − armée / 4 = ${w.insgPowr[i]}`,
        `Rapport de forces = ${w.govtStrg[i]} / ${w.insgStrg[i]}${w.insgStrg[i] === 1 && w.govtStrg[i] < 8192 ? ' × 4' : ''} = ${w.strngRat[i]}`,
      ],
    })
    if (w.strngRat[i] < 1) revolution(w, i)

    // economy: consumer, investment and military pressures share the GNP
    const consFrac0 = w.consFrac[i], invtFrac0 = w.invtFrac[i], miltFrac0 = w.miltFrac[i]
    const consPress = Math.max(1, (20 - w.gPopular[i]) * 10)
    const invtPress = Math.max(1, (80 - w.invtFrac[i]) * 2)
    w.miltPress[i] = Math.max(1, w.sqrtStrg[i] + w.finlProb[1][i] + w.finlProb[2][i])
    const sum = consPress + invtPress + w.miltPress[i]
    let pot = 0
    if (w.consFrac[i] > 16) { w.consFrac[i] -= 8; pot += 8 }
    if (w.invtFrac[i] > 16) { w.invtFrac[i] -= 8; pot += 8 }
    if (w.miltFrac[i] > 16) { w.miltFrac[i] -= 8; pot += 8 }
    w.invtFrac[i] += div(invtPress * pot, sum)
    w.miltFrac[i] += div(w.miltPress[i] * pot, sum)
    w.consFrac[i] = 255 - w.invtFrac[i] - w.miltFrac[i]
    const oldConsS = div(w.consSpnd[i] * 255, w.popln[i])
    const aid = econConv(w.econAid[1][i]) + econConv(w.econAid[2][i])
    const gnp0 = w.gnp[i], popln0 = w.popln[i]
    let pseudGnp = w.gnp[i] + aid
    w.gnp[i] += div(pseudGnp * 2 * (w.invtFrac[i] - 30), 1000)
    pseudGnp = w.gnp[i] + aid
    const growth = Math.max(1, 30 - div(oldConsS, 40))
    w.popln[i] += div(Math.max(1000, w.popln[i] * growth), 1000)
    w.milMen[i] = div(w.popln[i] * w.drafFrac[i], 256)
    w.consSpnd[i] = div(w.consFrac[i] * pseudGnp, 256)
    w.invtSpnd[i] = Math.max(1, div(w.invtFrac[i] * pseudGnp, 256))
    w.miltSpnd[i] = Math.max(1, (pseudGnp - w.consSpnd[i] - w.invtSpnd[i]) * 10)
    if (i < 3) {
      // superpowers must never have negative available weapons
      while (div(w.miltSpnd[i], 8) + w.govtAid[i] < 0) {
        w.consFrac[i]--
        w.miltFrac[i]++
        w.consSpnd[i] = div(w.consFrac[i] * pseudGnp, 256)
        w.miltSpnd[i] = (pseudGnp - w.consSpnd[i] - w.invtSpnd[i]) * 10
      }
    }
    w.log?.add({
      kind: 'economie', step: 'Économie', country: i, title: `Économie de ${w.nm(i)}`, result: `PNB ${gnp0} → ${w.gnp[i]} · population ${popln0} → ${w.popln[i]}`,
      data: {
        gPopular: w.gPopular[i], consPress, invtPress, miltPress: w.miltPress[i], consFrac0, invtFrac0, miltFrac0, pot,
        consFrac: w.consFrac[i], invtFrac: w.invtFrac[i], miltFrac: w.miltFrac[i], aid, gnp0, gnp: w.gnp[i], oldConsS, growth,
        popln0, popln: w.popln[i], milMen: w.milMen[i], consSpnd: w.consSpnd[i], invtSpnd: w.invtSpnd[i], miltSpnd: w.miltSpnd[i],
      },
      lines: [
        `Pressions : consommation (20 − popularité ${w.gPopular[i]}) × 10 = ${consPress} · investissement (80 − ${invtFrac0}) × 2 = ${invtPress} · militaire √rapport + finlandisation = ${w.miltPress[i]}`,
        `Parts conso / invest. / armée (sur 255) : ${consFrac0} / ${invtFrac0} / ${miltFrac0} → ${w.consFrac[i]} / ${w.invtFrac[i]} / ${w.miltFrac[i]} (pot redistribué ${pot})`,
        `Aide économique reçue ${aid} · PNB + (PNB + aide) × 2 × (part invest. − 30) / 1000 = ${w.gnp[i]}`,
        `Croissance démographique max(1, 30 − conso par tête ${oldConsS} / 40) = ${growth} ‰ · effectifs militaires ${w.milMen[i]}`,
        `Dépenses : conso ${w.consSpnd[i]} · invest. ${w.invtSpnd[i]} · militaires ${w.miltSpnd[i]}`,
      ],
    })

    // popularity: growth of consumption per head, bonus for extremists, minus 3% expected
    const cons = div(w.consFrac[i] * pseudGnp, w.popln[i])
    const delta = div((cons - oldConsS) * 100, oldConsS + 1)
    const gPopular0 = w.gPopular[i]
    w.gPopular[i] = Math.max(0, w.gPopular[i] + delta + div(Math.abs(w.govtWing[i]), 64) - 3)
    if (i < 3) w.gPopular[i] = 20
    const destab = w.destab[1][i] + w.destab[2][i]
    const isCoup = w.gPopular[i] <= destab && w.level > 1
    w.log?.add({
      kind: 'popularite', step: 'Popularité', country: i, title: `Popularité du gouvernement de ${w.nm(i)}`, result: `${gPopular0} → ${w.gPopular[i]}${isCoup ? ' → coup d’État' : ''}`,
      data: { oldConsS, cons, delta, govtWing: w.govtWing[i], gPopular0, gPopular: w.gPopular[i], destab, coup: isCoup },
      lines: [
        `Consommation par tête ${oldConsS} → ${cons} : variation (${cons} − ${oldConsS}) × 100 / ${oldConsS + 1} = ${delta} %`,
        `Popularité = max(0, ${gPopular0} + ${delta} + |orientation ${w.govtWing[i]}| / 64 − 3)${i < 3 ? ' (superpuissance : 20)' : ''} = ${w.gPopular[i]}`,
        `Coup d’État si popularité ≤ déstabilisation USA ${w.destab[1][i]} + URSS ${w.destab[2][i]} = ${destab}${w.level > 1 ? '' : ' (pas au niveau 1)'}`,
      ],
    })
    if (w.gPopular[i] <= w.destab[1][i] + w.destab[2][i] && w.level > 1) coup(w, i)

    w.cntryRnd[i] = w.random()
    w.sqrtStrg[i] = isqrt(clamp(div(6400 * w.insgStrg[i], w.govtStrg[i]), 1, 6400))
    if (i > 2) doFinliz(w, i)
    // pressure and destabilization last one year
    for (let j = 1; j <= 2; j++) {
      w.pressure[j][i] = 0
      w.destab[j][i] = 0
    }
    for (let j = 1; j <= w.cntryCount; j++) {
      const ma = w.insgAMax(j, i)
      const mi = w.insgIMax(j, i)
      if (w.insgAid[j][i] > ma) w.insgAid[j][i] = ma
      if (w.intvRebl[j][i] > mi) w.intvRebl[j][i] = mi
      if (j < 3) minorRej(w, i, j)
    }
  }
}

// ------------------------------------------------------------------ superpower AI

/** The computer superpower sets its policies toward every minor country. */
export function computerAI(w: World): void {
  const c = w.cmptr
  let { maxIntv, maxInsg } = w.maxPolicy(c)
  let sum = 0
  for (let i = 3; i <= NO_CNTRY; i++) sum += econConv(w.econAid[c][i])
  let maxEcon = 5
  const avail = div(w.gnp[c], 44) - 2 * sum
  for (let i = 4; i >= 0; i--) if (econConv(i + 1) > avail) maxEcon = i
  w.log?.add({
    kind: 'ia', step: 'Moyens', country: c, title: `Moyens de l’ordinateur (${SP[c]})`, result: `troupes max ${maxIntv} · armes max ${maxInsg} · aide éco. max ${maxEcon}`,
    data: { arms: div(w.miltSpnd[c], 8) + w.govtAid[c], troops: div(w.milMen[c], 4) - w.totlIntv[c], econ: avail, maxIntv, maxInsg, maxEcon },
    lines: [
      `Armes disponibles = dépenses militaires ${w.miltSpnd[c]} / 8 + solde d’aide ${w.govtAid[c]} = ${div(w.miltSpnd[c], 8) + w.govtAid[c]}`,
      `Troupes disponibles = effectifs ${w.milMen[c]} / 4 − déjà engagées ${w.totlIntv[c]} = ${div(w.milMen[c], 4) - w.totlIntv[c]}`,
      `Aide économique disponible = PNB ${w.gnp[c]} / 44 − 2 × aide en cours ${sum} = ${avail}`,
    ],
  })

  for (let j = 3; j <= NO_CNTRY; j++) {
    const hFinProb = w.finlProb[w.human][j]
    const daij = w.dipAff[c][j]
    let oblig = daij + obligation(w.treaty[c][j]) - w.dipAff[w.human][j]
    const oblig0 = oblig
    if (oblig < 0) oblig = div(oblig * w.nastiness, 32)
    if (oblig > 128) oblig = 128
    if (oblig === 0) oblig = 1
    const head = w.log ? `Engagement = relations ${daij} + obligation du traité ${obligation(w.treaty[c][j])} − relations avec le joueur ${w.dipAff[w.human][j]} = ${oblig0}${oblig0 < 0 ? ` × tension ${w.nastiness} / 32` : ''} → ${oblig}` : ''

    for (let k = 0; k <= 7; k++) {
      const verb = k as Verb
      let need = 0
      let max = 5
      let oldVal = 0
      let newVal = 0
      let backoffs = 0
      const L = w.log ? [head] : null
      switch (verb) {
        case Verb.Econ:
          need = Math.max(0, div(22 - w.gPopular[j], 3))
          max = Math.min(w.econAMax(daij), maxEcon)
          oldVal = w.econAid[c][j]
          L?.push(`Besoin = max(0, (22 − popularité ${w.gPopular[j]}) / 3) = ${need}${w.level === 1 ? ' → 0 (niveau 1)' : ''} · max = min(relations ${w.econAMax(daij)}, moyens ${maxEcon}) = ${max}`)
          if (w.level === 1) need = 0
          break
        case Verb.MilAid:
          oldVal = w.miltAid[c][j]
          need = div(w.sqrtStrg[j] + hFinProb, 8)
          max = Math.min(w.milMax(daij), maxInsg)
          L?.push(`Besoin = (√rapport ${w.sqrtStrg[j]} + finlandisation vers le joueur ${hFinProb}) / 8 = ${need} · max = min(relations ${w.milMax(daij)}, moyens ${maxInsg}) = ${max}`)
          break
        case Verb.InsgAid: {
          need = -10
          oldVal = w.insgAid[c][j]
          max = Math.min(w.insgAMax(c, j), maxInsg)
          const r = w.strngRat[j]
          let y = 0
          if (r < 128) y = 1
          if (r < 64) y = 2
          if (r < 32) y = 3
          if (r < 8) y = 4
          if (r < 2) y = 5
          if (y < max) max = y
          L?.push(`Besoin = −10 (l’ordinateur n’arme jamais de lui-même les rebelles) · max = min(accès ${w.insgAMax(c, j)}, moyens ${maxInsg}, selon rapport ${r} : ${y}) = ${max}`)
          break
        }
        case Verb.IntvGovt: {
          oldVal = w.intvGovt[c][j]
          max = w.intvGMax(w.treaty[c][j], daij)
          need = div(w.sqrtStrg[j] + hFinProb, 8)
          let threat = 0
          for (let i = 3; i <= NO_CNTRY; i++) {
            if (i !== j && w.contigus[i][j] && !w.contigus[c][i] && w.dipAff[c][i] < 0) threat += 128 - w.dipAff[c][i]
          }
          need += div(threat, 64)
          const maxRel = max
          if (max > maxIntv) max = maxIntv
          L?.push(`Besoin = (√rapport ${w.sqrtStrg[j]} + finlandisation ${hFinProb}) / 8 + menace des voisins hostiles ${threat} / 64 = ${need} · max = min(traité/relations ${maxRel}, moyens ${maxIntv}) = ${max}`)
          break
        }
        case Verb.IntvRebl:
          oldVal = w.intvRebl[c][j]
          newVal = 0
          max = 5
          if (daij < div(w.nastiness, 2) - 64) {
            max = w.insgIMax(c, j)
            const projPowr = div(intvConv(max) * w.milPowr[c], w.milMen[c])
            if (max > maxIntv) max = maxIntv
            L?.push(`Relations ${daij} < tension ${w.nastiness} / 2 − 64 : intervention envisagée · max ${max} · force projetée ${projPowr} vs armée ${w.milPowr[j]}`)
            if (projPowr > w.milPowr[j]) {
              newVal = max
              const x = w.gImpt(c, verb, j, oldVal, newVal).total
              const r = div(w.random(), 1024)
              L?.push(`Importance ${x} vs tirage ${r} : ${x > r ? 'trop risqué, renonce' : 'intervient'}`)
              if (x > r) newVal = oldVal
            }
          } else L?.push(`Relations ${daij} ≥ tension ${w.nastiness} / 2 − 64 = ${div(w.nastiness, 2) - 64} : pas d’intervention`)
          break
        case Verb.Pressure: {
          let x = -div(144 - w.finlProb[c][j], 16)
          const xRaw = x
          if (x > 0 || x < -5) x = 0
          need = x
          max = 5
          oldVal = 0
          L?.push(`Besoin = −(144 − finlandisation vers l’ordinateur ${w.finlProb[c][j]}) / 16 = ${xRaw} → ${x}${w.level < 3 ? ' → 0 (niveau < 3)' : ''}`)
          if (w.level < 3) need = 0
          break
        }
        case Verb.Treaty: {
          oldVal = w.treaty[c][j]
          let x = 1 + div(hFinProb, 16) - div(w.sqrtStrg[j], 24) - div(20 - w.gPopular[j], 8)
          const xRaw = x
          if (x < 0 || w.level < 3) x = 0
          need = oldVal + x
          max = Math.max(oldVal, w.treatMax(w.integrity[c] + daij - w.pugnacity[c]))
          L?.push(`Besoin = traité ${oldVal} + (1 + finlandisation ${hFinProb} / 16 − √rapport ${w.sqrtStrg[j]} / 24 − (20 − popularité ${w.gPopular[j]}) / 8 = ${xRaw} → ${x}) = ${need} · max ${max}`)
          break
        }
        case Verb.Destab:
          oldVal = w.destab[c][j]
          need = Math.min(0, div(w.gPopular[j] - 20, 2))
          if (w.level === 1) need = 0
          max = 5
          L?.push(`Besoin = min(0, (popularité ${w.gPopular[j]} − 20) / 2) = ${need}`)
          break
      }
      const need0 = need
      if (verb !== Verb.IntvRebl) {
        if (verb !== Verb.Treaty && verb !== Verb.Pressure && verb !== Verb.IntvGovt) {
          L?.push(`× engagement ${oblig} / 128 = ${div(need * oblig, 128)}`)
          need = div(need * oblig, 128)
        }
        need = clamp(need, 0, max)
        if (need < 0) need = 0
        newVal = need
        L?.push(`Niveau visé (borné 0..${max}) = ${newVal}`)
        // back off while the move looks too provocative
        while (newVal > oldVal) {
          const g = w.gImpt(c, verb, j, oldVal, newVal).total
          const r = Math.abs(div(w.random(), 512))
          L?.push(`Niveau ${newVal} : importance ${g} ${g > r ? '>' : '≤'} tirage ${r}${g > r ? ' → trop provocant, recule' : ' → accepté'}`)
          if (!(g > r)) break
          newVal--
          backoffs++
        }
      }
      if (newVal < oldVal && verb === Verb.Treaty) newVal = oldVal
      w.log?.add({
        kind: 'ia', step: VERB_LABEL[verb], country: j, title: `${SP[c]} · ${VERB_LABEL[verb]} → ${w.nm(j)}`, result: newVal === oldVal ? `inchangé (${oldVal})` : `${oldVal} → ${newVal}`,
        data: { oblig0, oblig, need0, need, max, oldVal, newVal, backoffs }, lines: L!,
      })
      if (newVal !== oldVal) {
        w.doPolicy(c, verb, j, newVal, newVal < oldVal)
        ;({ maxIntv, maxInsg } = w.maxPolicy(c))
      }
    }
  }
}

/** Level 4: minor countries arm friends and rebels in their own neighbourhood. */
export function minorAI(w: World): void {
  for (let i = 3; i <= NO_CNTRY; i++) {
    const influe = w.influence(1, i) - w.influence(2, i)
    for (let j = 3; j <= NO_CNTRY; j++) {
      if (i === j || !w.minorSph[i][j] || w.dipAff[i][j] === -127) continue
      if (w.miltAid[i][j] > 0) w.doPolicy(i, Verb.MilAid, j, 0, false)
      if (w.insgAid[i][j] > 0) w.doPolicy(i, Verb.InsgAid, j, 0, false)
      if (w.intvGovt[i][j] > 0) w.doPolicy(i, Verb.IntvGovt, j, 0, false)
      if (w.intvRebl[i][j] > 0) w.doPolicy(i, Verb.IntvRebl, j, 0, false)
    }
    let sRat = w.strngRat[i]
    for (let j = 3; j <= NO_CNTRY; j++) if (w.dipAff[i][j] === -127) sRat = 0
    let resrc = 0
    if (sRat > 64) resrc = 10
    if (sRat > 128) resrc = 20
    if (sRat > 256) resrc = 30
    if (sRat > 512) resrc = 40
    if (resrc === 0) {
      w.log?.add({
        kind: 'mineurs', step: 'Politique', country: i, title: `Politique extérieure de ${w.nm(i)}`, result: 'aucune (pays trop instable ou en guerre)',
        data: { strngRat: sRat, resrc: 0, influe, total: 0, targets: 0 },
        lines: [`Rapport de forces ${w.strngRat[i]}${sRat === 0 ? ' (en guerre : 0)' : ''} ≤ 64`],
      })
      continue
    }
    const resBase = resrc
    resrc += div(w.adventur[1] + w.adventur[2] + w.nastiness, 8)

    const targets: { id: number; weight: number }[] = []
    for (let j = 3; j <= NO_CNTRY; j++) {
      if (j === i || !w.minorSph[i][j]) continue
      let s = 0
      for (let k = 1; k <= NO_CNTRY; k++) s -= w.dipAff[k][j] * w.dipAff[i][k]
      let weight = Math.abs(div(w.dipAff[i][j] * s, 16383))
      weight += (w.dontMess[j] - w.aveDMess) * influe
      if (weight < 1) weight = 1
      targets.push({ id: j, weight })
    }
    targets.sort((a, b) => b.weight - a.weight)
    const total = targets.reduce((s, t) => s + t.weight, 0)
    const level = (v: number) => (v > 100 ? 5 : v > 50 ? 4 : v > 20 ? 3 : v > 5 ? 2 : v > 1 ? 1 : 0)
    const L = w.log ? [
      `Ressources = ${resBase} (rapport de forces ${sRat}) + (aventurisme ${w.adventur[1]} + ${w.adventur[2]} + tension ${w.nastiness}) / 8 = ${resrc}`,
      `Influence USA − URSS = ${influe} · poids total ${total}`,
    ] : null
    for (const t of targets) {
      if (t.weight <= 1) continue
      const who = t.id
      let newWeapons = level(div((t.weight - 1) * resrc * w.miltSpnd[i], total * 100))
      let newTroops = level(div((t.weight - 1) * resrc * w.milMen[i], total * 100))
      const r = w.strngRat[who]
      let maxStuff = 0
      if (r < 256) maxStuff = 1
      if (r < 128) maxStuff = 2
      if (r < 64) maxStuff = 3
      if (r < 16) maxStuff = 4
      if (r < 4) maxStuff = 5
      const friend = w.dipAff[i][who] > 0
      if (friend) {
        newWeapons = Math.min(newWeapons, w.milMax(w.dipAff[who][i]), maxStuff)
        w.doPolicy(i, Verb.MilAid, who, newWeapons, true)
        newTroops = Math.min(newTroops, w.intvGMax(5, w.dipAff[who][i]), maxStuff)
        w.doPolicy(i, Verb.IntvGovt, who, newTroops, true)
      } else {
        newWeapons = Math.min(newWeapons, w.insgAMax(i, who), maxStuff)
        w.doPolicy(i, Verb.InsgAid, who, newWeapons, true)
        newTroops = Math.min(newTroops, w.insgIMax(i, who), maxStuff)
        w.doPolicy(i, Verb.IntvRebl, who, newTroops, true)
      }
      L?.push(`${w.nm(who)} (poids ${t.weight}, ${friend ? 'ami : aide au gouvernement' : 'hostile : aide aux rebelles'}, plafond ${maxStuff}) : armes ${newWeapons}, troupes ${newTroops}`)
    }
    const aimed = targets.filter((t) => t.weight > 1).length
    w.log?.add({
      kind: 'mineurs', step: 'Politique', country: i, title: `Politique extérieure de ${w.nm(i)}`, result: `${aimed} pays visé(s)`,
      data: { strngRat: sRat, resrc, influe, total, targets: aimed }, lines: L!,
    })
  }
}

/** Yearly reaction of every minor country to the superpowers' current policies. */
export function annualReactions(w: World): void {
  for (let i = 3; i <= NO_CNTRY; i++) {
    for (let j = 1; j <= 2; j++) {
      minorRej(w, i, j)
      const terms = [
        div(25 * div(256 * econConv(w.econAid[j][i]), w.gnp[i]), w.gPopular[i] + 1),
        -32 * w.destab[j][i],
        div(w.miltAid[j][i] * w.miltPress[i], 8),
        -12 * w.insgAid[j][i],
        div(w.intvGovt[j][i] * w.miltPress[i], 4),
        -64 * w.intvRebl[j][i],
        -16 * w.pressure[j][i],
        div(div(w.treaty[j][i] * w.integrity[j], 128) * w.miltPress[i], 8),
        8 * (w.trade[j][i] - 3),
      ]
      const sum = terms.reduce((s, t) => s + t, 0)
      const x = div(sum, 8)
      const dipAff0 = w.dipAff[i][j]
      w.chgDipAff(i, j, x)
      w.log?.add({
        kind: 'relations', step: `Réaction à ${SP[j]}`, country: i, title: `Réaction de ${w.nm(i)} à la politique ${SP[j]}`, result: `${x >= 0 ? '+' : ''}${x} → ${w.dipAff[i][j]}`,
        data: {
          tEcon: terms[0], tDestab: terms[1], tMiltAid: terms[2], tInsgAid: terms[3], tIntvGovt: terms[4], tIntvRebl: terms[5],
          tPressure: terms[6], tTreaty: terms[7], tTrade: terms[8], sum, delta: x, dipAff0, dipAff: w.dipAff[i][j],
        },
        lines: [
          `Aide économique ${terms[0]} · déstabilisation ${terms[1]} · aide militaire ${terms[2]} · armes aux rebelles ${terms[3]}`,
          `Troupes pour le gouvernement ${terms[4]} · pour les rebelles ${terms[5]} · pression ${terms[6]} · traité ${terms[7]} · commerce ${terms[8]}`,
          `Somme ${sum} / 8 = ${x} · relations ${dipAff0} → ${w.dipAff[i][j]} (bornées à ±127)`,
        ],
      })
    }
    if (w.level === 4) {
      for (let j = 3; j <= NO_CNTRY; j++) {
        let x =
          div(w.miltAid[j][i] * w.miltPress[i], 8) -
          12 * w.insgAid[j][i] +
          div(w.intvGovt[j][i] * w.miltPress[i], 4) -
          64 * w.intvRebl[j][i]
        x = div(x, 8)
        w.chgDipAff(i, j, x)
        if (x !== 0) w.log?.add({
          kind: 'relations', step: 'Réaction à un pays mineur', country: i, title: `Réaction de ${w.nm(i)} à la politique de ${w.nm(j)}`, result: `${x >= 0 ? '+' : ''}${x} → ${w.dipAff[i][j]}`,
          data: { other: w.names[j], miltAid: w.miltAid[j][i], insgAid: w.insgAid[j][i], intvGovt: w.intvGovt[j][i], intvRebl: w.intvRebl[j][i], miltPress: w.miltPress[i], delta: x, dipAff: w.dipAff[i][j] },
        })
      }
    }
  }
  w.calcScores()
}

/** Prestige of each superpower written out, with the countries that weigh most. */
export function logScores(w: World, why: string): void {
  if (!w.log) return
  const lines: string[] = []
  for (let sp = 1; sp <= 2; sp++) {
    const parts = []
    for (let i = 3; i <= NO_CNTRY; i++) parts.push({ i, v: w.dipAff[i][sp] * w.prestVal[i] })
    const sum = parts.reduce((s, p) => s + p.v, 0)
    parts.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    lines.push(`${SP[sp]} : Σ relations × prestige = ${sum} / 1024 = ${div(sum, 1024)} ; initial ${sp === 1 ? w.iUsaStrng : w.iUssrStrng} ; score ${w.score(sp)}`)
    lines.push(`   principaux : ${parts.slice(0, 6).map((p) => `${w.names[p.i]} ${w.dipAff[p.i][sp]} × ${w.prestVal[p.i]}`).join(' · ')}`)
  }
  w.log.add({
    kind: 'prestige', step: 'Scores', country: 0, title: `Prestige ${why}`, result: `USA ${w.score(1)} · URSS ${w.score(2)}`,
    data: { usaStrng: w.usaStrng, ussrStrng: w.ussrStrng, iUsaStrng: w.iUsaStrng, iUssrStrng: w.iUssrStrng, score1: w.score(1), score2: w.score(2) },
    lines,
  })
}

/** End of the computer's move: decay of tension, reputations, scores. */
export function closeYear(w: World): void {
  const nastiness0 = w.nastiness
  const before = w.log ? `tension ${w.nastiness}, agressivité ${w.pugnacity[1]} / ${w.pugnacity[2]}, intégrité ${w.integrity[1]} / ${w.integrity[2]}` : ''
  w.nastiness = Math.max(0, w.nastiness - 4)
  for (let j = 1; j <= 2; j++) {
    w.pugnacity[j] -= 4
    w.adventur[j] = Math.max(1, w.pugnacity[j] + w.nastiness - w.pugnacity[3 - j] - w.miltFrac[j] + 32)
    w.integrity[j] = Math.min(127, w.integrity[j] + 5)
  }
  w.log?.add({
    kind: 'tension', step: 'Fin d’année', country: 0, title: `Fin d’année ${w.year} : apaisement`, result: `tension ${w.nastiness}`,
    data: { nastiness0, nastiness: w.nastiness, pugnacity1: w.pugnacity[1], pugnacity2: w.pugnacity[2], adventur1: w.adventur[1], adventur2: w.adventur[2], integrity1: w.integrity[1], integrity2: w.integrity[2] },
    lines: [
      `Avant : ${before}`,
      'Tension − 4 · agressivité − 4 · intégrité + 5 (max 127)',
      ...[1, 2].map((j) => `${SP[j]} : aventurisme = max(1, agressivité ${w.pugnacity[j]} + tension ${w.nastiness} − agressivité adverse ${w.pugnacity[3 - j]} − part militaire ${w.miltFrac[j]} + 32) = ${w.adventur[j]} · intégrité ${w.integrity[j]}`),
    ],
  })
  w.calcScores()
  if (w.year === FIRST_YEAR) {
    w.iUsaStrng = w.usaStrng
    w.iUssrStrng = w.ussrStrng
    for (let i = 1; i <= NO_CNTRY; i++) {
      w.oldGStrg[i] = w.govtStrg[i]
      w.oldIStrg[i] = w.insgStrg[i]
      w.oldGPopl[i] = w.gPopular[i]
      w.oldFinPb[1][i] = w.finlProb[1][i]
      w.oldFinPb[2][i] = w.finlProb[2][i]
    }
  }
  w.oldAScor = w.usaStrng
  w.oldRScor = w.ussrStrng
  w.usaScore[w.year - FIRST_YEAR] = w.usaStrng - w.iUsaStrng
  w.ussrScore[w.year - FIRST_YEAR] = w.ussrStrng - w.iUssrStrng
  logScores(w, `à la fin de ${w.year}`)
}
