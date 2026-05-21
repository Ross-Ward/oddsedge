/**
 * Main scraper orchestrator — 28 independent scrapers.
 * Runs all scrapers concurrently, deduplicates events, merges bookmaker odds.
 *
 * Each scraper returns Event[] — events with bookmaker odds attached.
 * We merge events that represent the same match (by normalised team names).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SCRAPER CATALOGUE (28 total)                                           │
 * │                                                                         │
 * │  Data Aggregators:  Sofascore · Action Network · OddsPortal             │
 * │  UK:        Betfair · William Hill · Sky Bet · Paddy Power · Coral      │
 * │             Ladbrokes · BetVictor · Betfred                             │
 * │  EU:        Kambi platform · Pinnacle · bwin · Betway · Unibet          │
 * │             Marathonbet                                                  │
 * │  US:        DraftKings · FanDuel · BetMGM · Caesars · Bovada           │
 * │  AU/NZ:     Sportsbet AU · TAB AU · Ladbrokes AU                       │
 * │  Racing:    Horse Racing (Betway · Betfair · TAB AU)                   │
 * │  Esports:   Betway Esports · Kambi Esports (Betsson · Unibet)          │
 * │  Prediction: Kalshi · Polymarket                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { Event, BookmakerOdds } from '../types'
import { withTimeout } from './utils'
// ── Data aggregators ────────────────────────────────────────────────────────
import { getSofascoreEvents }    from './sofascore'
import { getActionNetworkEvents } from './action-network'
import { getOddsPortalEvents }   from './oddsportal'
// ── UK bookmakers ───────────────────────────────────────────────────────────
import { getBetfairEvents }      from './betfair'
import { getWilliamHillEvents }  from './william-hill'
import { getSkyBetEvents }       from './skybet'
import { getPaddyPowerEvents }   from './paddy-power'
import { getCoralEvents }        from './coral'
import { getLadbrokesEvents }    from './ladbrokes'
import { getBetVictorEvents }    from './betvictor'
import { getBetfredEvents }      from './betfred'
// ── European bookmakers ─────────────────────────────────────────────────────
import { getKambiEvents }        from './kambi'
import { getPinnacleEvents }     from './pinnacle'
import { getBwinEvents }         from './bwin'
import { getBetwayEvents }       from './betway'
import { getUnibetEvents }       from './unibet'
import { getMarathonbetEvents }  from './marathonbet'
// ── US bookmakers ───────────────────────────────────────────────────────────
import { getDraftKingsEvents }   from './draftkings'
import { getFanDuelEvents }      from './fanduel'
import { getBetMGMEvents }       from './betmgm'
import { getCaesarsEvents }      from './caesars'
// ── Australian bookmakers ───────────────────────────────────────────────────
import { getSportsbetAUEvents }  from './sportsbet-au'
import { getTABAUEvents }        from './tab-au'
import { getLadbrokesAUEvents }  from './ladbrokes-au'
// ── Racing ──────────────────────────────────────────────────────────────────
import { getHorseRacingEvents }  from './horse-racing'
// ── Esports ─────────────────────────────────────────────────────────────────
import { getEsportsEvents }      from './esports'
// ── Crypto / offshore ───────────────────────────────────────────────────────
import { getBovadaEvents }       from './bovada'
// ── Prediction markets ──────────────────────────────────────────────────────
import { getKalshiEvents }       from './kalshi'
import { getPolymarketEvents }   from './polymarket'
import { cacheGet, cacheSet }    from '../cache'

export interface ScraperResult {
  source: string
  status: 'ok' | 'error' | 'timeout'
  eventCount: number
  durationMs: number
  error?: string
}

interface ScraperRun {
  name: string
  fn: () => Promise<Event[]>
  timeoutMs: number
}

const SCRAPERS: ScraperRun[] = [
  // ── Data aggregators (event sources) ──────────────────────────────────────
  { name: 'sofascore',      fn: getSofascoreEvents,      timeoutMs: 20_000 },
  { name: 'action-network', fn: getActionNetworkEvents,  timeoutMs: 20_000 },
  { name: 'oddsportal',     fn: getOddsPortalEvents,     timeoutMs: 60_000 },
  // ── UK bookmakers ─────────────────────────────────────────────────────────
  { name: 'betfair',        fn: getBetfairEvents,        timeoutMs: 20_000 },
  { name: 'william-hill',   fn: getWilliamHillEvents,    timeoutMs: 20_000 },
  { name: 'skybet',         fn: getSkyBetEvents,         timeoutMs: 20_000 },
  { name: 'paddy-power',    fn: getPaddyPowerEvents,     timeoutMs: 20_000 },
  { name: 'coral',          fn: getCoralEvents,          timeoutMs: 20_000 },
  { name: 'ladbrokes',      fn: getLadbrokesEvents,      timeoutMs: 20_000 },
  { name: 'betvictor',      fn: getBetVictorEvents,      timeoutMs: 20_000 },
  { name: 'betfred',        fn: getBetfredEvents,        timeoutMs: 20_000 },
  // ── EU bookmakers ─────────────────────────────────────────────────────────
  { name: 'kambi',          fn: getKambiEvents,          timeoutMs: 30_000 },
  { name: 'pinnacle',       fn: getPinnacleEvents,       timeoutMs: 25_000 },
  { name: 'bwin',           fn: getBwinEvents,           timeoutMs: 20_000 },
  { name: 'betway',         fn: getBetwayEvents,         timeoutMs: 20_000 },
  { name: 'unibet',         fn: getUnibetEvents,         timeoutMs: 20_000 },
  { name: 'marathonbet',    fn: getMarathonbetEvents,    timeoutMs: 20_000 },
  // ── US bookmakers ─────────────────────────────────────────────────────────
  { name: 'draftkings',     fn: getDraftKingsEvents,     timeoutMs: 20_000 },
  { name: 'fanduel',        fn: getFanDuelEvents,        timeoutMs: 20_000 },
  { name: 'betmgm',         fn: getBetMGMEvents,         timeoutMs: 20_000 },
  { name: 'caesars',        fn: getCaesarsEvents,        timeoutMs: 20_000 },
  // ── Australian bookmakers ─────────────────────────────────────────────────
  { name: 'sportsbet-au',   fn: getSportsbetAUEvents,    timeoutMs: 20_000 },
  { name: 'tab-au',         fn: getTABAUEvents,          timeoutMs: 20_000 },
  { name: 'ladbrokes-au',   fn: getLadbrokesAUEvents,    timeoutMs: 20_000 },
  // ── Racing ──────────────────────────────────────────────────────────────
  { name: 'horse-racing',   fn: getHorseRacingEvents,    timeoutMs: 25_000 },
  // ── Esports ─────────────────────────────────────────────────────────────
  { name: 'esports',        fn: getEsportsEvents,        timeoutMs: 30_000 },
  // ── Crypto / offshore ───────────────────────────────────────────────────
  { name: 'bovada',         fn: getBovadaEvents,         timeoutMs: 25_000 },
  // ── Prediction markets ──────────────────────────────────────────────────
  { name: 'kalshi',         fn: getKalshiEvents,         timeoutMs: 20_000 },
  { name: 'polymarket',     fn: getPolymarketEvents,     timeoutMs: 20_000 },
]

// Normalise team name for deduplication
function normTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(fc|sc|cf|afc|bsc|ssc|ac|as|ss|rcd|cd|ud|sd|rcde|fk|sk|vfb|bv|sv|vfl|tsv|fsv|sc|rb|red bull|united|city|rovers|town|wanderers|athletic|atletico|dynamo|dynamo|sporting|real|atletico)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function eventKey(ev: Event): string {
  return `${normTeam(ev.homeTeam)}|${normTeam(ev.awayTeam)}|${ev.sport}`
}

function mergeBookmakers(existing: BookmakerOdds[], incoming: BookmakerOdds[]): BookmakerOdds[] {
  const map = new Map<string, BookmakerOdds>()
  for (const b of existing) map.set(b.key, b)
  for (const b of incoming) {
    if (!map.has(b.key)) {
      map.set(b.key, b)
    } else {
      // Keep the one with more markets
      const cur = map.get(b.key)!
      if (b.markets.length > cur.markets.length) map.set(b.key, b)
    }
  }
  return Array.from(map.values())
}

/**
 * Run all scrapers concurrently, return merged events and per-scraper stats.
 */
export async function runAllScrapers(): Promise<{ events: Event[]; results: ScraperResult[] }> {
  const cacheKey = 'all_scrapers'
  const cached = cacheGet<{ events: Event[]; results: ScraperResult[] }>(cacheKey, 300_000)
  if (cached) return cached

  const start = Date.now()

  const scraperPromises = SCRAPERS.map(async scraper => {
    const t = Date.now()
    try {
      const events = await withTimeout(scraper.fn(), scraper.timeoutMs, scraper.name)
      return {
        result: { source: scraper.name, status: 'ok' as const, eventCount: events.length, durationMs: Date.now() - t },
        events,
      }
    } catch (e) {
      const isTimeout = (e as Error).message?.includes('timed out')
      return {
        result: {
          source: scraper.name,
          status: isTimeout ? 'timeout' as const : 'error' as const,
          eventCount: 0,
          durationMs: Date.now() - t,
          error: (e as Error).message,
        },
        events: [] as Event[],
      }
    }
  })

  const settled = await Promise.allSettled(scraperPromises)
  const results: ScraperResult[] = []
  const eventMap = new Map<string, Event>()

  for (const s of settled) {
    if (s.status !== 'fulfilled') {
      results.push({ source: 'unknown', status: 'error', eventCount: 0, durationMs: 0, error: 'Promise rejected' })
      continue
    }
    const { result, events } = s.value
    results.push(result)

    for (const ev of events) {
      const key = eventKey(ev)
      const existing = eventMap.get(key)
      if (!existing) {
        eventMap.set(key, { ...ev, bookmakers: [...ev.bookmakers] })
      } else {
        // Merge bookmakers and take the best metadata
        existing.bookmakers = mergeBookmakers(existing.bookmakers, ev.bookmakers)
        // Update live status
        if (ev.isLive) existing.isLive = true
      }
    }
  }

  const events = Array.from(eventMap.values())

  console.log(
    `[scrapers] total=${events.length} events | time=${Date.now() - start}ms | ` +
    results.map(r => `${r.source}=${r.status}(${r.eventCount})`).join(', ')
  )

  const output = { events, results }
  cacheSet(cacheKey, output)
  return output
}

export type { ScraperResult as ScraperStatus }
