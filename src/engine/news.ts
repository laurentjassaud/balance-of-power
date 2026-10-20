import { World, Verb, USA, econConv, milAidConv, intvConv, type NewsItem } from './core'

// French wording of policies, news and advice. All texts are written for this port.

export const VERB_LABEL: Record<Verb, string> = {
  [Verb.Destab]: 'Déstabilisation',
  [Verb.Econ]: 'Aide économique',
  [Verb.MilAid]: 'Aide militaire',
  [Verb.InsgAid]: 'Armes aux rebelles',
  [Verb.IntvGovt]: 'Troupes pour le gouvernement',
  [Verb.IntvRebl]: 'Troupes pour les rebelles',
  [Verb.Pressure]: 'Pression diplomatique',
  [Verb.Treaty]: 'Traité',
  [Verb.Trade]: 'Commerce',
}

const DESTAB = ['aucune', 'propagande', 'soutien discret à l’opposition', 'financement de l’opposition', 'sabotage', 'préparation d’un putsch']
const PRESSURE = ['aucune', 'remarques', 'critiques officielles', 'avertissements', 'menaces', 'ultimatum']
const TREATY = ['aucun', 'relations diplomatiques', 'accords commerciaux', 'bases militaires', 'défense conventionnelle', 'garantie nucléaire']
const TRADE = ['embargo total', 'embargo', 'restrictions sévères', 'restrictions', 'relations normales', 'partenaire privilégié']

/** Description of a policy level, with the quantity it stands for. */
export function levelLabel(verb: Verb, v: number): string {
  switch (verb) {
    case Verb.Destab: return DESTAB[v]
    case Verb.Pressure: return PRESSURE[v]
    case Verb.Treaty: return TREATY[v]
    case Verb.Trade: return TRADE[v]
    case Verb.Econ: return v === 0 ? 'aucune' : `${econConv(v) * 100} M$ par an`
    case Verb.MilAid:
    case Verb.InsgAid: return v === 0 ? 'aucune' : `${milAidConv(v) * 10} M$ d’armement`
    case Verb.IntvGovt:
    case Verb.IntvRebl: return v === 0 ? 'aucune' : `${(intvConv(v) * 1000).toLocaleString('fr-FR')} soldats`
  }
}

const PHRASE: Record<Verb, [up: string, down: string, stop: string]> = {
  [Verb.Destab]: ['intensifie ses opérations de déstabilisation', 'modère ses opérations de déstabilisation', 'met fin à ses opérations de déstabilisation'],
  [Verb.Econ]: ['augmente son aide économique', 'réduit son aide économique', 'suspend son aide économique'],
  [Verb.MilAid]: ['arme davantage le gouvernement', 'réduit son aide militaire au gouvernement', 'cesse d’armer le gouvernement'],
  [Verb.InsgAid]: ['arme davantage les rebelles', 'réduit ses livraisons d’armes aux rebelles', 'cesse d’armer les rebelles'],
  [Verb.IntvGovt]: ['envoie des troupes soutenir le gouvernement', 'rappelle une partie de ses troupes', 'retire toutes ses troupes'],
  [Verb.IntvRebl]: ['engage des troupes aux côtés des rebelles', 'réduit son corps expéditionnaire auprès des rebelles', 'retire ses troupes engagées auprès des rebelles'],
  [Verb.Pressure]: ['accentue la pression diplomatique', 'relâche la pression diplomatique', 'cesse toute pression'],
  [Verb.Treaty]: ['renforce ses liens officiels', 'réduit ses engagements', 'dénonce tous ses accords'],
  [Verb.Trade]: ['améliore ses relations commerciales', 'restreint le commerce', 'décrète un embargo total'],
}

/** Headline-style name of an actor: the capital for the superpowers. */
export function actorName(w: World, k: number): string {
  return k === 1 ? 'Washington' : k === 2 ? 'Moscou' : w.names[k]
}

export interface NewsText {
  headline: string
  detail: string
  /** Country to highlight on the map. */
  focus: number
}

export function describeNews(w: World, n: NewsItem): NewsText {
  const S = actorName(w, n.subject)
  const O = w.names[n.object]
  if (n.subject === n.object) {
    if (n.verb === Verb.Econ) {
      return { headline: `Révolution en ${S} : les insurgés prennent le pouvoir`, detail: 'Le nouveau régime revoit toutes ses alliances.', focus: n.subject }
    }
    if (n.verb === Verb.MilAid) {
      return { headline: `Coup d’État en ${S}`, detail: 'Une faction rivale s’empare du pouvoir et change de cap.', focus: n.subject }
    }
  }
  if (n.subject > 2 && n.verb === Verb.Destab && n.oldVal === 0 && n.newVal === 0) {
    return { headline: `${w.names[n.subject]} se finlandise au profit de ${actorName(w, n.object)}`, detail: `Sous la pression, ${w.names[n.subject]} aligne sa politique étrangère sur ${actorName(w, n.object)}.`, focus: n.subject }
  }
  if (n.subject > 2 && n.verb === Verb.Pressure && n.object > 2 && n.newVal === 1) {
    if (n.oldVal === 2) return { headline: `${S} capitule devant ${O}`, detail: 'La guerre est terminée ; le vaincu adopte la politique du vainqueur.', focus: n.subject }
    return { headline: `Guerre entre ${S} et ${O}`, detail: 'Les combats continuent entre les deux pays.', focus: n.subject }
  }
  let phrase = PHRASE[n.verb][n.newVal > n.oldVal ? 0 : n.newVal === 0 ? 2 : 1]
  if (n.subject > 2 && n.verb === Verb.Treaty && n.newVal < n.oldVal) phrase = 'exige de revoir à la baisse son traité'
  const place = n.subject > 2 && n.object < 3 ? actorName(w, n.object) : O
  const headline = `${place} · ${S} ${phrase}`
  const detail = `${VERB_LABEL[n.verb]} : ${levelLabel(n.verb, n.oldVal)} → ${levelLabel(n.verb, n.newVal)}`
  return { headline, detail, focus: n.verb === Verb.InsgAid || n.verb === Verb.IntvRebl || n.subject < 3 ? n.object : n.subject }
}

// ------------------------------------------------------------------ advisors

export const ADVISORS = [
  { name: 'Diplomate', bias: 1, lens: 'Regarde d’abord nos alliances.' },
  { name: 'Juriste', bias: 2, lens: 'Regarde d’abord les traités.' },
  { name: 'Géopoliticien', bias: 3, lens: 'Regarde d’abord les sphères d’influence.' },
  { name: 'Faucon', bias: 4, lens: 'Regarde d’abord l’humeur de l’adversaire.' },
]

/** About an action that displeases us, from "contest" to "the rival cares more". */
const ADVICE = [
  'Inacceptable. Il faut contester, quitte à aller loin.',
  'Grave. Une contestation se justifie.',
  'Préoccupant. Une protestation mesurée suffirait.',
  'Gênant, mais pas au point de risquer une crise.',
  'Sans grande importance pour nous.',
  'Pas notre affaire. Contester nous coûterait du prestige.',
  'Surtout pas de crise ici : nous aurions tout à perdre.',
]
/** About an action that suits us. */
const WELCOME = 'Bonne nouvelle pour nous : rien à contester.'
/** About one of our own actions: may the rival question it? */
const OWN = [
  'Risqué : l’adversaire y tient plus que nous et pourrait contester.',
  'L’adversaire pourrait protester. Soyons prêts à reculer.',
  'L’adversaire n’appréciera pas, mais nous y tenons davantage.',
  'Sans risque : l’adversaire n’a aucune raison de contester.',
]

/**
 * Each advisor's opinion of a news item, from the human's point of view: a score from -15 (contest, or our move
 * is at risk) to 16 (let it be, or our move is safe), with a sentence.
 * The outrage of each superpower (gImpt) is positive when the action displeases it and negative when it pleases it;
 * their sum is the book's "outrage excess". Someone else's action is worth contesting only if it displeases us,
 * by how much our outrage exceeds the rival's pleasure. Our own action is at risk only if it displeases the rival,
 * by how much its outrage exceeds our pleasure (the computer questions our moves on that sum).
 * When someone else backs rebels, the original model only sees the harm done to the current government, which
 * pleases us if we dislike it. The advisors also judge the help given to the regime the rebels would bring
 * (rebelAffinity, negated since hurting the government is helping the rebels) and keep the view worse for us.
 */
export function advise(w: World, n: NewsItem): { name: string; lens: string; score: number; text: string }[] {
  const scale = (x: number) => Math.max(-15, Math.min(16, Math.trunc(x / 8) + 1))
  const ourSide = (g: { usa: number; ussr: number }) => (w.human === USA ? g.usa : g.ussr)
  const rebels = n.subject !== w.human && (n.verb === Verb.InsgAid || n.verb === Verb.IntvRebl) && n.newVal > n.oldVal
  const regime = rebels ? [0, -w.rebelAffinity(1, n.object), -w.rebelAffinity(2, n.object)] : undefined
  return ADVISORS.map((a) => {
    let g = w.gImpt(n.subject, n.verb, n.object, n.oldVal, n.newVal, a.bias)
    if (regime) {
      const r = w.gImpt(n.subject, n.verb, n.object, n.oldVal, n.newVal, a.bias, regime)
      if (ourSide(r) > ourSide(g)) g = r
    }
    const ours = ourSide(g)
    const theirs = w.human === USA ? g.ussr : g.usa
    let score: number, text: string
    if (n.subject === w.human) {
      if (theirs <= 0) { score = scale(-theirs); text = OWN[3] }
      else { score = -scale(g.total); text = OWN[score <= -7 ? 0 : score <= 1 ? 1 : 2] }
    } else if (ours <= 0) {
      score = scale(-ours)
      text = score <= 1 ? ADVICE[4] : WELCOME
    } else {
      score = -scale(g.total)
      text = ADVICE[score <= -12 ? 0 : score <= -7 ? 1 : score <= -3 ? 2 : score <= -1 ? 3 : score <= 1 ? 4 : score <= 7 ? 5 : 6]
    }
    return { name: a.name, lens: a.lens, score, text }
  })
}

export const INTEREST = ['nul', 'négligeable', 'faible', 'modéré', 'réel', 'fort', 'très fort', 'vital']

export const LEVEL_NAMES = ['', 'Débutant', 'Intermédiaire', 'Expert', 'Cauchemar']
