/**
 * Master configuration: all sports, leagues, bookmakers and their
 * source-specific identifiers for each scraping platform.
 */
import { Sport } from '../types'

// ─── Bookmaker catalogue ────────────────────────────────────────────────────

export interface BookmakerMeta {
  key: string
  title: string
  country: string
  currency: string
  oddsFormat: 'decimal' | 'fractional' | 'american'
  region: 'uk' | 'us' | 'eu' | 'au' | 'int'
  platform?: string // e.g. 'kambi', 'openbet', 'sbtech'
}

export const BOOKMAKERS: BookmakerMeta[] = [
  // ── UK ──────────────────────────────────────────────────────────────────
  { key: 'bet365',       title: 'Bet365',          country: 'UK',        currency: 'GBP', oddsFormat: 'decimal',    region: 'uk' },
  { key: 'williamhill',  title: 'William Hill',    country: 'UK',        currency: 'GBP', oddsFormat: 'decimal',    region: 'uk', platform: 'openbet' },
  { key: 'skybet',       title: 'Sky Bet',         country: 'UK',        currency: 'GBP', oddsFormat: 'fractional', region: 'uk', platform: 'sbttech' },
  { key: 'paddy_power',  title: 'Paddy Power',     country: 'IRE/UK',    currency: 'GBP', oddsFormat: 'fractional', region: 'uk' },
  { key: 'coral',        title: 'Coral',           country: 'UK',        currency: 'GBP', oddsFormat: 'fractional', region: 'uk' },
  { key: 'ladbrokes',    title: 'Ladbrokes',       country: 'UK',        currency: 'GBP', oddsFormat: 'fractional', region: 'uk' },
  { key: 'betfair',      title: 'Betfair',         country: 'UK',        currency: 'GBP', oddsFormat: 'decimal',    region: 'uk' },
  { key: 'betvictor',    title: 'BetVictor',       country: 'UK',        currency: 'GBP', oddsFormat: 'fractional', region: 'uk' },
  { key: 'betfred',      title: 'Betfred',         country: 'UK',        currency: 'GBP', oddsFormat: 'fractional', region: 'uk' },
  { key: 'sport888',     title: '888sport',        country: 'UK',        currency: 'GBP', oddsFormat: 'decimal',    region: 'uk', platform: 'kambi' },
  // ── European ────────────────────────────────────────────────────────────
  { key: 'unibet',       title: 'Unibet',          country: 'Sweden',    currency: 'EUR', oddsFormat: 'decimal',    region: 'eu', platform: 'kambi' },
  { key: 'bwin',         title: 'bwin',            country: 'Austria',   currency: 'EUR', oddsFormat: 'decimal',    region: 'eu' },
  { key: 'betsson',      title: 'Betsson',         country: 'Sweden',    currency: 'EUR', oddsFormat: 'decimal',    region: 'eu', platform: 'kambi' },
  { key: 'pinnacle',     title: 'Pinnacle',        country: 'Curacao',   currency: 'USD', oddsFormat: 'decimal',    region: 'eu' },
  { key: 'betway',       title: 'Betway',          country: 'Malta',     currency: 'EUR', oddsFormat: 'decimal',    region: 'eu' },
  { key: 'mrgreen',      title: 'Mr Green',        country: 'Malta',     currency: 'EUR', oddsFormat: 'decimal',    region: 'eu', platform: 'kambi' },
  { key: '1xbet',        title: '1xBet',           country: 'Russia',    currency: 'EUR', oddsFormat: 'decimal',    region: 'int' },
  { key: 'nordicbet',    title: 'NordicBet',       country: 'Malta',     currency: 'EUR', oddsFormat: 'decimal',    region: 'eu', platform: 'kambi' },
  // ── US ──────────────────────────────────────────────────────────────────
  { key: 'draftkings',   title: 'DraftKings',      country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  { key: 'fanduel',      title: 'FanDuel',         country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  { key: 'betmgm',       title: 'BetMGM',          country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  { key: 'pointsbet',    title: 'PointsBet',       country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  { key: 'caesars',      title: 'Caesars',         country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  { key: 'barstool',     title: 'Barstool Sports', country: 'US',        currency: 'USD', oddsFormat: 'american',   region: 'us' },
  // ── Aus / NZ ────────────────────────────────────────────────────────────
  { key: 'sportsbet_au', title: 'Sportsbet',       country: 'Australia', currency: 'AUD', oddsFormat: 'decimal',    region: 'au' },
  { key: 'tab_au',       title: 'TAB',             country: 'Australia', currency: 'AUD', oddsFormat: 'decimal',    region: 'au' },
  { key: 'ladbrokes_au', title: 'Ladbrokes AU',    country: 'Australia', currency: 'AUD', oddsFormat: 'decimal',    region: 'au' },
  // ── Crypto / offshore ───────────────────────────────────────────────────
  { key: 'bovada',       title: 'Bovada',          country: 'Curacao',   currency: 'USD', oddsFormat: 'american',   region: 'int' },
  { key: 'betcris',      title: 'Betcris',         country: 'Costa Rica',currency: 'USD', oddsFormat: 'decimal',    region: 'int' },
  // ── Racing ──────────────────────────────────────────────────────────────
  { key: 'betfair_ex',   title: 'Betfair Exchange',country: 'UK',        currency: 'GBP', oddsFormat: 'decimal',    region: 'uk' },
  // ── Prediction markets ───────────────────────────────────────────────────
  { key: 'kalshi',       title: 'Kalshi',          country: 'US',        currency: 'USD', oddsFormat: 'decimal',    region: 'us' },
  { key: 'polymarket',   title: 'Polymarket',      country: 'Global',    currency: 'USDC',oddsFormat: 'decimal',    region: 'int' },
]

// ─── League catalogue ────────────────────────────────────────────────────────

export interface LeagueMeta {
  id: string
  name: string
  sport: Sport
  country: string
  continent: string
  tier: 1 | 2 | 3 // 1 = top flight, 2 = second division, 3 = cup/minor
  // Source-specific IDs
  espnSport?: string
  espnLeague?: string
  sofascoreId?: number
  oddsportalPath?: string // /soccer/england/premier-league/
  actionNetworkKey?: string
  kambiPath?: string // football/england/premier-league
}

export const LEAGUES: LeagueMeta[] = [
  // ─── Soccer / Football ──────────────────────────────────────────────────
  // England
  { id: 'eng_pl',       name: 'Premier League',       sport: 'soccer', country: 'England',     continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'eng.1',             sofascoreId: 17,   oddsportalPath: '/soccer/england/premier-league/',         kambiPath: 'football/england/premier-league' },
  { id: 'eng_champ',    name: 'Championship',         sport: 'soccer', country: 'England',     continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'eng.2',             sofascoreId: 18,   oddsportalPath: '/soccer/england/championship/',           kambiPath: 'football/england/championship' },
  { id: 'eng_l1',       name: 'League One',           sport: 'soccer', country: 'England',     continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'eng.3',                                  oddsportalPath: '/soccer/england/league-one/' },
  { id: 'eng_facup',    name: 'FA Cup',               sport: 'soccer', country: 'England',     continent: 'Europe', tier: 3, espnSport: 'soccer', espnLeague: 'eng.fa',            sofascoreId: 31,   oddsportalPath: '/soccer/england/fa-cup/' },
  { id: 'eng_lc',       name: 'League Cup',           sport: 'soccer', country: 'England',     continent: 'Europe', tier: 3, espnSport: 'soccer', espnLeague: 'eng.league_cup',                         oddsportalPath: '/soccer/england/league-cup/' },
  // Spain
  { id: 'esp_ll',       name: 'La Liga',              sport: 'soccer', country: 'Spain',       continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'esp.1',             sofascoreId: 8,    oddsportalPath: '/soccer/spain/laliga/',                   kambiPath: 'football/spain/primera-division' },
  { id: 'esp_2',        name: 'Segunda División',     sport: 'soccer', country: 'Spain',       continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'esp.2',             sofascoreId: 52,   oddsportalPath: '/soccer/spain/segunda-division/' },
  { id: 'esp_copa',     name: 'Copa del Rey',         sport: 'soccer', country: 'Spain',       continent: 'Europe', tier: 3, espnSport: 'soccer', espnLeague: 'esp.copa_del_rey',  sofascoreId: 329,  oddsportalPath: '/soccer/spain/copa-del-rey/' },
  // Germany
  { id: 'ger_bl1',      name: 'Bundesliga',           sport: 'soccer', country: 'Germany',     continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'ger.1',             sofascoreId: 35,   oddsportalPath: '/soccer/germany/bundesliga/',             kambiPath: 'football/germany/bundesliga' },
  { id: 'ger_bl2',      name: '2. Bundesliga',        sport: 'soccer', country: 'Germany',     continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'ger.2',             sofascoreId: 44,   oddsportalPath: '/soccer/germany/2-bundesliga/' },
  { id: 'ger_pokal',    name: 'DFB Pokal',            sport: 'soccer', country: 'Germany',     continent: 'Europe', tier: 3, espnSport: 'soccer', espnLeague: 'ger.dfb_pokal',     sofascoreId: 46,   oddsportalPath: '/soccer/germany/dfb-pokal/' },
  // Italy
  { id: 'ita_sa',       name: 'Serie A',              sport: 'soccer', country: 'Italy',       continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'ita.1',             sofascoreId: 23,   oddsportalPath: '/soccer/italy/serie-a/',                  kambiPath: 'football/italy/serie-a' },
  { id: 'ita_sb',       name: 'Serie B',              sport: 'soccer', country: 'Italy',       continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'ita.2',             sofascoreId: 53,   oddsportalPath: '/soccer/italy/serie-b/' },
  // France
  { id: 'fra_l1',       name: 'Ligue 1',              sport: 'soccer', country: 'France',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'fra.1',             sofascoreId: 34,   oddsportalPath: '/soccer/france/ligue-1/',                 kambiPath: 'football/france/ligue-1' },
  { id: 'fra_l2',       name: 'Ligue 2',              sport: 'soccer', country: 'France',      continent: 'Europe', tier: 2, espnSport: 'soccer', espnLeague: 'fra.2',             sofascoreId: 182,  oddsportalPath: '/soccer/france/ligue-2/' },
  // Netherlands
  { id: 'ned_ere',      name: 'Eredivisie',           sport: 'soccer', country: 'Netherlands', continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'ned.1',             sofascoreId: 37,   oddsportalPath: '/soccer/netherlands/eredivisie/' },
  // Portugal
  { id: 'por_pl',       name: 'Primeira Liga',        sport: 'soccer', country: 'Portugal',    continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'por.1',             sofascoreId: 238,  oddsportalPath: '/soccer/portugal/primeira-liga/' },
  // Scotland
  { id: 'sco_pre',      name: 'Scottish Premiership', sport: 'soccer', country: 'Scotland',    continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'sco.1',             sofascoreId: 36,   oddsportalPath: '/soccer/scotland/premiership/' },
  // Turkey
  { id: 'tur_sl',       name: 'Süper Lig',            sport: 'soccer', country: 'Turkey',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'tur.1',             sofascoreId: 52,   oddsportalPath: '/soccer/turkey/super-lig/' },
  // Belgium
  { id: 'bel_1a',       name: 'First Division A',     sport: 'soccer', country: 'Belgium',     continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'bel.1',             sofascoreId: 38,   oddsportalPath: '/soccer/belgium/first-division-a/' },
  // Russia
  { id: 'rus_rpl',      name: 'Russian Premier League', sport: 'soccer', country: 'Russia',    continent: 'Europe', tier: 1,                                                        sofascoreId: 203,  oddsportalPath: '/soccer/russia/premier-league/' },
  // UEFA
  { id: 'ucl',          name: 'Champions League',     sport: 'soccer', country: 'Europe',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'uefa.champions',    sofascoreId: 7,    oddsportalPath: '/soccer/europe/champions-league/',        kambiPath: 'football/europe/champions-league' },
  { id: 'uel',          name: 'Europa League',        sport: 'soccer', country: 'Europe',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'uefa.europa',       sofascoreId: 679,  oddsportalPath: '/soccer/europe/europa-league/' },
  { id: 'uecl',         name: 'Conference League',    sport: 'soccer', country: 'Europe',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'uefa.europa.conf',  sofascoreId: 17015, oddsportalPath: '/soccer/europe/conference-league/' },
  // Americas
  { id: 'usa_mls',      name: 'MLS',                  sport: 'soccer', country: 'USA',         continent: 'Americas', tier: 1, espnSport: 'soccer', espnLeague: 'usa.1',           sofascoreId: 242,  oddsportalPath: '/soccer/usa/mls/',                        actionNetworkKey: 'mls' },
  { id: 'bra_sa',       name: 'Brasileirão Série A',  sport: 'soccer', country: 'Brazil',      continent: 'Americas', tier: 1, espnSport: 'soccer', espnLeague: 'bra.1',           sofascoreId: 325,  oddsportalPath: '/soccer/brazil/serie-a/' },
  { id: 'arg_pl',       name: 'Liga Profesional',     sport: 'soccer', country: 'Argentina',   continent: 'Americas', tier: 1, espnSport: 'soccer', espnLeague: 'arg.1',           sofascoreId: 155,  oddsportalPath: '/soccer/argentina/primera-division/' },
  // Asia / Middle East
  { id: 'jpn_j1',       name: 'J-League',             sport: 'soccer', country: 'Japan',       continent: 'Asia',   tier: 1,                                                        sofascoreId: 196,  oddsportalPath: '/soccer/japan/j-league/' },
  { id: 'chn_csl',      name: 'Chinese Super League', sport: 'soccer', country: 'China',       continent: 'Asia',   tier: 1,                                                        sofascoreId: 259,  oddsportalPath: '/soccer/china/super-league/' },
  { id: 'sau_spl',      name: 'Saudi Pro League',     sport: 'soccer', country: 'Saudi Arabia', continent: 'Asia',  tier: 1,                                                        sofascoreId: 955,  oddsportalPath: '/soccer/saudi-arabia/premier-league/' },
  // Africa
  { id: 'rsa_psl',      name: 'South African PSL',    sport: 'soccer', country: 'South Africa', continent: 'Africa', tier: 1,                                                       sofascoreId: 332,  oddsportalPath: '/soccer/south-africa/premier-division/' },
  // International
  { id: 'int_wc',       name: 'FIFA World Cup',       sport: 'soccer', country: 'World',       continent: 'World',  tier: 1, espnSport: 'soccer', espnLeague: 'fifa.world',        sofascoreId: 16,   oddsportalPath: '/soccer/world/world-cup/' },
  { id: 'int_ucnl',     name: 'UEFA Nations League',  sport: 'soccer', country: 'Europe',      continent: 'Europe', tier: 1, espnSport: 'soccer', espnLeague: 'uefa.nations',      sofascoreId: 1005, oddsportalPath: '/soccer/europe/nations-league/' },

  // ─── Basketball ─────────────────────────────────────────────────────────
  { id: 'nba',          name: 'NBA',                  sport: 'basketball', country: 'USA',      continent: 'Americas', tier: 1, espnSport: 'basketball', espnLeague: 'nba',          sofascoreId: 132,  oddsportalPath: '/basketball/usa/nba/',                    actionNetworkKey: 'nba', kambiPath: 'basketball/usa/nba' },
  { id: 'ncaab',        name: 'NCAA Basketball',      sport: 'basketball', country: 'USA',      continent: 'Americas', tier: 2, espnSport: 'basketball', espnLeague: 'mens-college-basketball', sofascoreId: 201, oddsportalPath: '/basketball/usa/ncaa/' },
  { id: 'euroleague',   name: 'EuroLeague',           sport: 'basketball', country: 'Europe',   continent: 'Europe',   tier: 1,                                                      sofascoreId: 94,   oddsportalPath: '/basketball/europe/euroleague/' },
  { id: 'nbl_au',       name: 'NBL',                  sport: 'basketball', country: 'Australia', continent: 'Oceania', tier: 1,                                                      sofascoreId: 187,  oddsportalPath: '/basketball/australia/nbl/' },

  // ─── Tennis ─────────────────────────────────────────────────────────────
  { id: 'atp',          name: 'ATP Tour',             sport: 'tennis', country: 'World',        continent: 'World',  tier: 1, espnSport: 'tennis', espnLeague: 'atp',               sofascoreId: 2,    oddsportalPath: '/tennis/atp-singles/' },
  { id: 'wta',          name: 'WTA Tour',             sport: 'tennis', country: 'World',        continent: 'World',  tier: 1, espnSport: 'tennis', espnLeague: 'wta',               sofascoreId: 3,    oddsportalPath: '/tennis/wta-singles/' },
  { id: 'wimbledon',    name: 'Wimbledon',            sport: 'tennis', country: 'UK',           continent: 'Europe', tier: 1, espnSport: 'tennis',                                  sofascoreId: 2,    oddsportalPath: '/tennis/united-kingdom/wimbledon/' },
  { id: 'aus_open',     name: 'Australian Open',      sport: 'tennis', country: 'Australia',    continent: 'Oceania', tier: 1, espnSport: 'tennis',                                  sofascoreId: 2 },
  { id: 'french_open',  name: 'French Open',          sport: 'tennis', country: 'France',       continent: 'Europe', tier: 1, espnSport: 'tennis' },
  { id: 'us_open_ten',  name: 'US Open Tennis',       sport: 'tennis', country: 'USA',          continent: 'Americas', tier: 1, espnSport: 'tennis' },

  // ─── Cricket ────────────────────────────────────────────────────────────
  { id: 'ipl',          name: 'IPL',                  sport: 'cricket', country: 'India',       continent: 'Asia',   tier: 1, espnSport: 'cricket',                                 sofascoreId: 12,   oddsportalPath: '/cricket/india/ipl/' },
  { id: 'bbl',          name: 'BBL',                  sport: 'cricket', country: 'Australia',   continent: 'Oceania', tier: 1,                                                       sofascoreId: 12,   oddsportalPath: '/cricket/australia/big-bash-league/' },
  { id: 'cpl',          name: 'CPL',                  sport: 'cricket', country: 'Caribbean',   continent: 'Americas', tier: 1,                                                                         oddsportalPath: '/cricket/west-indies/cpl/' },
  { id: 'ashes',        name: 'The Ashes',            sport: 'cricket', country: 'World',       continent: 'World',  tier: 1,                                                                           oddsportalPath: '/cricket/australia/ashes/' },
  { id: 'icc_wc',       name: 'ICC Cricket World Cup', sport: 'cricket', country: 'World',      continent: 'World',  tier: 1,                                                                           oddsportalPath: '/cricket/world/world-cup/' },

  // ─── American Football ──────────────────────────────────────────────────
  { id: 'nfl',          name: 'NFL',                  sport: 'american_football', country: 'USA', continent: 'Americas', tier: 1, espnSport: 'football', espnLeague: 'nfl',         sofascoreId: 63,   oddsportalPath: '/american-football/usa/nfl/',             actionNetworkKey: 'nfl', kambiPath: 'american-football/usa/nfl' },
  { id: 'ncaaf',        name: 'College Football',     sport: 'american_football', country: 'USA', continent: 'Americas', tier: 2, espnSport: 'football', espnLeague: 'college-football', sofascoreId: 65 },

  // ─── Ice Hockey ─────────────────────────────────────────────────────────
  { id: 'nhl',          name: 'NHL',                  sport: 'hockey', country: 'USA/Canada',   continent: 'Americas', tier: 1, espnSport: 'hockey', espnLeague: 'nhl',             sofascoreId: 33,   oddsportalPath: '/hockey/usa/nhl/',                        actionNetworkKey: 'nhl' },
  { id: 'khl',          name: 'KHL',                  sport: 'hockey', country: 'Russia',       continent: 'Europe',   tier: 1,                                                      sofascoreId: 42,   oddsportalPath: '/hockey/russia/khl/' },
  { id: 'shl',          name: 'SHL',                  sport: 'hockey', country: 'Sweden',       continent: 'Europe',   tier: 1,                                                      sofascoreId: 87,   oddsportalPath: '/hockey/sweden/shl/' },
  { id: 'iihf_wc',      name: 'IIHF World Championship', sport: 'hockey', country: 'World',    continent: 'World',    tier: 1,                                                                           oddsportalPath: '/hockey/world/world-championship/' },

  // ─── Baseball ───────────────────────────────────────────────────────────
  { id: 'mlb',          name: 'MLB',                  sport: 'baseball', country: 'USA',         continent: 'Americas', tier: 1, espnSport: 'baseball', espnLeague: 'mlb',          sofascoreId: 64,   oddsportalPath: '/baseball/usa/mlb/',                      actionNetworkKey: 'mlb' },
  { id: 'npb',          name: 'NPB',                  sport: 'baseball', country: 'Japan',        continent: 'Asia',    tier: 1,                                                      sofascoreId: 222,  oddsportalPath: '/baseball/japan/npb/' },

  // ─── Rugby ───────────────────────────────────────────────────────────────
  { id: 'six_nations',  name: 'Six Nations',          sport: 'rugby', country: 'Europe',         continent: 'Europe', tier: 1,                                                       sofascoreId: 77,   oddsportalPath: '/rugby-union/europe/six-nations/' },
  { id: 'premiership',  name: 'Premiership Rugby',    sport: 'rugby', country: 'England',        continent: 'Europe', tier: 1,                                                       sofascoreId: 72,   oddsportalPath: '/rugby-union/england/premiership/' },
  { id: 'super_rugby',  name: 'Super Rugby',          sport: 'rugby', country: 'Multi',          continent: 'Oceania', tier: 1,                                                      sofascoreId: 78,   oddsportalPath: '/rugby-union/world/super-rugby/' },
  { id: 'rwc',          name: 'Rugby World Cup',      sport: 'rugby', country: 'World',          continent: 'World',  tier: 1,                                                       sofascoreId: 82,   oddsportalPath: '/rugby-union/world/world-cup/' },
  { id: 'urc',          name: 'United Rugby Championship', sport: 'rugby', country: 'Multi',     continent: 'Europe', tier: 1,                                                       sofascoreId: 80,   oddsportalPath: '/rugby-union/europe/united-rugby-championship/' },

  // ─── MMA / Boxing ────────────────────────────────────────────────────────
  { id: 'ufc',          name: 'UFC',                  sport: 'mma', country: 'World',            continent: 'World',  tier: 1, espnSport: 'mma', espnLeague: 'ufc',                sofascoreId: 117,  oddsportalPath: '/mma/ufc/' },
  { id: 'boxing_wbc',   name: 'Boxing',               sport: 'mma', country: 'World',            continent: 'World',  tier: 1,                                                       sofascoreId: 76,   oddsportalPath: '/boxing/' },

  // ─── Golf ─────────────────────────────────────────────────────────────────
  { id: 'pga',          name: 'PGA Tour',             sport: 'mma', country: 'USA',              continent: 'Americas', tier: 1, espnSport: 'golf', espnLeague: 'pga',              sofascoreId: 19,   oddsportalPath: '/golf/usa/pga/' },
  { id: 'euro_tour',    name: 'DP World Tour',        sport: 'mma', country: 'Europe',           continent: 'Europe', tier: 1, espnSport: 'golf', espnLeague: 'euro',              sofascoreId: 19,   oddsportalPath: '/golf/europe/european-tour/' },

  // ─── AFL ─────────────────────────────────────────────────────────────────
  { id: 'afl',          name: 'AFL',                  sport: 'rugby', country: 'Australia',      continent: 'Oceania', tier: 1,                                                      sofascoreId: 180,  oddsportalPath: '/australian-football/australia/afl/' },
]

// ─── Action Network Book IDs ─────────────────────────────────────────────────
// Maps bookmaker keys to Action Network's internal bookmaker IDs
export const ACTION_NETWORK_BOOK_IDS: Record<string, number> = {
  draftkings:   15,
  fanduel:      30,
  betmgm:       76,
  caesars:      75,
  pointsbet:    123,
  barstool:     69,
  williamhill:  68,
  betrivers:    1001,
  wynnbet:      92,
  bet365:       972,
}

// ─── Kambi operators ─────────────────────────────────────────────────────────
// Kambi is the backend platform for many bookmakers
export const KAMBI_OPERATORS: Record<string, string> = {
  unibet:    'unibet',
  sport888:  '888sport',
  betsson:   'betsson',
  mrgreen:   'mr_green',
  nordicbet: 'nordicbet',
  betsafe:   'betsafe',
  betrivers: 'betrivers',   // BetRivers (Rush Street Interactive)
  pointsbet: 'pointsbet',   // PointsBet US
}
