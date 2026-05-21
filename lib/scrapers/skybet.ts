/**
 * Sky Bet scraper — UK's largest online bookmaker.
 * Sky Bet uses the SBTech platform internally.
 *
 * Public REST API base: https://sb.skybet.com/
 * Used endpoints:
 *   GET /openapi/v2/event?categoryid={cid}&subcategoryid={scid}&count=50
 *   GET /openapi/v2/price/event/{eventId}
 *
 * Sky Bet uses fractional odds.
 */
import { Event, BookmakerOdds, Market } from '../types'
import { safeFetch, jsonHeaders, fractionalToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sb.skybet.com/openapi/v2'

// Sky Bet category/subcategory IDs for major sports
const CATEGORIES = [
  // Football
  { categoryId: '1', subcategoryId: '10',  name: 'Premier League',       sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '12',  name: 'Championship',          sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '175', name: 'Champions League',      sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '173', name: 'Europa League',         sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '13',  name: 'La Liga',               sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '17',  name: 'Bundesliga',            sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '18',  name: 'Serie A',               sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '14',  name: 'Ligue 1',               sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '20',  name: 'Scottish Premiership',  sport: 'soccer' as const },
  { categoryId: '1', subcategoryId: '23',  name: 'Eredivisie',            sport: 'soccer' as const },
  // Cricket
  { categoryId: '7',  subcategoryId: '',   name: 'Cricket',               sport: 'cricket' as const },
  // Tennis
  { categoryId: '13', subcategoryId: '',   name: 'Tennis',                sport: 'tennis' as const },
  // American Football
  { categoryId: '19', subcategoryId: '',   name: 'American Football',     sport: 'american_football' as const },
  // Basketball
  { categoryId: '15', subcategoryId: '',   name: 'Basketball',            sport: 'basketball' as const },
  // Ice Hockey
  { categoryId: '17', subcategoryId: '',   name: 'Ice Hockey',            sport: 'hockey' as const },
  // Rugby Union
  { categoryId: '3',  subcategoryId: '',   name: 'Rugby Union',           sport: 'rugby' as const },
  // Rugby League
  { categoryId: '4',  subcategoryId: '',   name: 'Rugby League',          sport: 'rugby' as const },
  // Baseball
  { categoryId: '12', subcategoryId: '',   name: 'Baseball',              sport: 'baseball' as const },
  // MMA
  { categoryId: '42', subcategoryId: '',   name: 'MMA/UFC',               sport: 'mma' as const },
]

interface SkyBetEvent {
  eventId: string
  name: string
  market?: string
  startTime?: string
  participants?: Array<{ role: string; name: string }>
}

function parseParticipants(event: SkyBetEvent): { home: string; away: string } | null {
  const parts = event.participants ?? []
  const home = parts.find(p => p.role === 'HOME')?.name ?? parts[0]?.name
  const away = parts.find(p => p.role === 'AWAY')?.name ?? parts[1]?.name

  if (home && away) return { home, away }

  // Fallback: "Team A v Team B"
  const raw = event.name ?? ''
  const sep = raw.includes(' v ') ? ' v ' : raw.includes(' vs ') ? ' vs ' : null
  if (sep) {
    const [h, a] = raw.split(sep)
    return { home: h.trim(), away: a.trim() }
  }

  return null
}

async function fetchCategory(categoryId: string, subcategoryId: string, name: string, sport: Event['sport']): Promise<Event[]> {
  await rateLimit('sb.skybet.com', 300)

  const params = new URLSearchParams({ categoryid: categoryId, count: '100', includeMarkets: 'true' })
  if (subcategoryId) params.set('subcategoryid', subcategoryId)

  const url = `${BASE}/event?${params.toString()}`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.skybet.com/'),
    timeoutMs: 12_000,
    label: `skybet:${name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const rawEvents: SkyBetEvent[] = data?.events ?? data?.data ?? []

  return rawEvents.flatMap((ev): Event[] => {
    const teams = parseParticipants(ev)
    if (!teams) return []

    // Attempt to pull odds from inline prices if available
    const prices = (ev as any).prices ?? (ev as any).selections ?? []
    const markets: Market[] = []

    if (Array.isArray(prices) && prices.length >= 2) {
      const outcomes = prices
        .slice(0, 3)
        .map((p: any) => ({
          name: p.selectionName ?? p.name ?? 'Unknown',
          price: p.decimalOdds
            ? parseFloat(p.decimalOdds)
            : p.odds
              ? fractionalToDecimal(String(p.odds))
              : 0,
        }))
        .filter(o => o.price > 1)

      if (outcomes.length >= 2) {
        markets.push({ key: 'h2h', label: 'Match Result', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = markets.length > 0
      ? [{ key: 'skybet', title: 'Sky Bet', lastUpdate: new Date().toISOString(), markets }]
      : []

    return [{
      id: `sb_${ev.eventId}`,
      sport,
      sportTitle: name,
      league: name,
      commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: false,
      bookmakers,
    }]
  })
}

export async function getSkyBetEvents(): Promise<Event[]> {
  const cacheKey = 'skybet_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    CATEGORIES.map(c => fetchCategory(c.categoryId, c.subcategoryId, c.name, c.sport))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[skybet] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
