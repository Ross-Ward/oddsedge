/**
 * Canonical bookmaker directory.
 *
 * Sources:
 *   - Global top-100 traffic rankings (top100bookmakers.com, May 2026)
 *   - Ireland/UK regional rankings (top100bookmakers.com, May 2026)
 *
 * Usage:
 *   import { BOOKMAKERS, getBookmaker, getBookmakersByRegion } from '@/lib/data/bookmakers'
 */

export type BookmakerRegion = 'global' | 'uk_irl'

export interface Bookmaker {
  /** Stable machine key — matches keys used in odds API responses */
  id: string
  name: string
  /** Approximate daily unique visits (source: top100bookmakers.com) */
  dailyVisits: number | null
  /** User rating 1–5 (source: top100bookmakers.com), null = not yet rated */
  rating: number | null
  /** Global top-100 rank position, null if not in global list */
  globalRank: number | null
  /** Ireland/UK regional rank position, null if not in regional list */
  ukIrlRank: number | null
  regions: BookmakerRegion[]
}

export const BOOKMAKERS: Bookmaker[] = [
  // ── Global Top-100 (ranked by daily visits) ──────────────────────────────
  { id: 'stake',          name: 'Stake',            dailyVisits: 3_715_000, rating: 3.6, globalRank: 1,   ukIrlRank: 10,  regions: ['global', 'uk_irl'] },
  { id: 'bet365',         name: 'bet365',            dailyVisits: 2_611_000, rating: 3.6, globalRank: 2,   ukIrlRank: 2,   regions: ['global', 'uk_irl'] },
  { id: 'betway',         name: 'Betway',            dailyVisits: 1_189_000, rating: 2.4, globalRank: 3,   ukIrlRank: null,regions: ['global'] },
  { id: '1xbet',          name: '1xBet',             dailyVisits:   833_000, rating: 3.1, globalRank: 4,   ukIrlRank: null,regions: ['global'] },
  { id: 'msport',         name: 'MSport',            dailyVisits:   816_000, rating: null,globalRank: 5,   ukIrlRank: null,regions: ['global'] },
  { id: 'rainbet',        name: 'Rainbet',           dailyVisits:   741_000, rating: null,globalRank: 6,   ukIrlRank: 6,   regions: ['global', 'uk_irl'] },
  { id: 'apuesta_total',  name: 'Apuesta Total',     dailyVisits:   572_000, rating: null,globalRank: 7,   ukIrlRank: null,regions: ['global'] },
  { id: 'betfair',        name: 'Betfair',           dailyVisits:   530_000, rating: 3.7, globalRank: 8,   ukIrlRank: 5,   regions: ['global', 'uk_irl'] },
  { id: 'skybet',         name: 'Sky Bet',           dailyVisits:   513_000, rating: 3.0, globalRank: 9,   ukIrlRank: 8,   regions: ['global', 'uk_irl'] },
  { id: 'unibet',         name: 'Unibet',            dailyVisits:   480_000, rating: 3.2, globalRank: 10,  ukIrlRank: null,regions: ['global'] },
  { id: 'paddypower',     name: 'Paddy Power',       dailyVisits:   479_000, rating: 2.9, globalRank: 11,  ukIrlRank: 1,   regions: ['global', 'uk_irl'] },
  { id: 'pepeta',         name: 'Pepeta',            dailyVisits:   466_000, rating: null,globalRank: 12,  ukIrlRank: null,regions: ['global'] },
  { id: 'doradobet',      name: 'DoradoBet',         dailyVisits:   446_000, rating: null,globalRank: 13,  ukIrlRank: null,regions: ['global'] },
  { id: 'fanduel',        name: 'FanDuel',           dailyVisits:   429_000, rating: null,globalRank: 14,  ukIrlRank: null,regions: ['global'] },
  { id: 'draftkings',     name: 'DraftKings',        dailyVisits:   425_000, rating: null,globalRank: 15,  ukIrlRank: null,regions: ['global'] },
  { id: 'ladbrokes',      name: 'Ladbrokes',         dailyVisits:   390_000, rating: 2.8, globalRank: 16,  ukIrlRank: 4,   regions: ['global', 'uk_irl'] },
  { id: 'williamhill',    name: 'William Hill',      dailyVisits:   363_000, rating: 3.1, globalRank: 17,  ukIrlRank: 9,   regions: ['global', 'uk_irl'] },
  { id: 'ilotbet',        name: 'iLOTBET',           dailyVisits:   357_000, rating: null,globalRank: 18,  ukIrlRank: null,regions: ['global'] },
  { id: 'coral',          name: 'Coral',             dailyVisits:   303_000, rating: 2.2, globalRank: 19,  ukIrlRank: null,regions: ['global'] },
  { id: 'betclic',        name: 'BetClic',           dailyVisits:   298_000, rating: 2.9, globalRank: 20,  ukIrlRank: null,regions: ['global'] },
  { id: '20bet',          name: '20Bet',             dailyVisits:      297, rating: null, globalRank: null, ukIrlRank: null,regions: [] },
  { id: 'batery',         name: 'Batery',            dailyVisits:   258_000, rating: null,globalRank: 21,  ukIrlRank: null,regions: ['global'] },
  { id: 'betsson',        name: 'Betsson',           dailyVisits:   252_000, rating: 3.0, globalRank: 22,  ukIrlRank: null,regions: ['global'] },
  { id: 'bwin',           name: 'bwin',              dailyVisits:   242_000, rating: 2.6, globalRank: 23,  ukIrlRank: null,regions: ['global'] },
  { id: '10bet',          name: '10bet',             dailyVisits:   239_000, rating: 2.9, globalRank: 24,  ukIrlRank: null,regions: ['global'] },
  { id: 'kwikbet',        name: 'KwikBet',           dailyVisits:   232_000, rating: null,globalRank: 25,  ukIrlRank: null,regions: ['global'] },
  { id: 'mozzart',        name: 'Mozzart',           dailyVisits:   198_000, rating: null,globalRank: 26,  ukIrlRank: null,regions: ['global'] },
  { id: 'tipico',         name: 'Tipico',            dailyVisits:   195_000, rating: 3.4, globalRank: 27,  ukIrlRank: null,regions: ['global'] },
  { id: 'bc_game',        name: 'BC.Game',           dailyVisits:   191_000, rating: null,globalRank: 28,  ukIrlRank: null,regions: ['global'] },
  { id: 'easybet',        name: 'Easybet',           dailyVisits:   176_000, rating: null,globalRank: 29,  ukIrlRank: null,regions: ['global'] },
  { id: 'novibet',        name: 'Novibet',           dailyVisits:   175_000, rating: 3.3, globalRank: 30,  ukIrlRank: 11,  regions: ['global', 'uk_irl'] },
  { id: 'melbet',         name: 'MELbet',            dailyVisits:   174_000, rating: 4.6, globalRank: 31,  ukIrlRank: null,regions: ['global'] },
  { id: 'shuffle',        name: 'Shuffle',           dailyVisits:   165_000, rating: null,globalRank: 32,  ukIrlRank: null,regions: ['global'] },
  { id: 'betmgm',         name: 'BetMGM',            dailyVisits:   159_000, rating: null,globalRank: 33,  ukIrlRank: null,regions: ['global'] },
  { id: 'betera',         name: 'Betera',            dailyVisits:   157_000, rating: null,globalRank: 34,  ukIrlRank: null,regions: ['global'] },
  { id: 'inbet',          name: 'Inbet',             dailyVisits:   139_000, rating: null,globalRank: 35,  ukIrlRank: null,regions: ['global'] },
  { id: 'roobet',         name: 'Roobet',            dailyVisits:   128_000, rating: null,globalRank: 36,  ukIrlRank: 12,  regions: ['global', 'uk_irl'] },
  { id: 'zarbet',         name: 'Zarbet',            dailyVisits:   127_000, rating: null,globalRank: 37,  ukIrlRank: null,regions: ['global'] },
  { id: 'toto',           name: 'TOTO',              dailyVisits:   126_000, rating: null,globalRank: 38,  ukIrlRank: null,regions: ['global'] },
  { id: 'livescore_bet',  name: 'LiveScore Bet',     dailyVisits:   112_000, rating: null,globalRank: 39,  ukIrlRank: null,regions: ['global'] },
  { id: 'betcity_nl',     name: 'BetCity.nl',        dailyVisits:   108_000, rating: null,globalRank: 40,  ukIrlRank: null,regions: ['global'] },
  { id: 'borawin',        name: 'Borawin',           dailyVisits:   108_000, rating: null,globalRank: 41,  ukIrlRank: null,regions: ['global'] },
  { id: 'boylesports',    name: 'Boylesports',       dailyVisits:   104_000, rating: 2.3, globalRank: 42,  ukIrlRank: 3,   regions: ['global', 'uk_irl'] },
  { id: 'pantherbet',     name: 'PantherBet',        dailyVisits:   100_000, rating: null,globalRank: 43,  ukIrlRank: null,regions: ['global'] },
  { id: 'marathonbet',    name: 'Marathonbet',       dailyVisits:    99_700, rating: 3.3, globalRank: 44,  ukIrlRank: null,regions: ['global'] },
  { id: 'zeturf',         name: 'ZEturf',            dailyVisits:    96_700, rating: null,globalRank: 45,  ukIrlRank: null,regions: ['global'] },
  { id: 'sportingbet',    name: 'Sportingbet',       dailyVisits:    94_600, rating: 3.0, globalRank: 46,  ukIrlRank: null,regions: ['global'] },
  { id: 'cwinz',          name: 'Cwinz',             dailyVisits:    94_400, rating: null,globalRank: 47,  ukIrlRank: null,regions: ['global'] },
  { id: 'trustdice',      name: 'Trust Dice',        dailyVisits:    92_800, rating: null,globalRank: 48,  ukIrlRank: null,regions: ['global'] },
  { id: 'meridianbet',    name: 'Meridianbet',       dailyVisits:    92_500, rating: 3.7, globalRank: 49,  ukIrlRank: null,regions: ['global'] },
  { id: '8888',           name: '8888',              dailyVisits:    92_200, rating: null,globalRank: 50,  ukIrlRank: null,regions: ['global'] },
  { id: 'pokerstars',     name: 'PokerStars Sports', dailyVisits:    90_000, rating: null,globalRank: 51,  ukIrlRank: null,regions: ['global'] },
  { id: 'tonybet',        name: 'TonyBet',           dailyVisits:    85_300, rating: 3.3, globalRank: 52,  ukIrlRank: 7,   regions: ['global', 'uk_irl'] },
  { id: 'bangbet',        name: 'Bangbet',           dailyVisits:    82_700, rating: null,globalRank: 53,  ukIrlRank: null,regions: ['global'] },
  { id: 'virginbet',      name: 'Virgin Bet',        dailyVisits:    80_300, rating: null,globalRank: 54,  ukIrlRank: null,regions: ['global'] },
  { id: 'epicbet',        name: 'Epicbet',           dailyVisits:    79_900, rating: null,globalRank: 55,  ukIrlRank: null,regions: ['global'] },
  { id: '711',            name: '711',               dailyVisits:    79_300, rating: null,globalRank: 56,  ukIrlRank: null,regions: ['global'] },
  { id: 'paripesa',       name: 'PariPesa',          dailyVisits:    72_500, rating: null,globalRank: 57,  ukIrlRank: null,regions: ['global'] },
  { id: 'play',           name: 'Play',              dailyVisits:    62_600, rating: null,globalRank: 58,  ukIrlRank: null,regions: ['global'] },
  { id: 'mzansibet',      name: 'Mzansibet',         dailyVisits:    61_500, rating: null,globalRank: 59,  ukIrlRank: null,regions: ['global'] },
  { id: 'interwetten',    name: 'Interwetten',       dailyVisits:    60_800, rating: 2.4, globalRank: 60,  ukIrlRank: null,regions: ['global'] },
  { id: 'netbet',         name: 'NetBet',            dailyVisits:    58_500, rating: 3.0, globalRank: 61,  ukIrlRank: null,regions: ['global'] },
  { id: 'alphawin',       name: 'Alphawin',          dailyVisits:    56_800, rating: null,globalRank: 62,  ukIrlRank: null,regions: ['global'] },
  { id: 'midnite',        name: 'Midnite',           dailyVisits:    55_600, rating: null,globalRank: 63,  ukIrlRank: null,regions: ['global'] },
  { id: 'lottoland',      name: 'Lottoland',         dailyVisits:    55_100, rating: null,globalRank: 64,  ukIrlRank: null,regions: ['global'] },
  { id: 'supersportbet',  name: 'SuperSportBet',     dailyVisits:    54_100, rating: null,globalRank: 65,  ukIrlRank: null,regions: ['global'] },
  { id: '22bet',          name: '22BET',             dailyVisits:    53_700, rating: 2.5, globalRank: 66,  ukIrlRank: null,regions: ['global'] },
  { id: 'betvictor',      name: 'BetVictor',         dailyVisits:    53_600, rating: 2.3, globalRank: 67,  ukIrlRank: null,regions: ['global'] },
  { id: '888sport',       name: '888 Sport',         dailyVisits:    53_400, rating: 3.1, globalRank: 68,  ukIrlRank: null,regions: ['global'] },
  { id: 'leonbets',       name: 'Leon Bets',         dailyVisits:    52_400, rating: 3.0, globalRank: 69,  ukIrlRank: null,regions: ['global'] },
  { id: 'gamdom',         name: 'Gamdom',            dailyVisits:    50_600, rating: null,globalRank: 70,  ukIrlRank: null,regions: ['global'] },
  { id: 'lebull',         name: 'Lebull',            dailyVisits:    50_300, rating: null,globalRank: 71,  ukIrlRank: null,regions: ['global'] },
  { id: 'winna',          name: 'Winna',             dailyVisits:    49_800, rating: null,globalRank: 72,  ukIrlRank: null,regions: ['global'] },
  { id: 'comeon',         name: 'ComeOn!',           dailyVisits:    45_300, rating: 2.8, globalRank: 73,  ukIrlRank: null,regions: ['global'] },
  { id: 'betvibe',        name: 'Betvibe',           dailyVisits:    44_600, rating: null,globalRank: 74,  ukIrlRank: null,regions: ['global'] },
  { id: 'rolletto',       name: 'Rolletto',          dailyVisits:    44_600, rating: null,globalRank: 75,  ukIrlRank: null,regions: ['global'] },
  { id: 'velobet',        name: 'Velobet',           dailyVisits:    43_500, rating: null,globalRank: 76,  ukIrlRank: null,regions: ['global'] },
  { id: 'apexbets',       name: 'ApexBets',          dailyVisits:    43_100, rating: null,globalRank: 77,  ukIrlRank: null,regions: ['global'] },
  { id: 'mrbit',          name: 'MrBit',             dailyVisits:    42_600, rating: null,globalRank: 78,  ukIrlRank: null,regions: ['global'] },
  { id: 'baji',           name: 'Baji',              dailyVisits:    42_100, rating: null,globalRank: 79,  ukIrlRank: null,regions: ['global'] },
  { id: 'winmasters',     name: 'winmasters',        dailyVisits:    39_900, rating: 3.0, globalRank: 80,  ukIrlRank: null,regions: ['global'] },
  { id: 'duelbits',       name: 'Duelbits',          dailyVisits:    39_200, rating: null,globalRank: 81,  ukIrlRank: null,regions: ['global'] },
  { id: 'jacks_nl',       name: 'Jacks.nl',          dailyVisits:    38_100, rating: null,globalRank: 82,  ukIrlRank: null,regions: ['global'] },
  { id: 'tote',           name: 'Tote',              dailyVisits:    37_700, rating: null,globalRank: 83,  ukIrlRank: null,regions: ['global'] },
  { id: 'betwinner',      name: 'BetWinner',         dailyVisits:    36_500, rating: 2.4, globalRank: 84,  ukIrlRank: null,regions: ['global'] },
  { id: 'vincitu',        name: 'VinciTu',           dailyVisits:    35_800, rating: null,globalRank: 85,  ukIrlRank: null,regions: ['global'] },
  { id: 'betsafe',        name: 'Betsafe',           dailyVisits:    35_700, rating: 2.5, globalRank: 86,  ukIrlRank: null,regions: ['global'] },
  { id: 'smarkets',       name: 'Smarkets',          dailyVisits:    35_500, rating: 3.4, globalRank: 87,  ukIrlRank: null,regions: ['global'] },
  { id: 'lvbet',          name: 'LV BET',            dailyVisits:    34_100, rating: null,globalRank: 88,  ukIrlRank: null,regions: ['global'] },
  { id: 'betbaba',        name: 'Betbaba',           dailyVisits:    32_700, rating: null,globalRank: 89,  ukIrlRank: null,regions: ['global'] },
  { id: 'atlantic_city',  name: 'Atlantic City',     dailyVisits:    32_300, rating: null,globalRank: 90,  ukIrlRank: null,regions: ['global'] },
  { id: 'optibet',        name: 'Optibet',           dailyVisits:    31_300, rating: 3.8, globalRank: 91,  ukIrlRank: null,regions: ['global'] },
  { id: 'sportaza',       name: 'Sportaza',          dailyVisits:    31_300, rating: null,globalRank: 92,  ukIrlRank: null,regions: ['global'] },
  { id: 'betbox',         name: 'BetBox',            dailyVisits:    31_200, rating: null,globalRank: 93,  ukIrlRank: null,regions: ['global'] },
  { id: 'kokobet',        name: 'Kokobet',           dailyVisits:    30_200, rating: null,globalRank: 94,  ukIrlRank: null,regions: ['global'] },
  { id: 'favbet',         name: 'Favbet',            dailyVisits:    29_700, rating: 3.0, globalRank: 95,  ukIrlRank: null,regions: ['global'] },
  { id: 'mr_vegas',       name: 'Mr Vegas',          dailyVisits:    28_700, rating: null,globalRank: 96,  ukIrlRank: null,regions: ['global'] },
  { id: 'n1bet',          name: 'N1bet',             dailyVisits:    28_500, rating: null,globalRank: 97,  ukIrlRank: null,regions: ['global'] },
  { id: 'tictacbets',     name: 'Tic Tac Bets',      dailyVisits:    28_100, rating: null,globalRank: 98,  ukIrlRank: null,regions: ['global'] },
  { id: 'helabet',        name: 'helabet',           dailyVisits:    28_000, rating: null,globalRank: 99,  ukIrlRank: null,regions: ['global'] },
  { id: 'betathome',      name: 'bet-at-home',       dailyVisits:    null,   rating: null,globalRank: 100, ukIrlRank: null,regions: ['global'] },
  { id: 'cosmobet',       name: 'Cosmobet',          dailyVisits:    15_300, rating: null,globalRank: null,ukIrlRank: null, regions: ['global'] },
]

/** Look up a bookmaker by its stable id */
export function getBookmaker(id: string): Bookmaker | undefined {
  return BOOKMAKERS.find(b => b.id === id)
}

/** All bookmakers for a given region, sorted by traffic descending */
export function getBookmakersByRegion(region: BookmakerRegion): Bookmaker[] {
  return BOOKMAKERS
    .filter(b => b.regions.includes(region))
    .sort((a, b) => (b.dailyVisits ?? 0) - (a.dailyVisits ?? 0))
}

/** Top N bookmakers by daily visits globally */
export function getTopBookmakers(n = 20): Bookmaker[] {
  return BOOKMAKERS
    .filter(b => b.dailyVisits !== null)
    .sort((a, b) => (b.dailyVisits ?? 0) - (a.dailyVisits ?? 0))
    .slice(0, n)
}
