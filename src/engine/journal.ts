import { World, USA, div, type NewsItem } from './core'

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

/**
 * Labels of each country (original STR 1001–1080): adjective, capital, leader's title (with its article),
 * left-wing and right-wing opposition (with their article), leader's name. Names are the late 1980s ones of the original.
 */
const LABELS: Record<number, readonly [adj: string, capital: string, leader: string, left: string, right: string, name: string]> = {
  1: ['américain', 'Washington', 'le président', 'le Parti républicain', 'le Parti démocrate', 'DuckBush'],
  2: ['soviétique', 'Moscou', 'le secrétaire général', 'le Parti communiste', 'les militants des droits de l’homme', 'Gorbatchev'],
  3: ['mexicain', 'Mexico', 'le président', 'l’insurrection', 'l’insurrection', 'de la Madrid'],
  4: ['hondurien', 'Tegucigalpa', 'le président', 'l’insurrection', 'les Miskitos', 'Suazo Córdova'],
  5: ['nicaraguayen', 'Managua', 'le président', 'les sandinistes', 'les contras', 'Ortega'],
  6: ['panaméen', 'Panama', 'le président', 'l’insurrection', 'l’insurrection', 'Noriega'],
  7: ['cubain', 'La Havane', 'le président', 'le mouvement castriste', 'l’insurrection', 'Castro'],
  8: ['argentin', 'Buenos Aires', 'le président', 'l’insurrection', 'les péronistes', 'Alfonsín'],
  9: ['colombien', 'Bogota', 'le président', 'le M-19', 'l’insurrection', 'Cuartas'],
  10: ['péruvien', 'Lima', 'le président', 'le Sentier lumineux', 'l’insurrection', 'Pérez'],
  11: ['vénézuélien', 'Caracas', 'le président', 'l’insurrection', 'l’insurrection', 'Lusinchi'],
  12: ['brésilien', 'Brasilia', 'le président', 'l’insurrection', 'l’insurrection', 'Sarney'],
  13: ['chilien', 'Santiago', 'le président', 'le FPMR', 'l’insurrection', 'Pinochet'],
  14: ['canadien', 'Ottawa', 'le Premier ministre', 'les indépendantistes québécois', 'l’insurrection', 'Mulroney'],
  15: ['grec', 'Athènes', 'le Premier ministre', 'le groupe « 17-Novembre »', 'l’insurrection', 'Papandréou'],
  16: ['suédois', 'Stockholm', 'le Premier ministre', 'l’insurrection', 'l’insurrection', 'Svenson'],
  17: ['britannique', 'Londres', 'le Premier ministre', 'l’IRA', 'l’insurrection', 'Thatcher'],
  18: ['français', 'Paris', 'le président', 'le groupe Action directe', 'l’insurrection', 'Mitterrand'],
  19: ['espagnol', 'Madrid', 'le président du gouvernement', 'les FP-25', 'l’insurrection', 'González'],
  20: ['ouest-allemand', 'Bonn', 'le chancelier', 'la Fraction armée rouge', 'l’insurrection', 'Kohl'],
  21: ['roumain', 'Bucarest', 'le président', 'l’insurrection', 'les contre-révolutionnaires', 'Ceaușescu'],
  22: ['italien', 'Rome', 'le président du Conseil', 'les Brigades rouges', 'l’insurrection', 'Craxi'],
  23: ['est-allemand', 'Berlin-Est', 'le chef du Parti', 'l’insurrection', 'l’insurrection', 'Honecker'],
  24: ['polonais', 'Varsovie', 'le chef militaire', 'l’insurrection', 'Solidarność', 'Jaruzelski'],
  25: ['tchécoslovaque', 'Prague', 'le secrétaire général', 'le Parti communiste', 'l’insurrection', 'Husák'],
  26: ['yougoslave', 'Belgrade', 'le président', 'le Parti communiste', 'les Albanais du Kosovo', 'Špiljak'],
  27: ['sud-africain', 'Pretoria', 'le Premier ministre', 'l’ANC', 'l’insurrection', 'Botha'],
  28: ['égyptien', 'le Caire', 'le président', 'les intégristes musulmans', 'l’insurrection', 'Moubarak'],
  29: ['tunisien', 'Tunis', 'le président', 'l’insurrection', 'l’insurrection', 'Mzali'],
  30: ['marocain', 'Rabat', 'le roi', 'le Polisario', 'l’insurrection', 'Hassan II'],
  31: ['algérien', 'Alger', 'le président', 'les autonomistes kabyles', 'l’insurrection', 'Chadli'],
  32: ['libyen', 'Tripoli', 'le colonel', 'Al-Bourkan', 'l’insurrection', 'Kadhafi'],
  33: ['malien', 'Bamako', 'le président', 'l’insurrection', 'l’insurrection', 'Traoré'],
  34: ['nigérian', 'Lagos', 'le président', 'l’insurrection', 'l’insurrection', 'Babangida'],
  35: ['soudanais', 'Khartoum', 'le général', 'l’Anya-Nya', 'l’insurrection', 'al-Dahab'],
  36: ['éthiopien', 'Addis-Abeba', 'le colonel', 'le Front de libération de l’Érythrée', 'l’insurrection', 'Mengistu'],
  37: ['kényan', 'Nairobi', 'le président', 'l’insurrection', 'l’insurrection', 'Moi'],
  38: ['zaïrois', 'Kinshasa', 'le président', 'le FLNC', 'l’insurrection', 'Mobutu'],
  39: ['tanzanien', 'Dar es Salaam', 'le président', 'l’insurrection', 'l’insurrection', 'Nyerere'],
  40: ['mozambicain', 'Maputo', 'le président', 'les Makondés', 'l’insurrection', 'Machel'],
  41: ['zambien', 'Lusaka', 'le président', 'l’insurrection', 'l’insurrection', 'Kaunda'],
  42: ['angolais', 'Luanda', 'le président', 'l’insurrection', 'l’UNITA', 'dos Santos'],
  43: ['japonais', 'Tokyo', 'le Premier ministre', 'l’Armée rouge japonaise', 'l’insurrection', 'Nakasone'],
  44: ['nord-coréen', 'Pyongyang', 'le président', 'l’insurrection', 'l’insurrection', 'Kim Il-sung'],
  45: ['sud-coréen', 'Séoul', 'le général', 'le Parti communiste', 'l’insurrection', 'Chun Doo-hwan'],
  46: ['australien', 'Canberra', 'le Premier ministre', 'le Front de libération aborigène', 'le Mouvement du koala noir', 'Hawke'],
  47: ['chinois', 'Pékin', 'le secrétaire du Parti', 'le Parti communiste', 'le mouvement contre-révolutionnaire', 'Deng'],
  48: ['vietnamien', 'Hanoï', 'le président du Parti', 'les Khmers rouges', 'l’insurrection', 'Lê Duẩn'],
  49: ['turc', 'Ankara', 'le président', 'l’insurrection', 'l’insurrection', 'Özal'],
  50: ['syrien', 'Damas', 'le président', 'les Frères musulmans', 'l’insurrection', 'Assad'],
  51: ['israélien', 'Jérusalem', 'le Premier ministre', 'l’OLP', 'l’insurrection', 'Peres'],
  52: ['taïwanais', 'Taipei', 'le président', 'le Parti communiste', 'l’insurrection', 'Chiang Ching-kuo'],
  53: ['irakien', 'Bagdad', 'le président', 'les sunnites', 'l’insurrection', 'Saddam Hussein'],
  54: ['saoudien', 'Riyad', 'le roi', 'les extrémistes chiites', 'l’insurrection', 'Fahd'],
  55: ['iranien', 'Téhéran', 'l’ayatollah', 'le Toudeh', 'l’insurrection', 'Khomeiny'],
  56: ['afghan', 'Kaboul', 'le président', 'le Parti communiste', 'les moudjahidin', 'Najibullah'],
  57: ['pakistanais', 'Islamabad', 'le président', 'les Pachtounes', 'l’insurrection', 'Zia'],
  58: ['indien', 'New Delhi', 'le Premier ministre', 'le mouvement sikh', 'l’insurrection', 'Gandhi'],
  59: ['birman', 'Rangoun', 'le président', 'les Kachins', 'l’insurrection', 'San Yu'],
  60: ['thaïlandais', 'Bangkok', 'le Premier ministre', 'les insurgés', 'l’insurrection', 'Tinsulanonda'],
  61: ['indonésien', 'Jakarta', 'le président', 'le Parti communiste', 'l’insurrection', 'Suharto'],
  62: ['philippin', 'Manille', 'la présidente', 'la Nouvelle Armée populaire', 'l’insurrection', 'Aquino'],
  63: ['guatémaltèque', 'Guatemala', 'le général', 'l’insurrection', 'l’insurrection', 'Mejía Víctores'],
  64: ['salvadorien', 'San Salvador', 'le président', 'le FPL', 'l’insurrection', 'Duarte'],
  65: ['costaricien', 'San José', 'le président', 'l’insurrection', 'l’insurrection', 'Arias'],
  66: ['mauritanien', 'Nouakchott', 'le président', 'l’insurrection', 'l’insurrection', 'Taya'],
  67: ['guinéen', 'Conakry', 'le colonel', 'l’insurrection', 'l’insurrection', 'Conté'],
  68: ['ivoirien', 'Abidjan', 'le président', 'l’insurrection', 'l’insurrection', 'Houphouët-Boigny'],
  69: ['burkinabè', 'Ouagadougou', 'le président', 'l’insurrection', 'l’insurrection', 'Sankara'],
  70: ['ghanéen', 'Accra', 'le président', 'l’insurrection', 'l’insurrection', 'Rawlings'],
  71: ['nigérien', 'Niamey', 'le général', 'l’insurrection', 'l’insurrection', 'Kountché'],
  72: ['tchadien', 'N’Djamena', 'le président', 'l’insurrection', 'l’insurrection', 'Habré'],
  73: ['camerounais', 'Yaoundé', 'le président', 'l’insurrection', 'l’insurrection', 'Biya'],
  74: ['centrafricain', 'Bangui', 'le général', 'l’insurrection', 'l’insurrection', 'Kolingba'],
  75: ['congolais', 'Brazzaville', 'le colonel', 'l’insurrection', 'l’insurrection', 'Sassou-Nguesso'],
  76: ['zimbabwéen', 'Harare', 'le Premier ministre', 'la ZAPU', 'l’insurrection', 'Mugabe'],
  77: ['botswanais', 'Gaborone', 'le président', 'l’insurrection', 'l’insurrection', 'Masire'],
  78: ['jordanien', 'Amman', 'le roi', 'l’insurrection', 'l’insurrection', 'Hussein'],
  79: ['libanais', 'Beyrouth', 'le président', 'l’insurrection', 'l’insurrection', 'Gemayel'],
  80: ['bolivien', 'La Paz', 'le président', 'l’insurrection', 'l’insurrection', 'Paz Estenssoro'],
}

const MASTHEADS = ['Le Courrier', 'La Gazette', 'L’Écho', 'Le Journal']
const CONTRACT: Record<string, string> = { 'à le': 'au', 'à les': 'aux', 'de le': 'du', 'de les': 'des' }

/**
 * French contractions and elisions left by the markers (« de le Caire » → « du Caire », « de Ankara » → « d’Ankara »),
 * and a narrow no-break space before ; : ! ? » and after «, so they never start a line.
 */
export function frenchify(s: string): string {
  return s
    .replace(/(^|[\s’'«(])(à|de) (le|les) /gi, (_m, pre: string, prep: string, art: string) => `${pre}${CONTRACT[`${prep.toLowerCase()} ${art.toLowerCase()}`]} `)
    .replace(/(^|\s)de des /g, '$1de ')
    .replace(/(^|[\s’'])de ([aeiouyhéèêâîôûAEIOUYHÉÈÊÂÎÔÛ])/g, '$1d’$2')
    .replace(/ ([;:!?»])/g, ' $1')
    .replace(/« /g, '« ')
}

/** One headline about country c (object USA for the variant draw, as in the original). */
function compose(w: World, c: number, h: Headline, rank: number): string {
  const [adj, capital, leader, left, right, name] = LABELS[c]
  const seed = div(w.cntryRnd[c], 2) + div(w.cntryRnd[USA], 2)
  const text = h.map(([pick, variants], i) => variants[pick === 'z' ? 0 : pick === 'r' ? Math.max(0, Math.min(3, rank)) : (seed >> (2 * i + 1)) & 3] ?? variants[0]).join('')
  const filled = text.replace(/[@&%/]/g, (m) => ({
    '@': capital,
    '&': w.virgin[c] ? `${leader} ${name}` : leader,
    '%': w.leftPowr[c] ? right : left,
    '/': adj,
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
    masthead: frenchify(`${MASTHEADS[c % 4]} de ${LABELS[c][1]}`),
    front,
    news: w.news.filter((n) => n.subject === c || n.object === c),
    close,
  }
}
