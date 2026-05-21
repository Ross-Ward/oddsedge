/**
 * Demo / fallback events — shown when all scrapers fail (dev environment,
 * blocked requests, etc.).
 *
 * ALL odds are mathematically verified:
 *  • Every bookmaker's sum of implied probs (Σ 1/odds) > 1.0 — they make a profit.
 *  • Four events intentionally have cross-bookmaker arbs (0.7 – 2.5% profit).
 *  • No "fake" arbs: no single bookmaker's market sums to < 1.
 *  • Arb sizes are all within the sanity cap (totalImplied > 0.87).
 *
 * How arbs are created honestly:
 *   Bookmaker A is generous on the Home outcome (lower margin on Home).
 *   Bookmaker B is generous on the Away outcome (lower margin on Away).
 *   Neither book individually offers a free lunch; the arbitrage exists only
 *   by combining the best price from each.
 */

import { Event, BookmakerOdds, Market, Sport } from './types'

const NOW = new Date()
const UPDATED = NOW.toISOString()

// ── helpers ──────────────────────────────────────────────────────────────────

function ts(offsetMinutes: number): string {
  return new Date(NOW.getTime() + offsetMinutes * 60_000).toISOString()
}

function mkt2(home: number, away: number): Market {
  return {
    key: 'h2h',
    label: 'Match Result',
    outcomes: [
      { name: 'home', price: home },
      { name: 'away', price: away },
    ],
  }
}

function mkt3(home: number, draw: number, away: number): Market {
  return {
    key: 'h2h',
    label: 'Match Result',
    outcomes: [
      { name: 'home', price: home },
      { name: 'draw', price: draw },
      { name: 'away', price: away },
    ],
  }
}

function bk(
  key: string,
  title: string,
  ...markets: Market[]
): BookmakerOdds {
  return { key, title, lastUpdate: UPDATED, markets }
}

function ev(
  id: string,
  sport: Sport,
  sportTitle: string,
  league: string,
  homeTeam: string,
  awayTeam: string,
  offsetMins: number,
  bookmakers: BookmakerOdds[],
  isLive = false,
): Event {
  return {
    id: `demo_${id}`,
    sport,
    sportTitle,
    league,
    homeTeam,
    awayTeam,
    commenceTime: ts(offsetMins),
    isLive,
    bookmakers,
  }
}

// ── ARB EVENT 1 ───────────────────────────────────────────────────────────────
// NFL: Kansas City Chiefs vs Cincinnati Bengals
// True home prob ≈ 0.62 (Chiefs heavy favourite)
//
// FanDuel  — generous on Home (bias −0.03, margin 4%)
//   adjHome=0.59 → homeOdds=1/(0.59×1.04)=1.63  awayOdds=1/(0.41×1.04)=2.35
//   Sum: 1/1.63+1/2.35 = 0.6135+0.4255 = 1.039 ✓
//
// Caesars  — generous on Away (bias +0.03, margin 4%)
//   adjHome=0.65 → homeOdds=1/(0.65×1.04)=1.48  awayOdds=1/(0.35×1.04)=2.75
//   Sum: 1/1.48+1/2.75 = 0.6757+0.3636 = 1.039 ✓
//
// ARB: best Home=FanDuel 1.63, best Away=Caesars 2.75
//   Total: 0.6135+0.3636 = 0.9771 → profit 2.35% ✓

const nflChiefsBengals = ev(
  'nfl_kc_cin',
  'american_football',
  'NFL',
  '🏈 NFL',
  'Kansas City Chiefs',
  'Cincinnati Bengals',
  90,
  [
    bk('fanduel',    'FanDuel',    mkt2(1.63, 2.35)),   // arb source (Home)
    bk('caesars',    'Caesars',    mkt2(1.48, 2.75)),   // arb source (Away)
    bk('draftkings', 'DraftKings', mkt2(1.55, 2.53)),
    bk('betmgm',     'BetMGM',     mkt2(1.51, 2.57)),
    bk('bwin',       'bwin',       mkt2(1.56, 2.44)),
  ],
)

// ── ARB EVENT 2 ───────────────────────────────────────────────────────────────
// NBA: Los Angeles Lakers vs Boston Celtics
// True home prob ≈ 0.52 (close match)
//
// BetMGM  — generous on Home (bias −0.03, margin 4%)
//   adjHome=0.49 → homeOdds=1/(0.49×1.04)=1.96  awayOdds=1/(0.51×1.04)=1.89
//   Sum: 1/1.96+1/1.89 = 0.5102+0.5291 = 1.039 ✓
//
// Betway  — generous on Away (bias +0.03, margin 4%)
//   adjHome=0.55 → homeOdds=1/(0.55×1.04)=1.75  awayOdds=1/(0.45×1.04)=2.14
//   Sum: 1/1.75+1/2.14 = 0.5714+0.4673 = 1.039 ✓
//
// ARB: best Home=BetMGM 1.96, best Away=Betway 2.14
//   Total: 0.5102+0.4673 = 0.9775 → profit 2.30% ✓

const nbaLakersceltics = ev(
  'nba_lal_bos',
  'basketball',
  'NBA',
  '🏀 NBA',
  'Los Angeles Lakers',
  'Boston Celtics',
  150,
  [
    bk('betmgm',     'BetMGM',     mkt2(1.96, 1.89)),   // arb source (Home)
    bk('betway',     'Betway',     mkt2(1.75, 2.14)),   // arb source (Away)
    bk('draftkings', 'DraftKings', mkt2(1.85, 2.00)),
    bk('fanduel',    'FanDuel',    mkt2(1.80, 2.03)),
    bk('caesars',    'Caesars',    mkt2(1.87, 1.94)),
  ],
)

// ── ARB EVENT 3 ───────────────────────────────────────────────────────────────
// La Liga: Real Madrid vs FC Barcelona (El Clásico)
// True probs: RM 0.45, Draw 0.27, Barca 0.28
//
// Betway — generous on Home (RM)
//   RM 2.35, Draw 3.40, Barca 3.25
//   Sum: 0.4255+0.2941+0.3077 = 1.027 ✓
//
// Pinnacle (sharp) — low margin across all outcomes
//   RM 2.25, Draw 3.55, Barca 3.50
//   Sum: 0.4444+0.2817+0.2857 = 1.012 ✓
//
// Unibet — generous on Draw
//   RM 2.20, Draw 3.60, Barca 3.40
//   Sum: 0.4545+0.2778+0.2941 = 1.026 ✓
//
// ARB: best RM=Betway 2.35, best Draw=Unibet 3.60, best Barca=Pinnacle 3.50
//   Total: 0.4255+0.2778+0.2857 = 0.9890 → profit 1.11% ✓

const laligaClasico = ev(
  'laliga_rm_barca',
  'soccer',
  'La Liga',
  '⚽ La Liga',
  'Real Madrid',
  'FC Barcelona',
  210,
  [
    bk('betway',    'Betway',       mkt3(2.35, 3.40, 3.25)),  // arb source (RM)
    bk('unibet',    'Unibet',       mkt3(2.20, 3.60, 3.40)),  // arb source (Draw)
    bk('pinnacle',  'Pinnacle',     mkt3(2.25, 3.55, 3.50)),  // arb source (Barca)
    bk('bwin',      'bwin',         mkt3(2.10, 3.50, 3.30)),
    bk('williamhill','William Hill', mkt3(2.12, 3.45, 3.35)),
  ],
)

// ── ARB EVENT 4 ───────────────────────────────────────────────────────────────
// ATP Tennis: Novak Djokovic vs Carlos Alcaraz (Wimbledon SF)
// True probs: Djokovic 0.50, Alcaraz 0.50 (pick-em)
//
// bwin  — generous on Djokovic (Home, bias −0.03, margin 4%)
//   adjHome=0.47 → homeOdds=1/(0.47×1.04)=2.05  awayOdds=1/(0.53×1.04)=1.81
//   Sum: 0.4878+0.5525 = 1.040 ✓
//
// Bet365 — generous on Alcaraz (Away, bias +0.03, margin 4%)
//   adjHome=0.53 → homeOdds=1/(0.53×1.04)=1.81  awayOdds=1/(0.47×1.04)=2.05
//   Sum: 0.5525+0.4878 = 1.040 ✓
//
// ARB: best Djokovic=bwin 2.05, best Alcaraz=Bet365 2.05
//   Total: 0.4878+0.4878 = 0.9756 → profit 2.50% ✓

const atpDjokovicAlcaraz = ev(
  'tennis_djok_alc',
  'tennis',
  'Tennis',
  '🎾 ATP Tour',
  'Novak Djokovic',
  'Carlos Alcaraz',
  270,
  [
    bk('bwin',       'bwin',       mkt2(2.05, 1.81)),   // arb source (Djokovic)
    bk('bet365',     'Bet365',     mkt2(1.81, 2.05)),   // arb source (Alcaraz)
    bk('unibet',     'Unibet',     mkt2(1.92, 1.92)),
    bk('paddypower', 'Paddy Power',mkt2(1.94, 1.87)),
    bk('betfair',    'Betfair',    mkt2(1.89, 1.96)),
  ],
)

// ── NON-ARB EVENTS (16) ───────────────────────────────────────────────────────
// For each event, best-odds-combination across all bookmakers sums to > 1.0.
// Verified inline.

// 5. NFL: Dallas Cowboys vs Philadelphia Eagles
// Best combo: home BetMGM 2.02, away FanDuel 1.87 → 0.4950+0.5348 = 1.030 ✓
const nflCowboysEagles = ev(
  'nfl_dal_phi',
  'american_football',
  'NFL',
  '🏈 NFL',
  'Dallas Cowboys',
  'Philadelphia Eagles',
  -30,
  [
    bk('draftkings', 'DraftKings', mkt2(1.98, 1.83)),
    bk('fanduel',    'FanDuel',    mkt2(1.94, 1.87)),
    bk('betmgm',     'BetMGM',     mkt2(2.02, 1.80)),
    bk('caesars',    'Caesars',    mkt2(1.92, 1.85)),
    bk('betway',     'Betway',     mkt2(2.00, 1.78)),
  ],
)

// 6. NBA: Golden State Warriors vs Phoenix Suns
// Best combo: home BetMGM 1.63, away FanDuel 2.47 → 0.6135+0.4049 = 1.018 ✓
const nbaWarriorsSuns = ev(
  'nba_gsw_phx',
  'basketball',
  'NBA',
  '🏀 NBA',
  'Golden State Warriors',
  'Phoenix Suns',
  60,
  [
    bk('draftkings', 'DraftKings', mkt2(1.60, 2.40)),
    bk('fanduel',    'FanDuel',    mkt2(1.58, 2.47)),
    bk('betmgm',     'BetMGM',     mkt2(1.63, 2.34)),
    bk('caesars',    'Caesars',    mkt2(1.56, 2.44)),
    bk('bwin',       'bwin',       mkt2(1.61, 2.32)),
  ],
)

// 7. MLB: New York Yankees vs Boston Red Sox
// Best combo: home BetMGM 1.76, away FanDuel 2.17 → 0.5682+0.4608 = 1.029 ✓
const mlbYankeesRedSox = ev(
  'mlb_nyy_bos',
  'baseball',
  'MLB',
  '⚾ MLB',
  'New York Yankees',
  'Boston Red Sox',
  120,
  [
    bk('draftkings', 'DraftKings', mkt2(1.73, 2.12)),
    bk('fanduel',    'FanDuel',    mkt2(1.70, 2.17)),
    bk('betmgm',     'BetMGM',     mkt2(1.76, 2.07)),
    bk('caesars',    'Caesars',    mkt2(1.72, 2.10)),
    bk('betway',     'Betway',     mkt2(1.69, 2.14)),
  ],
)

// 8. NHL: Toronto Maple Leafs vs Montreal Canadiens
// Best combo: home BetMGM 1.67, away FanDuel 2.32 → 0.5988+0.4310 = 1.030 ✓
const nhlLeafsCandiens = ev(
  'nhl_tor_mtl',
  'hockey',
  'NHL',
  '🏒 NHL',
  'Toronto Maple Leafs',
  'Montreal Canadiens',
  180,
  [
    bk('draftkings', 'DraftKings', mkt2(1.64, 2.27)),
    bk('fanduel',    'FanDuel',    mkt2(1.61, 2.32)),
    bk('betmgm',     'BetMGM',     mkt2(1.67, 2.22)),
    bk('caesars',    'Caesars',    mkt2(1.63, 2.25)),
  ],
)

// 9. Premier League: Arsenal vs Chelsea
// Best combo: Arsenal Bet365 2.20, Draw PaddyPower 3.35, Chelsea SkyBet 3.45
//   Total: 0.4545+0.2985+0.2899 = 1.043 ✓
const plArsenalChelsea = ev(
  'pl_ars_che',
  'soccer',
  'Premier League',
  '⚽ Premier League',
  'Arsenal',
  'Chelsea',
  -60,
  [
    bk('bwin',       'bwin',        mkt3(2.15, 3.25, 3.40)),
    bk('bet365',     'Bet365',      mkt3(2.20, 3.30, 3.35)),
    bk('skybet',     'Sky Bet',     mkt3(2.10, 3.20, 3.45)),
    bk('paddypower', 'Paddy Power', mkt3(2.18, 3.35, 3.30)),
    bk('williamhill','William Hill', mkt3(2.15, 3.10, 3.40)),
  ],
)

// 10. Bundesliga: Bayern Munich vs Borussia Dortmund
// Best combo: all from Betway — 1/1.65+1/4.30+1/5.50 = 0.606+0.233+0.182 = 1.021 ✓
const bundesBayernDortmund = ev(
  'bund_bay_dor',
  'soccer',
  'Bundesliga',
  '⚽ Bundesliga',
  'Bayern Munich',
  'Borussia Dortmund',
  300,
  [
    bk('bwin',       'bwin',       mkt3(1.60, 4.10, 5.10)),
    bk('unibet',     'Unibet',     mkt3(1.62, 4.20, 5.25)),
    bk('paddypower', 'Paddy Power',mkt3(1.58, 4.00, 5.20)),
    bk('betway',     'Betway',     mkt3(1.65, 4.30, 5.50)),
    bk('williamhill','William Hill',mkt3(1.60, 4.05, 5.00)),
  ],
)

// 11. Serie A: Inter Milan vs AC Milan (Derby della Madonnina)
// Best combo: Inter Betway 2.35, Draw Betway 3.35, Milan Unibet 3.00
//   Total: 0.4255+0.2985+0.3333 = 1.057 ✓
const serieADerby = ev(
  'seriea_int_mil',
  'soccer',
  'Serie A',
  '⚽ Serie A',
  'Inter Milan',
  'AC Milan',
  360,
  [
    bk('bwin',     'bwin',    mkt3(2.25, 3.25, 3.10)),
    bk('unibet',   'Unibet',  mkt3(2.30, 3.30, 3.00)),
    bk('paddypower','Paddy Power', mkt3(2.28, 3.20, 3.05)),
    bk('betway',   'Betway',  mkt3(2.35, 3.35, 3.15)),
    bk('pinnacle', 'Pinnacle',mkt3(2.33, 3.28, 3.12)),
  ],
)

// 12. Ligue 1: Paris Saint-Germain vs Olympique Marseille
// Best combo: PSG PaddyPower 1.75, Draw PaddyPower 3.75, Marseille PaddyPower 5.00
//   Total: 0.5714+0.2667+0.2000 = 1.038 ✓
const ligue1PSGMarseille = ev(
  'l1_psg_om',
  'soccer',
  'Ligue 1',
  '⚽ Ligue 1',
  'Paris Saint-Germain',
  'Olympique Marseille',
  420,
  [
    bk('bwin',       'bwin',        mkt3(1.72, 3.65, 4.85)),
    bk('bet365',     'Bet365',      mkt3(1.75, 3.70, 4.90)),
    bk('skybet',     'Sky Bet',     mkt3(1.70, 3.60, 4.80)),
    bk('paddypower', 'Paddy Power', mkt3(1.73, 3.75, 5.00)),
    bk('williamhill','William Hill', mkt3(1.71, 3.55, 4.75)),
  ],
)

// 13. Premier League: Liverpool vs Manchester United
// Best combo: Liverpool Bet365 1.92, Draw PaddyPower 3.70, ManUtd PaddyPower 4.60
//   Total: 0.5208+0.2703+0.2174 = 1.009 ✓
const plLiverpoolManUtd = ev(
  'pl_liv_mun',
  'soccer',
  'Premier League',
  '⚽ Premier League',
  'Liverpool',
  'Manchester United',
  480,
  [
    bk('bwin',       'bwin',        mkt3(1.90, 3.60, 4.50)),
    bk('bet365',     'Bet365',      mkt3(1.92, 3.65, 4.55)),
    bk('skybet',     'Sky Bet',     mkt3(1.88, 3.55, 4.40)),
    bk('paddypower', 'Paddy Power', mkt3(1.91, 3.70, 4.60)),
    bk('williamhill','William Hill', mkt3(1.89, 3.58, 4.42)),
  ],
)

// 14. Champions League: Real Madrid vs Manchester City
// Best combo: RM Pinnacle 2.15, Draw Pinnacle 3.50, ManCity Betway 3.45
//   Total: 0.4651+0.2857+0.2899 = 1.041 ✓
const uclRealManCity = ev(
  'ucl_rm_mci',
  'soccer',
  'UEFA Champions League',
  '⚽ Champions League',
  'Real Madrid',
  'Manchester City',
  540,
  [
    bk('bwin',      'bwin',    mkt3(2.08, 3.40, 3.35)),
    bk('unibet',    'Unibet',  mkt3(2.12, 3.45, 3.30)),
    bk('paddypower','Paddy Power', mkt3(2.10, 3.35, 3.40)),
    bk('betway',    'Betway',  mkt3(2.05, 3.40, 3.45)),
    bk('pinnacle',  'Pinnacle',mkt3(2.15, 3.50, 3.42)),
  ],
)

// 15. MLS: Atlanta United vs LA Galaxy
// Best combo: Atlanta Caesars 2.68, Draw Caesars 3.20, Galaxy BetMGM 2.85
//   Total: 0.3731+0.3125+0.3509 = 1.037 ✓
const mlsAtlantaGalaxy = ev(
  'mls_atl_la',
  'soccer',
  'MLS',
  '⚽ MLS',
  'Atlanta United',
  'LA Galaxy',
  600,
  [
    bk('draftkings', 'DraftKings', mkt3(2.62, 3.10, 2.80)),
    bk('fanduel',    'FanDuel',    mkt3(2.65, 3.15, 2.75)),
    bk('betmgm',     'BetMGM',     mkt3(2.60, 3.05, 2.85)),
    bk('caesars',    'Caesars',    mkt3(2.68, 3.20, 2.78)),
  ],
)

// 16. UFC: Leon Edwards vs Kamaru Usman (Welterweight Title)
// Best combo: Edwards BetMGM 1.67, Usman FanDuel 2.32 → 0.5988+0.4310 = 1.030 ✓
const ufcEdwardsUsman = ev(
  'ufc_edw_usm',
  'mma',
  'MMA / UFC',
  '🥊 UFC',
  'Leon Edwards',
  'Kamaru Usman',
  660,
  [
    bk('draftkings', 'DraftKings', mkt2(1.64, 2.27)),
    bk('fanduel',    'FanDuel',    mkt2(1.61, 2.32)),
    bk('betmgm',     'BetMGM',     mkt2(1.67, 2.22)),
    bk('caesars',    'Caesars',    mkt2(1.63, 2.25)),
    bk('betway',     'Betway',     mkt2(1.60, 2.30)),
  ],
)

// 17. Cricket T20: India vs Australia
// Best combo: India bwin 1.76, Australia Betway 2.17 → 0.5682+0.4608 = 1.029 ✓
const cricketIndiaAustralia = ev(
  'cricket_ind_aus',
  'cricket',
  'Cricket',
  '🏏 T20 International',
  'India',
  'Australia',
  720,
  [
    bk('draftkings', 'DraftKings', mkt2(1.73, 2.12)),
    bk('betway',     'Betway',     mkt2(1.70, 2.17)),
    bk('bwin',       'bwin',       mkt2(1.76, 2.07)),
    bk('unibet',     'Unibet',     mkt2(1.72, 2.10)),
  ],
)

// 18. Rugby: England vs Ireland (Six Nations)
// Best combo: England PaddyPower 2.02, Ireland Betway 1.87 → 0.4950+0.5348 = 1.030 ✓
const rugbyEnglandIreland = ev(
  'rugby_eng_ire',
  'rugby',
  'Rugby',
  '🏉 Six Nations',
  'England',
  'Ireland',
  780,
  [
    bk('bwin',       'bwin',        mkt2(1.98, 1.83)),
    bk('betway',     'Betway',      mkt2(1.94, 1.87)),
    bk('paddypower', 'Paddy Power', mkt2(2.02, 1.80)),
    bk('williamhill','William Hill', mkt2(1.92, 1.85)),
  ],
)

// 19. Wimbledon: Carlos Alcaraz vs Jannik Sinner (Men's Final)
// Best combo: Alcaraz Unibet 1.89, Sinner Betfair 2.05 → 0.5291+0.4878 = 1.017 ✓
const wimbledonFinal = ev(
  'tennis_alc_sin',
  'tennis',
  'Tennis',
  '🎾 Wimbledon',
  'Carlos Alcaraz',
  'Jannik Sinner',
  840,
  [
    bk('draftkings', 'DraftKings', mkt2(1.92, 2.00)),
    bk('fanduel',    'FanDuel',    mkt2(1.89, 2.04)),
    bk('unibet',     'Unibet',     mkt2(1.89, 1.96)),
    bk('betfair',    'Betfair',    mkt2(1.81, 2.05)),
  ],
)

// 20. La Liga: Atletico Madrid vs Sevilla
// Best combo: Atletico Betway 2.02, Draw Betway 3.50, Sevilla Betway 4.25
//   All from Betway → 1/2.02+1/3.50+1/4.25 = 0.4950+0.2857+0.2353 = 1.016 ✓
const laligaAtleticoSevilla = ev(
  'laliga_atl_sev',
  'soccer',
  'La Liga',
  '⚽ La Liga',
  'Atletico Madrid',
  'Sevilla',
  900,
  [
    bk('bwin',     'bwin',    mkt3(1.95, 3.35, 4.10)),
    bk('bet365',   'Bet365',  mkt3(1.98, 3.40, 4.15)),
    bk('unibet',   'Unibet',  mkt3(2.00, 3.45, 4.20)),
    bk('paddypower','Paddy Power', mkt3(1.96, 3.30, 4.05)),
    bk('betway',   'Betway',  mkt3(2.02, 3.50, 4.25)),
  ],
)

// ── LIVE events (2) ───────────────────────────────────────────────────────────

// Live NFL — Chiefs vs Bengals simulacrum (different matchup, already in progress)
const livePLManCityTottenham = ev(
  'live_mci_tot',
  'soccer',
  'Premier League',
  '⚽ Premier League',
  'Manchester City',
  'Tottenham Hotspur',
  0,
  [
    bk('bet365',     'Bet365',      mkt3(1.55, 4.00, 6.50)),
    bk('bwin',       'bwin',        mkt3(1.53, 3.90, 6.40)),
    bk('williamhill','William Hill', mkt3(1.57, 4.05, 6.60)),
    bk('betway',     'Betway',      mkt3(1.55, 4.00, 6.50)),
  ],
  true, // isLive
)

const liveNbaHeatBucks = ev(
  'live_mia_mil',
  'basketball',
  'NBA',
  '🏀 NBA',
  'Miami Heat',
  'Milwaukee Bucks',
  0,
  [
    bk('draftkings', 'DraftKings', mkt2(2.10, 1.76)),
    bk('fanduel',    'FanDuel',    mkt2(2.12, 1.74)),
    bk('betmgm',     'BetMGM',     mkt2(2.08, 1.77)),
    bk('caesars',    'Caesars',    mkt2(2.14, 1.73)),
  ],
  true, // isLive
)

// ── Export ────────────────────────────────────────────────────────────────────

export const DEMO_EVENTS: Event[] = [
  // ARB events first (they're the most interesting)
  nflChiefsBengals,
  nbaLakersceltics,
  laligaClasico,
  atpDjokovicAlcaraz,
  // Live events
  livePLManCityTottenham,
  liveNbaHeatBucks,
  // Upcoming events
  nflCowboysEagles,
  nbaWarriorsSuns,
  mlbYankeesRedSox,
  nhlLeafsCandiens,
  plArsenalChelsea,
  bundesBayernDortmund,
  serieADerby,
  ligue1PSGMarseille,
  plLiverpoolManUtd,
  uclRealManCity,
  mlsAtlantaGalaxy,
  ufcEdwardsUsman,
  cricketIndiaAustralia,
  rugbyEnglandIreland,
  wimbledonFinal,
  laligaAtleticoSevilla,
]
