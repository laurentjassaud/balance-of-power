// Debug journal: every calculation the model makes, with its inputs and its result, kept while a game runs in debug mode.
// It only records; the model never reads it back, so a game plays out the same with or without it.

/** Kinds of result, in the order the Logs views list them. */
export const LOG_KINDS = {
  tour: 'Déroulement du tour',
  prestige: 'Prestige et scores',
  relations: 'Relations diplomatiques',
  tension: 'Tension et réputations',
  crise: 'Crises',
  ia: 'Décisions de l’ordinateur',
  mineurs: 'Politique des pays mineurs',
  rejet: 'Politiques refusées',
  militaire: 'Puissance militaire',
  insurrection: 'Insurrection et combats',
  regime: 'Coups d’État et révolutions',
  finlandisation: 'Finlandisation',
  economie: 'Économie',
  popularite: 'Popularité',
  joueur: 'Actions du joueur',
} as const

export type LogKind = keyof typeof LOG_KINDS
export type LogValue = number | string | boolean

export interface LogEntry {
  /** Order of the calculation in the game. */
  n: number
  year: number
  kind: LogKind
  /** The calculation within its kind (one table per step): entries of a step share their variables. */
  step: string
  /** Country the result concerns, 0 for the whole world. */
  country: number
  title: string
  /** The result, short. */
  result: string
  /** The values used and produced, by variable name (the model's names, suffix 0 for a value before the step). */
  data: Record<string, LogValue>
  /** The calculation, one step per line, with the values used. */
  lines: string[]
}

export type LogInput = Omit<LogEntry, 'n' | 'year' | 'lines'> & { lines?: string[] }

/** Beyond this the oldest entries are dropped, so a long game stays light. */
const MAX_ENTRIES = 60000

export class DebugLog {
  entries: LogEntry[] = []
  private n = 0

  constructor(private year: () => number) {}

  add(e: LogInput): void {
    // A term like −32 × 0 gives −0, which would show as "-0".
    for (const k in e.data) if (Object.is(e.data[k], -0)) e.data[k] = 0
    this.entries.push({ ...e, lines: e.lines ?? [], n: ++this.n, year: this.year() })
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES)
  }
}

/**
 * Column headers of the variables. Keys are the model's names (as in the code and the Pascal source); 1 and 2 end
 * the per-superpower ones (USA, USSR), 0 a value before the step. A name missing here is shown as is.
 */
export const VAR_LABELS: Record<string, string> = {
  nastiness: 'Tension', nastiness0: 'Tension avant',
  pugnacity1: 'Agressivité USA', pugnacity2: 'Agressivité URSS', integrity1: 'Intégrité USA', integrity2: 'Intégrité URSS',
  adventur1: 'Aventurisme USA', adventur2: 'Aventurisme URSS', integrity: 'Intégrité',
  intvGovt1: 'Troupes gouv. USA', intvGovt2: 'Troupes gouv. URSS', intvRebl1: 'Troupes rebelles USA', intvRebl2: 'Troupes rebelles URSS',
  other: 'Autre pays', host: 'Pays du conflit', delta: 'Variation', dipAff0: 'Relations avant', dipAff: 'Relations',
  sp: 'Superpuissance', x: 'x', treaty0: 'Traité avant', treaty: 'Traité', intvGovt0: 'Troupes avant', intvGovt: 'Troupes',
  econAid0: 'Aide éco. avant', econAid: 'Aide éco.', miltAid0: 'Aide mil. avant', miltAid: 'Aide mil.',
  insgAid: 'Armes rebelles', intvRebl: 'Troupes rebelles',
  y: 'Puissance propre', projPowr1: 'Projection USA', selfPowr1: 'Défense face USA', finlProb1: 'Finl. USA',
  projPowr2: 'Projection URSS', selfPowr2: 'Défense face URSS', finlProb2: 'Finl. URSS', pressure1: 'Pression USA', pressure2: 'Pression URSS',
  finlFlag: 'Finlandisé', toward: 'Vers',
  govtWing0: 'Orientation avant', govtWing: 'Orientation', gPopular0: 'Popularité avant', gPopular: 'Popularité', govtStrg: 'Force du gouv.',
  revlGain1: 'Gain révol. USA', revlGain2: 'Gain révol. URSS', coupGain1: 'Gain coup USA', coupGain2: 'Gain coup URSS',
  dipAff1: 'Relations USA', dipAff2: 'Relations URSS',
  miltSpnd: 'Dépenses mil.', govtAid: 'Aide mil. reçue (solde)', temp: 'Moyens', milMen: 'Effectifs', base: '4tx/(t+x)',
  intvUsa: 'Troupes USA', intvUssr: 'Troupes URSS', milPowr0: 'Puissance avant', milPowr: 'Puissance mil.', enemy: 'Ennemi',
  enemyPowr: 'Puissance ennemie', gnp0: 'PNB avant', gnp: 'PNB', surrender: 'Capitule',
  maturity: 'Maturité', popln0: 'Population avant', popln: 'Population', sqrtStrg: '√rapport', recruits: 'Recrues',
  rebelArms: 'Armes reçues', insgPowr0: 'Rebelles avant combat', insgPowr: 'Rebelles', strngRat: 'Rapport de forces', revolution: 'Révolution',
  consPress: 'Pression conso', invtPress: 'Pression invest.', miltPress: 'Pression mil.',
  consFrac0: 'Part conso avant', invtFrac0: 'Part invest. avant', miltFrac0: 'Part mil. avant', pot: 'Pot',
  consFrac: 'Part conso', invtFrac: 'Part invest.', miltFrac: 'Part mil.', aid: 'Aide éco. reçue',
  oldConsS: 'Conso/tête avant', growth: 'Croissance ‰', consSpnd: 'Dépenses conso', invtSpnd: 'Dépenses invest.',
  cons: 'Conso/tête', destab: 'Déstabilisation', coup: 'Coup d’État',
  arms: 'Armes dispo.', troops: 'Troupes dispo.', econ: 'Aide éco. dispo.', maxIntv: 'Max troupes', maxInsg: 'Max armes', maxEcon: 'Max aide éco.',
  oblig0: 'Engagement brut', oblig: 'Engagement', need0: 'Besoin brut', need: 'Besoin', max: 'Max', oldVal: 'Avant', newVal: 'Après', backoffs: 'Reculs',
  resrc: 'Ressources', influe: 'Influence USA−URSS', total: 'Poids total', targets: 'Cibles',
  tEcon: 'Aide éco.', tDestab: 'Déstab.', tMiltAid: 'Aide mil.', tInsgAid: 'Armes rebelles', tIntvGovt: 'Troupes gouv.',
  tIntvRebl: 'Troupes rebelles', tPressure: 'Pression', tTreaty: 'Traité', tTrade: 'Commerce', sum: 'Somme',
  usaStrng: 'Prestige brut USA', ussrStrng: 'Prestige brut URSS', iUsaStrng: 'Initial USA', iUssrStrng: 'Initial URSS',
  score1: 'Score USA', score2: 'Score URSS',
  impt: 'Importance totale', imptUsa: 'Importance USA', imptUssr: 'Importance URSS', threshold: 'Seuil', draw: 'Tirage',
  challenged: 'Contesté', level: 'Niveau', accident: 'Accident', risk: 'Risque d’accident', dipAffSuper: 'Relations USA–URSS',
  perCountry: 'Par pays', cancelled: 'Annulée', dontMess: 'Sphère', hardens: 'Durcit', influence: 'Influence', factor: 'Facteur',
  backedDown: 'Recul', min: 'Min', available: 'Disponible', subject: 'Auteur', verb: 'Politique',
  pugnacity: 'Agressivité', seed: 'Graine', human: 'Joueur', twoPlayer: 'Deux joueurs',
}

export const varLabel = (k: string) => VAR_LABELS[k] ?? k
