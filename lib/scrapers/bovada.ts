/**
 * Bovada — US-facing crypto/offshore sportsbook.
 *
 * Bovada accepts crypto payments and is one of the most popular offshore
 * books for US bettors. It has a completely public JSON API with no
 * authentication required.
 *
 * API base: https://www.bovada.lv/services/sports/event/v2/events/A/description
 * Supported sports: football, basketball, baseball, hockey, soccer, tennis,
 *   mixed-martial-arts, golf, boxing, esports, rugby
 *
 * Also includes Betcris (Latin America) as a secondary crypto-friendly source.
 *
 * Odds format: American → converted to decimal.
 */

import { Event, BookmakerOdds, Market, Outcome } from '../types'
import { safeFetch, jsonHeaders, rateLimit, americanToDecimal } from './utils'
import { cacheGet, cacheSet } from '../cache'

const CACHE_KEY = 'bovada_events'
const CACHE_TTL = 300_000

// ─── Types ───────────────────────────────────────────────────────────────────

interface BovadaCompetitor {
  id?: string
  name: string
  home?: boolean
}

interface BovadaOutcome {
  id?: string
  description: string
  status?: string
  price?: {
    id?: string
    american: string        // '+150' | '-110' | 'EVEN'
    decimal: string
    fractional?: string
    moneyLine?: string
  }
}

interface BovadaMarket {
  id?: string
  description: string
  period?: { description?: string; live?: boolean }
  type?: string
  outcomes: BovadaOutcome[]
}

interface BovadaDisplayGroup {
  id?: string
  description: string
  markets?: BovadaMarket[]
}

interface BovadaEvent {
  id?: string
  description: string
  competitors?: BovadaCompetitor[]
  startTime?: number  // epoch ms
  live?: boolean
  clock?: { relativeGameTimeInSecs?: number }
  displayGroups?: BovadaDisplayGroup[]
  sport?: string
  link?: string
}

interface BovadaGroup {
  id?: string
  description: string
  events?: BovadaEvent[]
  groups?: BovadaGroup[]
}

interface BovadaSportsResponse {
  events?: BovadaEvent[]
  groups?: BovadaGroup[]
}

// ─── Sport configuration ──────────────────────────────────────────────────────

interface BovadaSport {
  slug: string
  title: string
  sport: Event['sport']
}

const BOVADA_SPORTS: BovadaSport[] = [
  { slug: 'football',           title: 'NFL / NCAAF',        sport: 'american_football' },
  { slug: 'basketball',         title: 'NBA / NCAAB',        sport: 'basketball'        },
  { slug: 'baseball',           title: 'MLB',                sport: 'baseball'          },
  { slug: 'hockey',             title: 'NHL',                sport: 'hockey'            },
  { slug: 'soccer',             title: 'Soccer',             sport: 'soccer'            },
  { slug: 'tennis',             title: 'Tennis',             sport: 'tennis'            },
  { slug: 'mixed-martial-arts', title: 'MMA / UFC',          sport: 'mma'               },
  { slug: 'golf',               title: 'Golf',               sport: 'golf'              },
  { slug: 'boxing',             title: 'Boxing',             sport: 'mma'               },
  { slug: 'rugby',              title: 'Rugby',              sport: 'rugby'             },
  { slug: 'esports',            title: 'Esports',            sport: 'esports'           },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bovadaAmericanToDecimal(american: string): number {
  if (american === 'EVEN' || american === 'EV') return 2.00
  const n = parseInt(american, 10)
  if (isNaN(n)) return 0
  return americanToDecimal(n)
}

function extractH2hMarket(event: BovadaEvent): Market | null {
  const allMarkets: BovadaMarket[] = []
  for (const dg of event.displayGroups ?? []) {
    for (const m of dg.markets ?? []) allMarkets.push(m)
  }

  // Find "money line" or "match" market
  const moneyLine = allMarkets.find(m => {
    const desc = (m.description ?? '').toLowerCase()
    return desc === 'moneyline' || desc === 'match' || desc === 'to win' || desc === '2 way'
  }) ?? allMarkets[0]

  if (!moneyLine) return null

  const outcomes: Outcome[] = moneyLine.outcomes
    .filter(o => o.status !== 'H' && o.price?.american)
    .map(o => ({
      name: o.description,
      price: bovadaAmericanToDecimal(o.price!.american),
    }))
    .filter(o => o.price > 1 && o.name)

  if (outcomes.length < 2) return null

  return { key: 'h2h', label: 'Money Line', outcomes }
}

function extractSpreadMarket(event: BovadaEvent): Market | null {
  const allMarkets: BovadaMarket[] = []
  for (const dg of event.displayGroups ?? []) {
    for (const m of dg.markets ?? []) allMarkets.push(m)
  }

  const spread = allMarkets.find(m => {
    const desc = (m.description ?? '').toLowerCase()
    return desc.includes('spread') || desc === 'run line' || desc === 'puck line' || desc.includes('handicap')
  })
  if (!spread) return null

  const outcomes: Outcome[] = spread.outcomes
    .filter(o => o.status !== 'H' && o.price?.american)
    .map(o => ({
      name: o.description,
      price: bovadaAmericanToDecimal(o.price!.american),
    }))
    .filter(o => o.price > 1 && o.name)

  if (outcomes.length < 2) return null

  return { key: 'spreads', label: 'Spread', outcomes }
}

function bovadaEventToOddsEvent(
  event: BovadaEvent,
  sportConfig: BovadaSport,
  league: string,
): Event | null {
  const competitors = event.competitors ?? []
  const home = competitors.find(c => c.home) ?? competitors[0]
  const away = competitors.find(c => !c.home) ?? competitors[1]

  if (!home?.name || !away?.name) return null

  const h2h    = extractH2hMarket(event)
  const spread = extractSpreadMarket(event)

  const markets: Market[] = []
  if (h2h)    markets.push(h2h)
  if (spread) markets.push(spread)

  if (markets.length === 0) return null

  const bk: BookmakerOdds = {
    key: 'bovada',
    title: 'Bovada',
    lastUpdate: new Date().toISOString(),
    markets,
  }

  const commenceTime = event.startTime
    ? new Date(event.startTime).toISOString()
    : new Date().toISOString()

  return {
    id: `bov_${event.id}`,
    sport: sportConfig.sport,
    sportTitle: sportConfig.title,
    league,
    commenceTime,
    homeTeam: home.name,
    awayTeam: away.name,
    isLive: event.live ?? false,
    bookmakers: [bk],
  }
}

function flattenGroups(groups: BovadaGroup[] | undefined, depth = 0): { league: string; events: BovadaEvent[] }[] {
  if (!groups || depth > 4) return []
  const result: { league: string; events: BovadaEvent[] }[] = []
  for (const g of groups) {
    if (g.events?.length) result.push({ league: g.description, events: g.events })
    result.push(...flattenGroups(g.groups, depth + 1))
  }
  return result
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchBovadaSport(sportConfig: BovadaSport): Promise<Event[]> {
  await rateLimit('www.bovada.lv', 600)

  const url = `https://www.bovada.lv/services/sports/event/v2/events/A/description/${sportConfig.slug}?lang=en`
  const res = await safeFetch(url, {
    headers: {
      ...jsonHeaders('https://www.bovada.lv/'),
      'Accept': 'application/json',
    },
    timeoutMs: 18_000,
    label: `bovada:${sportConfig.slug}`,
  })
  if (!res?.ok) return []

  const data: BovadaSportsResponse[] | null = await res.json().catch(() => null)
  if (!Array.isArray(data) || data.length === 0) return []

  const events: Event[] = []

  for (const section of data) {
    // Direct events
    for (const ev of section.events ?? []) {
      const parsed = bovadaEventToOddsEvent(ev, sportConfig, sportConfig.title)
      if (parsed) events.push(parsed)
    }

    // Nested groups
    const grouped = flattenGroups(section.groups)
    for (const { league, events: groupEvents } of grouped) {
      for (const ev of groupEvents) {
        const parsed = bovadaEventToOddsEvent(ev, sportConfig, league)
        if (parsed) events.push(parsed)
      }
    }
  }

  return events
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getBovadaEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>(CACHE_KEY, CACHE_TTL)
  if (cached) return cached

  const results = await Promise.allSettled(
    BOVADA_SPORTS.map(s => fetchBovadaSport(s))
  )

  const all: Event[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  console.log(`[bovada] ${all.length} events across ${BOVADA_SPORTS.length} sports`)
  cacheSet(CACHE_KEY, all)
  return all
}
