import { World, USA, div, type NewsItem } from './core'
import refs from '../data/journal.json'

// The newspaper of a country (Events › Newspaper in the original, ChooseHead in Main.p): a front-page headline
// on the country's internal situation, the year's news about it, and a closing item on its government.
// Headlines are assembled like the original's Headline procedure: several parts, each picked among four
// variants, with markers replaced by the country's labels. The French wording is written for this port.

/** How a part picks its variant: c from the countries' yearly random draw, r from the situation's rank, z the first. */
type Part = readonly ['c' | 'r' | 'z', readonly string[]]
type Headline = readonly Part[]

/**
 * Front page, by state of the insurgency (calm → civil war), four headlines each (original STR 128–191).
 * Markers: @ capital, & leader (title, plus name while the original regime holds), % the opposition, / adjective.
 */
const FRONT: readonly (readonly Headline[])[] = [
  [
    [['c', ['Deux vieilles femmes', 'De petits groupes', 'De grands rassemblements', 'Des foules immenses']], ['c', [' protestent', ' défilent', ' brandissent pancartes et banderoles', ' manifestent']], ['c', [' à @', ' lors d’un meeting politique', ' pendant le discours de &', ' dans les rues']], ['z', ['.']]],
    [['c', ['Des étudiants', 'Des milliers de citoyens', 'Des ouvriers excédés', 'Des foules de jeunes']], ['r', [' présentent une pétition', ' exigent des mesures', ' manifestent avec colère', ' déclenchent des émeutes']], ['c', [' contre la vie chère', ' contre les violences policières', ' contre la politique du gouvernement', ' contre les bas salaires']], ['z', ['.']]],
    [['r', ['Deux dissidents', 'Les principaux opposants au régime', 'Des groupes de manifestants', 'Des milliers d’opposants']], ['c', [' escortés jusqu’à &', ' harcelés', ' jetés en prison', ' exécutés']], ['c', [' par la police', ' par des agents du gouvernement', ' par l’armée', ' par les services de sécurité']], ['z', ['.']]],
    [['c', ['Les ouvriers des usines', 'Les travailleurs', 'Les syndiqués', 'Les ouvriers']], ['c', [' se mettent en grève ;', ' débrayent ;', ' cessent le travail ;', ' déclenchent une grève ;']], ['r', [' défilé dans le calme', ' quelques incidents', ' des affrontements signalés', ' « une journée sanglante »']], ['z', ['.']]],
  ],
  [
    [['c', ['Des terroristes antigouvernementaux', 'Des membres de %', 'Des insurgés', 'Des éléments radicaux']], ['c', [' revendiquent', ' annoncent', ' commettent', ' sont soupçonnés d’être mêlés à']], ['r', [' l’enlèvement d’un homme d’affaires américain', ' le récent attentat de l’aéroport', ' l’attaque des dépôts pétroliers', ' l’assassinat du ministre de la Défense']], ['z', ['.']]],
    [['c', ['Le ministre de la Défense', 'Un porte-parole officiel', '&', 'Un haut responsable']], ['c', [' dénonce', ' accuse', ' fustige', ' critique']], ['c', [' les terroristes antigouvernementaux', ' les membres de %', ' les insurgés', ' les éléments radicaux']], ['c', [' après l’attentat contre une école.', ' pour la vague d’assassinats politiques.', ' après l’attaque de l’ambassade américaine à @.', ' après l’attaque sanglante d’un autobus.']]],
    [['c', ['Des terroristes de %', 'Des membres de %', 'Des radicaux', 'Des extrémistes de %']], ['c', [' plastiquent', ' font sauter', ' posent des bombes sur', ' lancent une voiture piégée contre']], ['r', [' des lignes électriques ;', ' un pont ;', ' un carrefour animé ;', ' la résidence de & ;']], ['c', [' dégâts vite réparés.', ' aucune victime.', ' « un champ de ruines ».', ' deux morts.']]],
    [['c', ['Les ratissages', 'Les contrôles', 'Les raids', 'Les coups de filet']], ['c', [' antiterroristes', ' contre %', ' de sécurité', ' de la sécurité intérieure']], ['r', [' resteront discrets,', ' seront intensifiés,', ' sont jugés nécessaires,', ' tourneront à l’offensive générale,']], ['c', [' promet &.', ' affirme un responsable /.', ' selon les observateurs.', ' les insurgés jurent de poursuivre la lutte.']]],
  ],
  [
    [['c', ['Des guérilleros antigouvernementaux', 'Des forces hostiles au régime', 'Des combattants de %', 'Des membres de %']], ['c', [' lancent une série d’attaques contre', ' affrontent l’armée dans', ' attaquent', ' prennent le contrôle de']], ['r', [' des villages isolés', ' plusieurs villes reculées', ' deux capitales provinciales', ' la banlieue de @']], ['z', ['.']]],
    [['c', ['Des unités de l’armée', 'Les forces gouvernementales', 'Les troupes gouvernementales', 'Des soldats fidèles au régime']], ['c', [' ratissent le maquis', ' attaquent les positions de %', ' combattent la guérilla', ' traquent les combattants de %']], ['r', [' avec un succès spectaculaire', ' en infligeant de lourdes pertes', ' avec quelque succès', ' sans grand résultat']], ['z', ['.']]],
    [['c', ['Un chef de la guérilla', 'Un porte-parole de %', 'Le commandant de %', 'Un chef guérillero']], ['c', [' prédit', ' promet', ' annonce', ' prophétise']], ['r', [' « une longue et vaillante lutte »', ' de nouvelles attaques', ' une grande offensive de la guérilla', ' une victoire écrasante']], ['c', [' dans une interview fleuve.', ' devant un auditoire conquis.', ' ; suite en page 10.', ' pour bientôt.']]],
    [['c', ['Selon des rapports,', 'Selon un reporter,', 'Selon une mission d’enquête,', 'Selon une étude,']], ['c', [' les paysans', ' les habitants des campagnes', ' les ruraux', ' les villageois']], ['c', [' font face à', ' subissent', ' endurent', ' vivent avec']], ['r', [' une certaine insécurité.', ' des combats sporadiques.', ' une guerre de tous les instants.', ' la terreur au quotidien.']]],
  ],
  [
    [['c', ['Les forces rebelles', 'Les soldats de %', 'Les troupes antigouvernementales', 'Les forces de %']], ['c', [' attaquent', ' submergent', ' tirent des roquettes sur', ' assiègent']], ['r', [' plusieurs patrouilles gouvernementales', ' des avant-postes de l’armée', ' une grande base militaire', ' @']], ['z', ['.']]],
    [['c', ['Les forces armées', 'Des unités gouvernementales', 'Les soldats du gouvernement', 'Les troupes fidèles au régime']], ['c', [' lancent une grande offensive', ' combattent des éléments rebelles', ' pilonnent les positions ennemies', ' affrontent les combattants de %']], ['r', [' ; lourdes pertes chez les rebelles', ' et marquent quelques points', ' sans résultat', ' mais subissent de lourdes pertes']], ['z', ['.']]],
    [['c', ['Un porte-parole /', '&', 'Un haut responsable', 'Une source gouvernementale']], ['c', [' revendique', ' proclame', ' annonce', ' célèbre']], ['r', [' une victoire totale', ' une grande victoire', ' quelques succès', ' des signes encourageants']], ['c', [' lors du dernier combat contre les rebelles.', ' dans la guerre civile.', ' après une bataille acharnée.', ' contre %.']]],
    [['c', ['Les forces rebelles', 'Des soldats antigouvernementaux', 'Les troupes de %', 'Des unités de %']], ['c', [' tendent une embuscade à', ' mitraillent', ' encerclent', ' anéantissent']], ['r', [' des patrouilles de l’armée', ' des avant-postes gouvernementaux', ' un bataillon de l’armée', ' une division entière']], ['z', ['.']]],
  ],
]

/** Front page the year the rebels took power (original STR 412–415). */
const REVOLUTION: Headline = [['c', ['Les soldats de %', 'De petits groupes de citoyens', 'Des foules souriantes', 'Des foules en délire']], ['c', [' acclament', ' accueillent', ' saluent', ' fêtent']], ['c', [' le nouveau régime', ' le nouveau pouvoir', ' le nouveau dirigeant', ' le nouveau chef de l’État']], ['c', [' à @.', ' dans la capitale.', ' et son entourage.', ' et ses partisans.']]]

/** Closing item, by the government's leaning from left to right (original STR 216–231). */
const CLOSE_WING: readonly Headline[] = [
  [['c', ['Le gouvernement', '&', 'Le ministre de l’Industrie', 'Le ministre de l’Économie']], ['c', [' annonce', ' proclame', ' dévoile', ' publie']], ['c', [' un nouveau plan quinquennal', ' un plan économique révisé', ' un programme économique remanié', ' un plan décennal actualisé']], ['z', ['.']]],
  [['c', ['Le gouvernement', '@', '&', 'Le gouvernement']], ['c', [' prend le contrôle de', ' fait main basse sur', ' nationalise', ' rachète']], ['c', [' plusieurs', ' certaines', ' plusieurs', ' certaines']], ['c', [' mines étrangères.', ' aciéries privées.', ' raffineries.', ' banques.']]],
  [['c', ['Un nouveau plan fiscal', 'Le projet de réforme fiscale', 'Le nouveau code des impôts', 'Le projet de loi fiscale']], ['c', [' présenté aux', ' examiné par les', ' débattu par les', ' adopté par les']], ['c', [' législateurs', ' parlementaires', ' députés', ' élus']], ['z', ['.']]],
  [['z', ['&']], ['c', [' promet', ' garantit', ' assure', ' annonce']], ['c', [' le maintien du', ' la poursuite du', ' le respect du', ' l’extension du']], ['c', [' libre-échange.', ' libéralisme économique.', ' marché libre.', ' climat favorable aux affaires.']]],
]

/** Closing item, by the government's popularity from low to high (original STR 232–247). */
const CLOSE_POPULAR: readonly Headline[] = [
  [['c', ['Des foules maussades', 'Des groupes apeurés', 'Des badauds silencieux', 'De maigres groupes']], ['c', [' assistent', ' sont présents', ' sont aperçus', ' sont signalés']], ['c', [' au discours de &.', ' à l’anniversaire de la révolution.', ' au défilé officiel.', ' à une « fête spontanée ».']]],
  [['c', ['Faible', 'Maigre', 'Piètre', 'Timide']], ['c', [' participation', ' mobilisation', ' adhésion populaire', ' affluence']], ['c', [' au dernier', ' au récent', ' au grand', ' à l’ultime']], ['c', [' plébiscite.', ' scrutin sans enjeu.', ' vote de façade.', ' plébiscite.']]],
  [['c', ['Le soutien dont bénéficie', 'La popularité de', 'Le soutien dont jouit', 'La popularité de']], ['c', [' le gouvernement', ' &', ' la direction du pays', ' &']], ['c', [' resterait', ' semble', ' serait', ' paraît']], ['c', [' stable.', ' honorable.', ' solide.', ' en hausse.']]],
  [['z', ['&']], ['c', [' : bain de foule parmi', ' reçoit l’ovation de', ' salue', ' s’adresse à']], ['c', [' des citoyens enthousiastes.', ' des foules en liesse.', ' une population qui chante.', ' des partisans exaltés.']]],
]

/** The American paper keeps to gossip and, last page, a nod to the game's publisher (original STR 900–903, 912–915). */
const FRONT_USA: Headline = [['c', ['Farrah', 'Jackie Onassis', 'Liz Taylor', 'Michael Jackson']], ['c', [' prédit', ' révèle', ' affirme avoir découvert', ' annonce']], ['c', [' le remède au cancer : le sexe', ' un séisme imminent en Californie', ' la réincarnation d’Elvis', ' un régime révolutionnaire']], ['z', ['.']]]
const CLOSE_USA: Headline = [['c', ['La part de marché de', 'La demande pour', 'L’enthousiasme de la critique pour', 'L’accueil du public pour']], ['z', [' Trust and Betrayal']], ['c', [' s’envole ;', ' bat tous les records ;', ' crève le plafond ;', ' dépasse toutes les prévisions ;']], ['c', [' Mindscape rachète Wall Street.', ' l’économie dopée.', ' les analystes jubilent.', ' le président décrète une journée d’action de grâce.']]]

/** A leader of a country, from a given year (src/data/journal.json). */
export interface Leader {
  depuis: number
  titre: string
  nom: string
}

/** References of a country for its paper (src/data/journal.json), in place of the original's STR 1001–1080. */
interface CountryRefs {
  nom: string
  adjectif: string
  capitale: string
  oppositionGauche: string
  oppositionDroite: string
  dirigeants: Leader[]
  evenements: Record<string, string>
}

const REFS = refs.pays as Record<string, CountryRefs>

/** The leader of country c in a given year: the last entry starting no later than it (the first one before). */
export function leaderOf(c: number, year: number): Leader {
  const list = REFS[c].dirigeants
  let leader = list[0]
  for (const d of list) if (d.depuis <= year) leader = d
  return leader
}

/** The real event of country c in a given year, if the file has one. */
export function eventOf(c: number, year: number): string | null {
  return REFS[c].evenements[String(year)] ?? null
}

const MASTHEADS = ['Le Courrier', 'La Gazette', 'L’Écho', 'Le Journal']
const CONTRACT: Record<string, string> = { 'à le': 'au', 'à les': 'aux', 'de le': 'du', 'de les': 'des' }

/**
 * French contractions and elisions left by the markers (« de le Caire » → « du Caire », « de Ankara » → « d’Ankara »),
 * and a narrow no-break space before ; : ! ? » and after «, so they never start a line.
 */
export function frenchify(s: string): string {
  return typeset(s
    .replace(/(^|[\s’'«(])(à|de) (le|les) /gi, (_m, pre: string, prep: string, art: string) => `${pre}${CONTRACT[`${prep.toLowerCase()} ${art.toLowerCase()}`]} `)
    .replace(/(^|\s)de des /g, '$1de ')
    .replace(/(^|[\s’'])de ([aeiouyhéèêâîôûAEIOUYHÉÈÊÂÎÔÛ])/g, '$1d’$2'))
}

/** Only the narrow no-break spaces, for texts written in full (the chronicle). */
export function typeset(s: string): string {
  return s
    .replace(/ ([;:!?»])/g, ' $1')
    .replace(/« /g, '« ')
}

/** One headline about country c (object USA for the variant draw, as in the original). */
function compose(w: World, c: number, h: Headline, rank: number): string {
  const r = REFS[c]
  const { titre, nom } = leaderOf(c, w.year)
  const seed = div(w.cntryRnd[c], 2) + div(w.cntryRnd[USA], 2)
  const text = h.map(([pick, variants], i) => variants[pick === 'z' ? 0 : pick === 'r' ? Math.max(0, Math.min(3, rank)) : (seed >> (2 * i + 1)) & 3] ?? variants[0]).join('')
  const filled = text.replace(/[@&%/]/g, (m) => ({
    '@': r.capitale,
    // the leader is named only while the original regime holds
    '&': w.virgin[c] ? `${titre} ${nom}` : titre,
    '%': w.leftPowr[c] ? r.oppositionDroite : r.oppositionGauche,
    '/': r.adjectif,
  })[m]!)
  const out = frenchify(filled)
  return out.charAt(0).toUpperCase() + out.slice(1)
}

export interface Journal {
  /** Name of the paper, after the capital. */
  masthead: string
  /** Front-page headline on the country's internal situation. */
  front: string
  /** The year's news about the country, most newsworthy first. */
  news: NewsItem[]
  /** Closing item on the government. */
  close: string
  /** What really happened in the country that year (src/data/journal.json), if known. */
  chronicle: string | null
}

/** The newspaper of country c for the current year. */
export function journal(w: World, c: number): Journal {
  // MakeFirstHead: the government/insurgency strength ratio picks the family (calm → civil war) and the rank within it.
  // The original meant the headline variant to come from the yearly draw, but shifted the wrong way and always
  // used the first; we use the intended bits.
  let front: string
  if (c === USA) front = compose(w, c, FRONT_USA, 0)
  else if (w.rebWinFlag[c]) front = compose(w, c, REVOLUTION, 0)
  else {
    let x = c < 3 ? 4096 : w.strngRat[c], j = 0
    while (x > 1) { x = div(x, 2); j++ }
    j = Math.min(j, 12)
    const rank = j === 0 ? 7 - 4 * w.strngRat[c] : (12 - j) % 4
    front = compose(w, c, FRONT[div(12 - j, 4)][(w.cntryRnd[c] >> 8) & 3], rank)
  }
  // MakeLastHead: popularity or, for the other half of the draws, economic policy by leaning.
  let close: string
  if (c === USA) close = compose(w, c, CLOSE_USA, 0)
  else {
    const popular = w.cntryRnd[c] > 0
    const x = Math.min(255, popular ? 13 * w.gPopular[c] : w.govtWing[c] + 127)
    close = compose(w, c, (popular ? CLOSE_POPULAR : CLOSE_WING)[div(x, 64)], div(x % 64, 16))
  }
  return {
    masthead: frenchify(`${MASTHEADS[c % 4]} de ${REFS[c].capitale}`),
    front,
    news: w.news.filter((n) => n.subject === c || n.object === c),
    close,
    chronicle: eventOf(c, w.year) && typeset(eventOf(c, w.year)!),
  }
}
