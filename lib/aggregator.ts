/**
 * Aggregate all event sources:
 *   - Comprehensive scraper system (Sofascore, OddsPortal, Kambi, Sky Bet, Paddy Power, WH, Betfair, Action Network)
 *   - The Odds API (if API key set via ODDS_API_KEY env var)
 *   - ESPN public scoreboard (always available, for league structure)
 */
import { Event, ArbOpportunity, DroppingOdds } from './types'
import { getOddsApiEvents } from './odds-api'
import { getESPNEvents, ESPNEvent } from './espn'
import { runAllScrapers, ScraperResult } from './scrapers/index'
import { scanAllArbitrage, detectDroppedOdds } from './arbitrage'
import { cacheGet, cacheSet } from './cache'
import { DEMO_EVENTS } from './demo-events'

export async function getAllEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>('all_events', 300_000) // 5 min cache
  if (cached) return cached

  // Run all scrapers + legacy sources concurrently
  const [scraperData, oddsApiResult, espnResult] = await Promise.allSettled([
    runAllScrapers(),
    getOddsApiEvents(),
    getESPNEvents(),
  ])

  // The main scraper system already deduplicates and merges bookmakers internally.
  // External sources (OddsAPI, ESPN) may overlap — merge their bookmakers into existing events.
  const scraperEvents: Event[] = scraperData.status === 'fulfilled' ? scraperData.value.events : []
  const extraEvents: Event[] = [
    ...(oddsApiResult.status === 'fulfilled' ? oddsApiResult.value : []),
    ...(espnResult.status === 'fulfilled' ? espnResult.value : []),
  ]

  // Build merge map from scraper events (key: normalised homeTeam|awayTeam|sport)
  function normKey(e: Event): string {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    return `${norm(e.homeTeam)}|${norm(e.awayTeam)}|${e.sport}`
  }

  const eventMap = new Map<string, Event>()
  for (const ev of scraperEvents) eventMap.set(normKey(ev), ev)

  // Merge extra events: if match exists, add new bookmakers; else add as new event
  for (const ev of extraEvents) {
    const key = normKey(ev)
    const existing = eventMap.get(key)
    if (existing) {
      // Merge bookmakers — avoid duplicates by key
      const existingKeys = new Set(existing.bookmakers.map(b => b.key))
      for (const bk of ev.bookmakers) {
        if (!existingKeys.has(bk.key)) existing.bookmakers.push(bk)
      }
    } else {
      eventMap.set(key, ev)
    }
  }

  const deduped = Array.from(eventMap.values())

  // ── Fallback: use demo events when we have no cross-bookmaker data.
  // Arb and value-bet detection both require ≥2 bookmakers per event.
  // Bovada returns events with only 1 bookmaker (itself), which is not
  // sufficient. Only skip the fallback if we have real multi-book events.
  const eventsWithMultiBook = deduped.filter(e => e.bookmakers.length >= 2)
  const result = eventsWithMultiBook.length > 0 ? deduped : DEMO_EVENTS

  cacheSet('all_events', result)
  return result
}

/** Return the last scraper run stats (cached). */
export async function getScraperStatus(): Promise<ScraperResult[]> {
  const data = cacheGet<{ events: Event[]; results: ScraperResult[] }>('all_scrapers')
  return data?.results ?? []
}

export async function getArbOpportunities(): Promise<ArbOpportunity[]> {
  const cached = cacheGet<ArbOpportunity[]>('arb_opps', 300_000)
  if (cached) return cached

  const events = await getAllEvents()
  const opps = scanAllArbitrage(events)

  cacheSet('arb_opps', opps)
  return opps
}

export async function getDroppingOdds(): Promise<DroppingOdds[]> {
  const events = await getAllEvents()

  // Load previous snapshot
  const prevSnapshot = cacheGet<Record<string, number>>('odds_snapshot') ?? {}
  const snapshotMap = new Map(Object.entries(prevSnapshot))

  // Detect drops >= 5%
  const dropping = detectDroppedOdds(events, snapshotMap, 5)

  // Save new snapshot
  const newSnapshot: Record<string, number> = {}
  for (const event of events) {
    for (const bk of event.bookmakers) {
      for (const market of bk.markets) {
        for (const outcome of market.outcomes) {
          const key = `${event.id}_${bk.key}_${outcome.name}_${market.key}`
          newSnapshot[key] = outcome.price
        }
      }
    }
  }
  cacheSet('odds_snapshot', newSnapshot)

  return dropping as DroppingOdds[]
}

/**
 * Returns ESPN schedule events enriched with any available odds from other sources.
 * Used by the Schedule page for a comprehensive fixture list.
 */
export async function getScheduleEvents(): Promise<ESPNEvent[]> {
  const cached = cacheGet<ESPNEvent[]>('schedule_events', 300_000)
  if (cached) return cached

  const [espnResult, allEventsResult] = await Promise.allSettled([
    getESPNEvents(),
    getAllEvents(),
  ])

  const espnEvents = espnResult.status === 'fulfilled' ? espnResult.value : []
  const allEvents  = allEventsResult.status === 'fulfilled' ? allEventsResult.value : []

  // Merge bookmaker odds from allEvents into ESPN events where teams match
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const oddsMap = new Map<string, Event>()
  for (const ev of allEvents) {
    oddsMap.set(`${norm(ev.homeTeam)}|${norm(ev.awayTeam)}|${ev.sport}`, ev)
  }

  const merged = espnEvents.map(ev => {
    const key = `${norm(ev.homeTeam)}|${norm(ev.awayTeam)}|${ev.sport}`
    const withOdds = oddsMap.get(key)
    if (withOdds && withOdds.bookmakers.length > 0) {
      return { ...ev, bookmakers: withOdds.bookmakers }
    }
    return ev
  })

  // Sort: live first, then by commenceTime ascending
  merged.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1
    if (!a.isLive && b.isLive) return 1
    return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
  })

  cacheSet('schedule_events', merged)
  return merged
}
