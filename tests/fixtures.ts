/**
 * Shared test fixtures for OddsEdge.
 *
 * All odds are constructed to test specific scenarios:
 *  - ARB_EVENT:        genuine cross-bookmaker arbitrage (~2% profit)
 *  - NO_ARB_EVENT:     normal market, no arbitrage possible
 *  - SINGLE_BK_EVENT:  only one bookmaker — cannot arb
 *  - VALUE_EVENT:      one bookmaker offers odds above consensus fair value
 *  - STALE_ARB_EVENT:  "arb" wider than 15% — filtered as bad data
 */

import { Event, BookmakerOdds, Market, NewsArticle } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function h2h(home: number, draw: number, away: number): Market {
  return {
    key: 'h2h',
    label: 'Match Result',
    outcomes: [
      { name: 'Home', price: home },
      { name: 'Draw', price: draw },
      { name: 'Away', price: away },
    ],
  }
}

export function h2h2(home: number, away: number): Market {
  return {
    key: 'h2h',
    label: 'Match Result',
    outcomes: [
      { name: 'Home', price: home },
      { name: 'Away', price: away },
    ],
  }
}

export function bk(key: string, title: string, ...markets: Market[]): BookmakerOdds {
  return { key, title, lastUpdate: new Date().toISOString(), markets }
}

function futureTime(offsetMs = 3_600_000): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

function pastTime(offsetMs = 3_600_000): string {
  return new Date(Date.now() - offsetMs).toISOString()
}

// ── Events ───────────────────────────────────────────────────────────────────

/**
 * Real arbitrage: BookA generous on Home, BookB generous on Away.
 * totalImplied ≈ 0.98 → ~2% profit
 */
export const ARB_EVENT: Event = {
  id: 'test_arb_1',
  sport: 'soccer',
  sportTitle: 'Soccer',
  league: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  commenceTime: futureTime(7_200_000),
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h(2.80, 3.40, 2.60)),  // generous on Home
    bk('bookB', 'Book B', h2h(2.55, 3.30, 2.95)),  // generous on Away
    // totalImplied with best (2.80 home, 3.40 draw, 2.95 away) =
    // 1/2.80 + 1/3.40 + 1/2.95 ≈ 0.357 + 0.294 + 0.339 ≈ 0.990 → arb!
  ],
}

/**
 * No arbitrage: both books have overlapping margin — sum > 1.
 */
export const NO_ARB_EVENT: Event = {
  id: 'test_no_arb',
  sport: 'soccer',
  sportTitle: 'Soccer',
  league: 'La Liga',
  homeTeam: 'Real Madrid',
  awayTeam: 'Barcelona',
  commenceTime: futureTime(10_800_000),
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h(2.00, 3.20, 3.50)),
    bk('bookB', 'Book B', h2h(1.95, 3.10, 3.40)),
    // best: 2.00 / 3.20 / 3.50 → 0.500 + 0.313 + 0.286 = 1.099 → no arb
  ],
}

/**
 * Only one bookmaker — cannot constitute an arbitrage.
 */
export const SINGLE_BK_EVENT: Event = {
  id: 'test_single_bk',
  sport: 'basketball',
  sportTitle: 'Basketball',
  league: 'NBA',
  homeTeam: 'Lakers',
  awayTeam: 'Celtics',
  commenceTime: futureTime(5_400_000),
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h2(1.90, 1.90)),
  ],
}

/**
 * Past event — should be excluded from arb scanning.
 */
export const PAST_EVENT: Event = {
  id: 'test_past',
  sport: 'soccer',
  sportTitle: 'Soccer',
  league: 'Bundesliga',
  homeTeam: 'Bayern',
  awayTeam: 'Dortmund',
  commenceTime: pastTime(7_200_000),  // 2 hours ago
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h(1.40, 4.50, 8.00)),
    bk('bookB', 'Book B', h2h(1.38, 4.40, 8.50)),
  ],
}

/**
 * Stale arb: artificially wide spread → profit > 15% → filtered as bad data.
 * totalImplied ≈ 0.80 (way below sanity floor of 0.87).
 */
export const STALE_ARB_EVENT: Event = {
  id: 'test_stale_arb',
  sport: 'tennis',
  sportTitle: 'Tennis',
  league: 'ATP',
  homeTeam: 'Player A',
  awayTeam: 'Player B',
  commenceTime: futureTime(3_600_000),
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h2(4.00, 1.30)),
    bk('bookB', 'Book B', h2h2(1.30, 4.00)),
    // best: 4.00 home + 4.00 away → 0.25 + 0.25 = 0.50 → filtered (< 0.87)
  ],
}

/**
 * Value bet event: Book B is generous on Home vs consensus (Books A+C agree).
 */
export const VALUE_EVENT: Event = {
  id: 'test_value',
  sport: 'soccer',
  sportTitle: 'Soccer',
  league: 'Serie A',
  homeTeam: 'Juventus',
  awayTeam: 'Milan',
  commenceTime: futureTime(14_400_000),
  isLive: false,
  bookmakers: [
    bk('bookA', 'Book A', h2h(2.00, 3.40, 3.60)),
    bk('bookB', 'Book B', h2h(2.40, 3.30, 3.50)),  // Book B generous on Home (2.40 vs ~2.00 consensus)
    bk('bookC', 'Book C', h2h(2.00, 3.30, 3.60)),
  ],
}

// ── News Articles ─────────────────────────────────────────────────────────────

export function makeArticle(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: 'test_article_1',
    title: 'Generic sports headline',
    summary: 'A match happened somewhere.',
    url: 'https://example.com/article',
    source: 'BBC Sport',
    publishedAt: new Date().toISOString(),
    ...overrides,
  }
}

export const INJURY_ARTICLE = makeArticle({
  id: 'art_injury',
  title: 'Star striker ruled out for six weeks with hamstring injury',
  summary: 'The club confirmed the player is sidelined after sustaining the injury in training.',
})

export const SUSPENSION_ARTICLE = makeArticle({
  id: 'art_suspension',
  title: 'Captain suspended for three matches after red card',
  summary: 'The disciplinary panel handed down a three-game ban.',
})

export const TRANSFER_ARTICLE = makeArticle({
  id: 'art_transfer',
  title: 'Club announces record-breaking signing from rivals',
  summary: 'The player joins on a five-year contract with fee agreed at £85m.',
})

export const MANAGER_ARTICLE = makeArticle({
  id: 'art_manager',
  title: 'Manager sacked after worst run of form in club history',
  summary: 'The club has appointed a new head coach with immediate effect.',
})

export const TEAM_NEWS_ARTICLE = makeArticle({
  id: 'art_team_news',
  title: 'Confirmed lineup ahead of crunch top-four clash',
  summary: 'The starting XI has been named ahead of the match.',
})

export const GENERIC_ARTICLE = makeArticle({
  id: 'art_generic',
  title: 'Post-match reaction: manager pleased with performance',
  summary: 'The manager gave a positive assessment after the final whistle.',
})

export const RESULT_ARTICLE = makeArticle({
  id: 'art_result',
  title: 'City beats United 3-1 in thrilling derby',
  summary: 'Final score: Manchester City 3-1 Manchester United.',
})

export const ODDS_ARTICLE = makeArticle({
  id: 'art_odds',
  title: 'Bookmakers slash odds on title favourite after injury news',
  summary: 'Betting markets have reacted sharply to the news.',
})
