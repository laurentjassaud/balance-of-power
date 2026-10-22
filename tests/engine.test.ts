import { describe, it, expect } from 'vitest'
import { Game, verbsForLevel } from '../src/engine/game'
import { NO_CNTRY, USA, USSR, Verb, type Level, type NewsItem } from '../src/engine/core'
import { advise } from '../src/engine/news'
import { Crisis } from '../src/engine/crisis'
import { journal, frenchify, leaderOf, eventOf } from '../src/engine/journal'
import { INDICATORS, bgValue, bgFormat } from '../src/engine/background'
import { ARCHIVES } from '../src/engine/archives'
import { FIRST_YEAR } from '../src/engine/core'
import { LAST_YEAR } from '../src/engine/game'

function finiteWorld(g: Game) {
  const w = g.w
  for (const key of ['gnp', 'popln', 'govtStrg', 'insgStrg', 'prestVal', 'dontMess', 'gPopular'] as const) {
    for (let i = 1; i <= NO_CNTRY; i++) expect(Number.isFinite(w[key][i]), `${key}[${i}]`).toBe(true)
  }
  for (let i = 1; i <= NO_CNTRY; i++) for (let j = 1; j <= NO_CNTRY; j++) {
    expect(Math.abs(w.dipAff[i][j])).toBeLessThanOrEqual(127)
  }
}

/** Plays a whole game, always backing down in crises. */
function playOut(g: Game, maxTurns = 20) {
  for (let t = 0; t < maxTurns && !g.over; t++) {
    g.nextTurn()
    let guard = 0
    while (g.crisis && guard++ < 50) {
      if (!g.crisis.over) g.respondCrisis(false)
      g.closeCrisis()
    }
  }
}

describe('new game', () => {
  for (const level of [1, 2, 3, 4] as Level[]) {
    for (const human of [USA, USSR]) {
      it(`level ${level}, human ${human}: starts in 1982 and plays to peace`, () => {
        const g = new Game({ level, human, seed: 1234 + level })
        expect(g.w.year).toBe(1982)
        expect(g.w.names[1]).toBe('États-Unis')
        expect(g.w.score(USA)).toBe(0)
        finiteWorld(g)
        playOut(g)
        expect(g.w.ended).toBe('peace')
        expect(g.w.year).toBe(1990)
        finiteWorld(g)
        expect(g.w.usaScore.length).toBeGreaterThan(7)
      })
    }
  }

  it('is deterministic for a given seed', () => {
    const a = new Game({ level: 4, human: USA, seed: 42 })
    const b = new Game({ level: 4, human: USA, seed: 42 })
    playOut(a)
    playOut(b)
    expect(a.w.usaScore).toEqual(b.w.usaScore)
  })
})

describe('policies', () => {
  it('offers more policies at higher levels', () => {
    expect(verbsForLevel(1)).toHaveLength(4)
    expect(verbsForLevel(4)).toHaveLength(9)
  })

  it('applies a policy within limits and records it in the news', () => {
    const g = new Game({ level: 3, human: USA, seed: 7 })
    const w = g.w
    let target = 0
    for (let i = 3; i <= NO_CNTRY; i++) {
      const l = g.limits(i, Verb.MilAid)
      if (l.max > l.current) { target = i; break }
    }
    expect(target).toBeGreaterThan(0)
    const lim = g.limits(target, Verb.MilAid)
    expect(g.setPolicy(target, Verb.MilAid, lim.max + 1)).toBe(false)
    expect(g.setPolicy(target, Verb.MilAid, lim.current + 1)).toBe(true)
    expect(w.miltAid[USA][target]).toBe(lim.current + 1)
    expect(w.news.some((n) => n.subject === USA && n.object === target && n.verb === Verb.MilAid)).toBe(true)
  })

  it('never lets the human lower a treaty', () => {
    const g = new Game({ level: 3, human: USA, seed: 9 })
    for (let i = 3; i <= NO_CNTRY; i++) {
      const l = g.limits(i, Verb.Treaty)
      expect(l.min).toBe(l.current)
    }
  })
})

describe('saving', () => {
  /** Round trip through JSON, as in localStorage. */
  const reload = (g: Game) => Game.restore(JSON.parse(JSON.stringify(g.snapshot())))
  // Compared through their saves: the whole state, and -0 (from div) reads as 0, which plays the same.
  const sameGame = (a: Game, b: Game) => {
    expect(b.w.year).toBe(a.w.year)
    expect(JSON.stringify(b.snapshot())).toBe(JSON.stringify(a.snapshot()))
  }

  it('resumes a game exactly where it was', () => {
    const a = new Game({ level: 4, human: USSR, seed: 77 })
    playOut(a, 3)
    const b = reload(a)
    sameGame(a, b)
    playOut(a)
    playOut(b)
    sameGame(a, b)
  })

  /** Restores mid-crisis, checks the crisis and its shared news item, then plays both games out. */
  const resumeCrisis = (a: Game) => {
    const b = reload(a)
    expect(b.crisis!.level).toBe(a.crisis!.level)
    expect(b.crisis!.steps).toEqual(a.crisis!.steps)
    if (a.w.news.includes(a.crisis!.item)) expect(b.w.news).toContain(b.crisis!.item)
    playOut(a)
    playOut(b)
    sameGame(a, b)
  }

  it('resumes in the middle of a crisis opened by the player', () => {
    let seen = 0
    for (let seed = 1; seed < 40 && seen < 3; seed++) {
      const a = new Game({ level: 2, human: USA, seed })
      const it = a.w.news.find((n) => a.canChallenge(n))
      if (!it) continue
      seen++
      a.challenge(it)
      if (!a.crisis!.over) a.respondCrisis(true)
      resumeCrisis(a)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('resumes in the middle of a crisis raised by the computer during its reactions', () => {
    let seen = 0
    for (let seed = 1; seed < 60 && seen < 3; seed++) {
      const a = new Game({ level: 3, human: USA, seed })
      for (let t = 0; t < 8 && !a.crisis && !a.over; t++) {
        // An aggressive player, so that the computer questions its moves.
        for (let i = 3; i <= NO_CNTRY; i++) for (const verb of [Verb.InsgAid, Verb.IntvRebl, Verb.MilAid]) {
          const l = a.limits(i, verb)
          if (l.max > l.current) a.setPolicy(i, verb, l.max)
        }
        a.nextTurn()
      }
      if (!a.crisis || a.over) continue
      seen++
      resumeCrisis(a)
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('advisors', () => {
  // The human plays the USA; the closest friend of each superpower among the minor countries.
  const g = new Game({ level: 3, human: USA, seed: 5 })
  const w = g.w
  const friendOf = (sp: number) => {
    let best = 3
    for (let i = 3; i <= NO_CNTRY; i++) if (w.dipAff[sp][i] - w.dipAff[3 - sp][i] > w.dipAff[sp][best] - w.dipAff[3 - sp][best]) best = i
    return best
  }
  const item = (subject: number, verb: Verb, object: number, oldVal: number, newVal: number): NewsItem =>
    ({ subject, verb, object, oldVal, newVal, host: 0, crisis: false, worth: 0 })

  it('welcome a rival withdrawal from its own friend', () => {
    for (const a of advise(w, item(USSR, Verb.IntvGovt, friendOf(USSR), 3, 0))) expect(a.score).toBeGreaterThan(0)
  })

  it('want to contest a rival intervention against our closest friend', () => {
    for (const a of advise(w, item(USSR, Verb.IntvRebl, friendOf(USA), 0, 4))) expect(a.score).toBeLessThan(0)
  })

  it('see no risk in arming our closest friend', () => {
    for (const a of advise(w, item(USA, Verb.MilAid, friendOf(USA), 1, 2))) expect(a.score).toBeGreaterThan(0)
  })

  it('do not welcome rival troops for the rebels of a country hostile to both, whose regime would side with the rival', () => {
    const h = new Game({ level: 3, human: USA, seed: 3 }).w
    let target = 0
    for (let i = 3; i <= NO_CNTRY; i++) if (h.dipAff[USA][i] < 0 && h.dipAff[USSR][i] < 0 && (!target || h.dipAff[USA][i] < h.dipAff[USA][target])) target = i
    h.intvRebl[USSR][target] = 5
    expect(h.rebelAffinity(USA, target)).toBeLessThan(0)
    for (const a of advise(h, item(USSR, Verb.IntvRebl, target, 0, 5))) {
      expect(a.text).not.toMatch(/Bonne nouvelle|Sans grande importance/)
    }
  })
})

describe('newspaper', () => {
  it('turns the markers into proper French', () => {
    expect(frenchify('au discours de le président')).toBe('au discours du président')
    expect(frenchify('Des membres de les contras')).toBe('Des membres des contras')
    expect(frenchify('escortés jusqu’à le roi Hassan II')).toBe('escortés jusqu’au roi Hassan II')
    expect(frenchify('L’Écho de le Caire')).toBe('L’Écho du Caire')
    expect(frenchify('Le Courrier de Ankara')).toBe('Le Courrier d’Ankara')
    expect(frenchify('prennent le contrôle de des villages')).toBe('prennent le contrôle de villages')
  })

  it('prints a clean front page and closing item for every country and situation', () => {
    const w = new Game({ level: 4, human: USA, seed: 11 }).w
    const bad = /[@&%/]|(^|[\s’])(de|à) (le|les) |(^|\s)de des |(^|\s)de [aeiouyéèêAEIOUYÉ]|\s[,.]| [;:!?»]|« |\s{2}/
    for (let c = 1; c <= NO_CNTRY; c++) {
      for (const ratio of [0, 1, 2, 4, 9, 20, 40, 100, 300, 600, 1500, 5000]) {
        for (const rnd of [-32767, -21000, -9000, -300, -1, 1, 255, 777, 4100, 12345, 20000, 32767]) {
          w.strngRat[c] = ratio; w.cntryRnd[c] = rnd; w.cntryRnd[USA] = -rnd >> 1
          w.leftPowr[c] = rnd % 2 === 0; w.virgin[c] = rnd > 0; w.rebWinFlag[c] = ratio === 9
          w.gPopular[c] = Math.abs(rnd) % 25; w.govtWing[c] = (rnd % 255) % 128
          const p = journal(w, c)
          for (const s of [p.masthead, p.front, p.close]) {
            expect(s, `${c}: ${s}`).not.toMatch(bad)
            expect(s.charAt(0), s).toBe(s.charAt(0).toUpperCase())
          }
        }
      }
    }
  })

  it('names the leader of the year and its real event, from the references file', () => {
    const g = new Game({ level: 1, human: USA, seed: 41 })
    const w = g.w
    expect(leaderOf(2, 1984).nom).toBe('Tchernenko')
    expect(leaderOf(2, 1985).nom).toBe('Gorbatchev')
    expect(leaderOf(1, 1989).nom).toBe('Bush')
    const bad = /\s[,.]| [;:!?»]|« |\s{2}/
    for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
      w.year = year
      for (let c = 1; c <= NO_CNTRY; c++) {
        const p = journal(w, c)
        expect(p.chronicle, `${c} ${year}`).toBeTruthy()
        expect(p.chronicle!, `${c} ${year}`).not.toMatch(bad)
        expect(eventOf(c, year)).toBeTruthy()
      }
    }
    // the leader is named while the original regime holds, and only then
    w.year = 1985
    w.virgin[2] = true
    w.cntryRnd[2] = 1
    w.cntryRnd[1] = 1
    for (let k = 0; k < 64; k++) {
      w.cntryRnd[2] = k * 997
      const t = journal(w, 2).front + journal(w, 2).close
      if (t.includes('secrétaire général')) { expect(t).toContain('Gorbatchev'); break }
    }
  })

  it('carries the year’s news about the country, and only those', () => {
    const g = new Game({ level: 3, human: USA, seed: 21 })
    g.nextTurn()
    const c = g.w.news.find((n) => n.object > 2)!.object
    const p = journal(g.w, c)
    expect(p.news.length).toBeGreaterThan(0)
    for (const n of p.news) expect(n.subject === c || n.object === c).toBe(true)
  })
})

describe('history', () => {
  it('keeps one record per year played, in order, apart from the live state', () => {
    const g = new Game({ level: 3, human: USA, seed: 31 })
    expect(g.w.history).toHaveLength(0)
    playOut(g)
    expect(g.w.history.map((h) => h.year)).toEqual(Array.from({ length: LAST_YEAR - FIRST_YEAR }, (_, i) => FIRST_YEAR + i))
    const before = g.w.history[0].dipAff[USA][5]
    g.w.dipAff[USA][5] = before + 50
    expect(g.w.history[0].dipAff[USA][5]).toBe(before)
  })

  it('travels with the save', () => {
    const g = new Game({ level: 2, human: USSR, seed: 32 })
    playOut(g, 3)
    const r = Game.restore(JSON.parse(JSON.stringify(g.snapshot())))
    expect(JSON.stringify(r.w.history)).toBe(JSON.stringify(g.w.history))
  })
})

describe('background', () => {
  it('reads all 23 archives of the original, 80 countries each', () => {
    expect(ARCHIVES).toHaveLength(24)
    for (let a = 1; a <= 23; a++) expect(ARCHIVES[a]).toHaveLength(81)
  })

  it('gives every figure, divided every way it offers, a finite value and a readable text', () => {
    const w = new Game({ level: 1, human: USA, seed: 33 }).w
    for (const ind of INDICATORS) for (const per of ind.per) for (let c = 1; c <= NO_CNTRY; c++) {
      const v = bgValue(w, ind, per, c)
      expect(Number.isFinite(v), `${ind.label} ${per} ${c}`).toBe(true)
      expect(bgFormat(ind, per, v)).not.toMatch(/NaN|undefined|Infinity/)
    }
  })
})

describe('crises', () => {
  it('a challenge of a computer action resolves (backdown or escalation)', () => {
    let seen = 0
    for (let seed = 1; seed < 40 && seen < 5; seed++) {
      const g = new Game({ level: 2, human: USA, seed })
      const it = g.w.news.find((n) => g.canChallenge(n))
      if (!it) continue
      seen++
      const c = g.challenge(it)!
      expect(c).not.toBeNull()
      let guard = 0
      while (!c.over && guard++ < 20) {
        const b = c.briefing()
        expect(b.usaInterest).toBeGreaterThanOrEqual(0)
        expect(b.usaInterest).toBeLessThanOrEqual(7)
        g.respondCrisis(true)
      }
      expect(c.over).toBe(true)
      if (c.war) expect(g.w.ended === 'war' || g.w.ended === 'accident').toBe(true)
      else expect([USA, USSR]).toContain(c.loser)
      g.closeCrisis()
      expect(g.crisis).toBeNull()
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('trade', () => {
  it('counts as a mild help, so the computer rarely questions a trade increase', () => {
    const g = new Game({ level: 4, human: USA, seed: 1 })
    expect(g.w.hurt(Verb.Trade, 17, 4, 5)).toBe(-1)
    let tries = 0, crises = 0
    for (let seed = 1; seed <= 200; seed++) {
      const g = new Game({ level: 4, human: USA, seed })
      const c = 3 + (seed % 78)
      const lim = g.limits(c, Verb.Trade)
      if (lim.max <= lim.current || !g.setPolicy(c, Verb.Trade, lim.current + 1)) continue
      tries++
      g.nextTurn()
      let hit = false
      for (let k = 0; g.crisis && k < 500; k++) {
        if (!g.crisis.over) { if (g.crisis.verb === Verb.Trade) hit = true; g.respondCrisis(false) } else g.closeCrisis()
      }
      if (hit) crises++
    }
    expect(tries).toBeGreaterThan(100)
    // with a value of 0 the computer questioned about 98 % of them
    expect(crises / tries).toBeLessThan(0.5)
  })
})

describe('initial minor-country policies', () => {
  it('are set at level 4, with the resources they commit, and left out below', () => {
    const at4 = new Game({ level: 4, human: USA, seed: 3 }).w
    // the first year has been played: wars are never reset by MinorAI, so Iraq still backs the Iranian rebels
    expect(at4.intvRebl[53][55]).toBe(4)
    expect(at4.insgAid[53][55]).toBe(3)
    // Zambia's aid to the ANC is outside its sphere, so it lasts too
    expect(at4.insgAid[41][27]).toBe(1)
    const at3 = new Game({ level: 3, human: USA, seed: 3 }).w
    expect(at3.intvRebl[53][55]).toBe(0)
    expect(at3.insgAid[41][27]).toBe(0)
  })
})

describe('questioning a minor country', () => {
  it('needs an influence above 3 over it, as in the original', () => {
    let checked = 0
    for (let seed = 1; seed <= 30 && checked < 20; seed++) {
      const g = new Game({ level: 4, human: USA, seed })
      const w = g.w
      for (const it of w.news) {
        if (it.subject <= 2 || it.subject === it.object || it.newVal <= it.oldVal || it.verb === Verb.Trade) continue
        checked++
        expect(g.canChallenge(it)).toBe(w.influence(w.human, it.subject) > 3)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('works on the moves of MinorAI, once per action', () => {
    let seen = 0
    for (let seed = 1; seed <= 300 && seen < 5; seed++) {
      const g = new Game({ level: 4, human: USA, seed })
      const it = g.w.news.find((n) => n.subject > 2 && n.crisis && g.canChallenge(n))
      if (!it) continue
      seen++
      const c = g.challenge(it)!
      while (!c.over) c.respond(false)
      g.closeCrisis()
      expect(g.canChallenge(it)).toBe(false)
    }
    expect(seen).toBeGreaterThan(0)
  })
})

function settleAll(g: Game) {
  for (let k = 0; g.crisis && k < 500; k++) if (!g.crisis.over) g.respondCrisis(false); else g.closeCrisis()
}

describe('end of a crisis', () => {
  it('a cancelled action stays in the news as a withdrawal, as in the original', () => {
    let seen = 0
    for (let seed = 1; seed <= 200 && seen < 5; seed++) {
      const g = new Game({ level: 3, human: USA, seed })
      const w = g.w
      // a provocative move: arms to the rebels of a Soviet ally
      const target = [7, 56, 44, 48, 42, 40, 32, 50][seed % 8]
      const lim = g.limits(target, Verb.InsgAid)
      if (!g.setPolicy(target, Verb.InsgAid, lim.max)) continue
      g.nextTurn()
      const c = g.crisis
      if (!c || c.who !== USA || c.item.object !== target) continue
      const { oldVal, newVal } = c.item
      c.respond(false) // the player backs down at level 9: the move is cancelled
      expect(c.revoked).toBe(true)
      seen++
      expect([c.item.oldVal, c.item.newVal]).toEqual([oldVal, newVal])
      const wd = c.withdrawal()!
      expect(w.news).toContain(wd)
      expect([wd.oldVal, wd.newVal, wd.crisis]).toEqual([newVal, oldVal, true])
      expect(w.getPolicy(USA, Verb.InsgAid, target)).toBe(oldVal)
      g.closeCrisis()
      settleAll(g)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('a crisis with a minor country leaves the scores up to date', () => {
    let seen = 0
    for (let seed = 1; seed <= 200 && seen < 5; seed++) {
      const g = new Game({ level: 4, human: USA, seed })
      const w = g.w
      const it = w.news.find((n) => n.subject > 2 && n.subject !== n.object && n.newVal > n.oldVal)
      if (!it) continue
      const c = new Crisis(w, it, 'minor')
      while (!c.over) c.respond(true)
      seen++
      const [usa, ussr] = [w.usaStrng, w.ussrStrng]
      w.calcScores()
      expect([w.usaStrng, w.ussrStrng]).toEqual([usa, ussr])
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('two players', () => {
  it('need a hand-over every year, and take turns at playing first', () => {
    const g = new Game({ level: 2, human: USA, twoPlayer: true, seed: 5 })
    const w = g.w
    const year = w.year
    g.nextTurn()
    expect(w.year).toBe(year) // nobody has handed over yet
    const firsts: number[] = []
    for (let t = 0; t < 4; t++) {
      firsts.push(w.human)
      g.handOver()
      g.nextTurn()
      for (let k = 0; g.crisis && k < 500; k++) if (!g.crisis.over) g.respondCrisis(false); else g.closeCrisis()
    }
    expect(w.year).toBe(year + 4)
    expect(firsts).toEqual([USA, USSR, USA, USSR])
  })
})

describe('debug journal', () => {
  it('records the calculations without changing the game, and is not saved', () => {
    const plain = new Game({ level: 4, human: USSR, seed: 58 })
    const debug = new Game({ level: 4, human: USSR, seed: 58, debug: true })
    playOut(plain)
    playOut(debug)
    const data = (g: Game) => { const s = g.snapshot(); delete s.world.debug; return JSON.stringify(s) }
    expect(data(debug)).toBe(data(plain))
    expect(plain.w.log).toBeNull()
    const kinds = new Set(debug.w.log!.entries.map((e) => e.kind))
    for (const k of ['tour', 'prestige', 'relations', 'ia', 'militaire', 'economie', 'popularite', 'finlandisation', 'insurrection', 'mineurs']) expect(kinds.has(k as never), k).toBe(true)
    // Entries of a step share their variables, so that they make one table.
    const pop = debug.w.log!.entries.filter((e) => e.kind === 'popularite')
    expect(pop.length).toBeGreaterThan(0)
    for (const e of pop) expect(Object.keys(e.data)).toEqual(Object.keys(pop[0].data))
    expect(pop[0].data).toHaveProperty('gPopular')
    const saved = debug.snapshot()
    expect(saved.world).not.toHaveProperty('log')
    const resumed = Game.restore(JSON.parse(JSON.stringify(saved)))
    expect(resumed.w.debug).toBe(true)
    expect(resumed.w.log!.entries.map((e) => e.title)).toEqual(['Partie reprise'])
  })
})

describe('policy report (debug)', () => {
  it('projects the fight the next year runs, and moves with the weapons sent', async () => {
    const { project, currentState } = await import('../src/engine/policyDebug')
    const g = new Game({ level: 1, human: USA, seed: 77, debug: true })
    const w = g.w
    const before = Array.from({ length: NO_CNTRY + 1 }, (_, i) => (i > 2 ? project(w, i) : null))
    expect(currentState(w, 5).milPowr).toBe(w.milPowr[5])
    g.nextTurn()
    let checked = 0
    for (const e of w.log!.entries.filter((e) => e.kind === 'insurrection' && e.year === w.year && e.country > 2)) {
      const p = before[e.country]!
      // Foreign troops weigh by the superpowers' power of the new year, and refused aid changes the weapons.
      const pow = w.log!.entries.find((m) => m.kind === 'militaire' && m.step === 'Puissance' && m.year === w.year && m.country === e.country)!
      if (p.intvGovt1 || p.intvGovt2 || p.intvRebl1 || p.intvRebl2 || pow.data.govtAid !== p.govtAid) continue
      expect(e.data.milPowr0).toBe(p.govtPowr)
      expect(e.data.recruits).toBe(p.fighters)
      expect(e.data.insgPowr0).toBe(p.insgPowr)
      expect(e.data.strngRat).toBe(p.strngRat)
      checked++
    }
    expect(checked).toBeGreaterThan(40)

    // Weapons to rebels: more rebel weapons, a weaker government, a lower ratio.
    const c = Array.from({ length: NO_CNTRY - 2 }, (_, i) => i + 3).find((i) => g.limits(i, Verb.InsgAid).max >= 2 && w.insgAid[USA][i] === 0)
    expect(c).toBeDefined()
    const p0 = project(w, c!)
    expect(g.setPolicy(c!, Verb.InsgAid, 2)).toBe(true)
    const p1 = project(w, c!)
    expect(p1.shipments - p0.shipments).toBe(5)
    expect(p1.insgPowr).toBeGreaterThanOrEqual(p0.insgPowr)
    expect(p1.strngRat).toBeLessThanOrEqual(p0.strngRat)
    // −12 per level in the reaction terms, summed then divided by 8.
    expect(p1.reaction1).toBeLessThan(p0.reaction1)
  })
})
