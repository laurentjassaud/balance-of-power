import { describe, it, expect } from 'vitest'
import { Game, verbsForLevel } from '../src/engine/game'
import { NO_CNTRY, USA, USSR, Verb, type Level, type NewsItem } from '../src/engine/core'
import { advise } from '../src/engine/news'
import { journal, frenchify } from '../src/engine/journal'
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
