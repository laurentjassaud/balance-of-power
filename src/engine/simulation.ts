import {
  World, NO_CNTRY, FIRST_YEAR, Verb, div, isqrt, clamp, econConv, milAidConv, intvConv, obligation,
} from './core'

// ------------------------------------------------------------------ start of turn

/** Year advance, snapshots for "rate of change" displays, superpower-vs-superpower battles. */
export function prePlanMove(w: World): void {
  w.year++
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
    }
    if (w.level === 4) {
      for (let j = 3; j <= NO_CNTRY; j++) {
        if (w.intvGovt[i][j] > 0) {
          for (let k = 1; k <= NO_CNTRY; k++) if (w.intvRebl[k][j] > 0) {
            w.chgDipAff(k, i, -div(w.nastiness, 8))
            w.chgDipAff(i, k, -div(w.nastiness, 8))
          }
        }
        if (w.intvRebl[i][j] > 0) {
          for (let k = 1; k <= NO_CNTRY; k++) if (w.intvGovt[k][j] > 0) {
            w.chgDipAff(k, i, -div(w.nastiness, 8))
            w.chgDipAff(i, k, -div(w.nastiness, 8))
          }
        }
      }
    }
  }
}

/** Minor country i refuses superpower j's policies that its relations no longer allow. */
export function minorRej(w: World, i: number, j: number): void {
  const x = w.dipAff[j][i] + 2 * w.pugnacity[j]
  let value = w.treatMax(x + w.integrity[j])
  let treatz = w.treaty[j][i]
  if (value < treatz) {
    w.insertNews(i, Verb.Treaty, j, treatz, value, i, false)
    treatz = value
  }
  const intvGovtz = w.intvGovt[j][i]
  value = w.intvGMax(treatz, x)
  if (value < intvGovtz) {
    w.totlIntv[j] += intvConv(value) - intvConv(intvGovtz)
    w.insertNews(j, Verb.IntvGovt, i, intvGovtz, value, i, false)
    w.intvGovt[j][i] = value
  }
  value = w.econAMax(x)
  if (w.econAid[j][i] > value) {
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
  }
  w.treaty[j][i] = treatz
}

// ------------------------------------------------------------------ Finlandization

function doFinliz(w: World, i: number): void {
  if (w.level < 3) return
  const y = w.milPowr[i] - w.insgPowr[i]
  const projPowr = [0, 0, 0]
  const selfPowr = [0, 0, 0]
  const prob = (j: number) =>
    clamp(div((w.adventur[j] - w.dipAff[j][i]) * projPowr[j] * (w.pressure[j][i] + 4), selfPowr[j]), 0, 2048)
  for (let j = 1; j <= 2; j++) {
    projPowr[j] = div(intvConv(w.insgIMax(j, i)) * w.milPowr[j], w.milMen[j])
    const x = div(obligation(w.treaty[3 - j][i]) * w.milPowr[3 - j], 128)
    selfPowr[j] = Math.max(1, y + div(x * w.integrity[3 - j], 128))
    w.finlProb[j][i] = div(prob(j), 8)
  }
  const pc = w.finlProb[w.cmptr][i]
  const ph = w.finlProb[w.human][i]
  if (pc > 127 || ph > 127) {
    const who = pc > ph ? w.cmptr : w.human
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
  }
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
  for (let k = 1; k <= w.cntryCount; k++) {
    if (k === i) continue
    const support = (s: number) => w.insgAid[s][i] + 2 * w.intvRebl[s][i] - w.miltAid[s][i] - 2 * w.intvGovt[s][i]
    let x: number
    if (k < 3) {
      w.integrity[k] = div(w.integrity[k] * (128 - obligation(w.treaty[k][i])), 128)
      x = div(Math.abs(w.insgWing[i] - w.govtWing[k]) - Math.abs(w.govtWing[i] - w.govtWing[k]), 2)
      x += 8 * support(k)
      x -= 8 * support(3 - k)
      x = clamp(x, -127, 127)
      w.revlGain[k][i] = div((x - w.dipAff[k][i]) * w.prestVal[i], 1024)
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
  for (let j = 1; j <= 2; j++) {
    const loss = clamp(obligation(w.treaty[j][i]) - div(w.maturity[i], 2), 0, 128)
    w.integrity[j] = div(w.integrity[j] * (128 - loss), 128)
    const x = div(Math.abs(w.insgWing[i] - w.govtWing[j]) - Math.abs(w.govtWing[i] - w.govtWing[j]), 2)
    w.coupGain[j][i] = div(x * w.prestVal[i], 1024)
    w.chgDipAff(i, j, x)
    minorRej(w, i, j)
  }
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
    w.milPowr[i] = div(4 * temp * x, temp + x) + arf(w.intvGovt, i, 1) + arf(w.intvGovt, i, 2)

    if (i > 2 && w.level === 4) {
      for (let j = 3; j <= NO_CNTRY; j++) {
        if (w.dipAff[i][j] !== -127) continue
        // war between minor countries
        w.milPowr[i] -= div(w.milPowr[j], 4)
        w.gnp[i] = Math.max(1, w.gnp[i] - div(w.milPowr[j], 4))
        if (w.milPowr[i] < 1) {
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
      }
    }

    // insurgency
    x = div(div((256 - w.maturity[i]) * w.popln[i], 256) * w.sqrtStrg[i], 80)
    temp = 0
    for (let j = 1; j <= w.cntryCount; j++) temp += 2 * milAidConv(w.insgAid[j][i])
    if (temp < div(x, 8) + 1) temp = div(x, 8) + 1
    w.insgPowr[i] = div(4 * temp * x, temp + x) + arf(w.intvRebl, i, 1) + arf(w.intvRebl, i, 2)
    if (i < 3) w.insgPowr[i] = 1
    // combat: each side loses a quarter of the other's strength
    w.milPowr[i] = Math.max(1, w.milPowr[i] - div(w.insgPowr[i], 4))
    w.insgPowr[i] = Math.max(1, w.insgPowr[i] - div(w.milPowr[i], 4))
    w.govtStrg[i] = w.milPowr[i]
    w.insgStrg[i] = w.insgPowr[i]
    w.strngRat[i] = div(w.govtStrg[i], w.insgStrg[i])
    if (w.insgStrg[i] === 1 && w.govtStrg[i] < 8192) w.strngRat[i] *= 4
    if (w.strngRat[i] < 1) revolution(w, i)

    // economy: consumer, investment and military pressures share the GNP
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

    // popularity: growth of consumption per head, bonus for extremists, minus 3% expected
    const cons = div(w.consFrac[i] * pseudGnp, w.popln[i])
    const delta = div((cons - oldConsS) * 100, oldConsS + 1)
    w.gPopular[i] = Math.max(0, w.gPopular[i] + delta + div(Math.abs(w.govtWing[i]), 64) - 3)
    if (i < 3) w.gPopular[i] = 20
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

  for (let j = 3; j <= NO_CNTRY; j++) {
    const hFinProb = w.finlProb[w.human][j]
    const daij = w.dipAff[c][j]
    let oblig = daij + obligation(w.treaty[c][j]) - w.dipAff[w.human][j]
    if (oblig < 0) oblig = div(oblig * w.nastiness, 32)
    if (oblig > 128) oblig = 128
    if (oblig === 0) oblig = 1

    for (let k = 0; k <= 7; k++) {
      const verb = k as Verb
      let need = 0
      let max = 5
      let oldVal = 0
      let newVal = 0
      switch (verb) {
        case Verb.Econ:
          need = Math.max(0, div(22 - w.gPopular[j], 3))
          max = Math.min(w.econAMax(daij), maxEcon)
          oldVal = w.econAid[c][j]
          if (w.level === 1) need = 0
          break
        case Verb.MilAid:
          oldVal = w.miltAid[c][j]
          need = div(w.sqrtStrg[j] + hFinProb, 8)
          max = Math.min(w.milMax(daij), maxInsg)
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
          if (max > maxIntv) max = maxIntv
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
            if (projPowr > w.milPowr[j]) {
              newVal = max
              const x = w.gImpt(c, verb, j, oldVal, newVal).total
              if (x > div(w.random(), 1024)) newVal = oldVal
            }
          }
          break
        case Verb.Pressure: {
          let x = -div(144 - w.finlProb[c][j], 16)
          if (x > 0 || x < -5) x = 0
          need = x
          max = 5
          oldVal = 0
          if (w.level < 3) need = 0
          break
        }
        case Verb.Treaty: {
          oldVal = w.treaty[c][j]
          let x = 1 + div(hFinProb, 16) - div(w.sqrtStrg[j], 24) - div(20 - w.gPopular[j], 8)
          if (x < 0 || w.level < 3) x = 0
          need = oldVal + x
          max = Math.max(oldVal, w.treatMax(w.integrity[c] + daij - w.pugnacity[c]))
          break
        }
        case Verb.Destab:
          oldVal = w.destab[c][j]
          need = Math.min(0, div(w.gPopular[j] - 20, 2))
          if (w.level === 1) need = 0
          max = 5
          break
      }
      if (verb !== Verb.IntvRebl) {
        if (verb !== Verb.Treaty && verb !== Verb.Pressure && verb !== Verb.IntvGovt) need = div(need * oblig, 128)
        need = clamp(need, 0, max)
        if (need < 0) need = 0
        newVal = need
        // back off while the move looks too provocative
        while (newVal > oldVal && w.gImpt(c, verb, j, oldVal, newVal).total > Math.abs(div(w.random(), 512))) newVal--
      }
      if (newVal < oldVal && verb === Verb.Treaty) newVal = oldVal
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
    if (resrc === 0) continue
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
      if (w.dipAff[i][who] > 0) {
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
    }
  }
}

/** Yearly reaction of every minor country to the superpowers' current policies. */
export function annualReactions(w: World): void {
  for (let i = 3; i <= NO_CNTRY; i++) {
    for (let j = 1; j <= 2; j++) {
      minorRej(w, i, j)
      let x =
        div(25 * div(256 * econConv(w.econAid[j][i]), w.gnp[i]), w.gPopular[i] + 1) -
        32 * w.destab[j][i] +
        div(w.miltAid[j][i] * w.miltPress[i], 8) -
        12 * w.insgAid[j][i] +
        div(w.intvGovt[j][i] * w.miltPress[i], 4) -
        64 * w.intvRebl[j][i] -
        16 * w.pressure[j][i] +
        div(div(w.treaty[j][i] * w.integrity[j], 128) * w.miltPress[i], 8) +
        8 * (w.trade[j][i] - 3)
      x = div(x, 8)
      w.chgDipAff(i, j, x)
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
      }
    }
  }
  w.calcScores()
}

/** End of the computer's move: decay of tension, reputations, scores. */
export function closeYear(w: World): void {
  w.nastiness = Math.max(0, w.nastiness - 4)
  for (let j = 1; j <= 2; j++) {
    w.pugnacity[j] -= 4
    w.adventur[j] = Math.max(1, w.pugnacity[j] + w.nastiness - w.pugnacity[3 - j] - w.miltFrac[j] + 32)
    w.integrity[j] = Math.min(127, w.integrity[j] + 5)
  }
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
}
