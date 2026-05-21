/**
 * Betfair Exchange scraper.
 *
 * Betfair's Exchange has a public-facing REST API.
 * For the exchange we use their public "Next Races" and "Popular Markets" endpoints
 * which are accessible without auth.
 *
 * Exchange odds: lay/back prices. We take the best back price as the decimal odds.
 *
 * Base: https://www.betfair.com/www/sports/navigation/navtypes
 *       https://api.betfair.com/exchange/betting/json-rpc/v1 (requires auth)
 *
 * Fallback: Use the betfair sportsbook (fixed-odds side) public API.
 *   GET https://www.betfair.com/sport/api/sports/{sport}/events?filter=competition_id:{id}
 *
 * Also try their internal navigation / event listing:
 *   GET https://api.betfair.com/exchange/betting/rest/v1.0/listEvents/
 *   (the listEvents endpoint is auth-required, so we scrape their sports pages instead)
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const SPORTS_BASE = 'https://www.betfair.com'

// Betfair Sports IDs (used in URL navigation)
const BF_SPORTS: Array<{ betfairId: string; sport: Sport; name: string; slug: string }> = [
  { betfairId: '1',  sport: 'soccer',            name: 'Football',          slug: 'football' },
  { betfairId: '2',  sport: 'tennis',             name: 'Tennis',            slug: 'tennis' },
  { betfairId: '7',  sport: 'cricket',            name: 'Cricket',           slug: 'cricket' },
  { betfairId: '6',  sport: 'hockey',             name: 'Ice Hockey',        slug: 'ice-hockey' },
  { betfairId: '10', sport: 'mma',                name: 'Boxing',            slug: 'boxing' },
  { betfairId: '4',  sport: 'rugby',              name: 'Rugby Union',       slug: 'rugby-union' },
  { betfairId: '5',  sport: 'rugby',              name: 'Rugby League',      slug: 'rugby-league' },
  { betfairId: '11', sport: 'american_football',  name: 'American Football', slug: 'american-football' },
  { betfairId: '19', sport: 'basketball',         name: 'Basketball',        slug: 'basketball' },
  { betfairId: '3',  sport: 'baseball',           name: 'Baseball',          slug: 'baseball' },
  { betfairId: '23', sport: 'golf',               name: 'Golf',              slug: 'golf' },
]

interface BFPrice { price: number; size: number }
interface BFRunner { selectionId: number; runnerName?: string; lastPriceTraded?: number; ex?: { availableToBack: BFPrice[]; availableToLay: BFPrice[] } }
interface BFMarket { marketId: string; marketName: string; totalAvailable?: number; event?: { id: string; name: string; openDate?: string } }

/** Try Betfair Sportsbook (fixed-odds) — public API, multi-endpoint chain */
async function fetchBetfairSportbook(sport: { betfairId: string; sport: Sport; name: string; slug: string }): Promise<Event[]> {
  await rateLimit('www.betfair.com', 600)

  // Try endpoints in order until one succeeds
  const candidates = [
    `${SPORTS_BASE}/sport/api/sports/${sport.slug}/competition?filter=next24Hours`,
    `${SPORTS_BASE}/sport/api/${sport.slug}/events?filter=next48Hours`,
    `${SPORTS_BASE}/www/sports/navigation/navtypes/sports/${sport.betfairId}/events?maxResults=100`,
  ]

  let data: any = null
  for (const url of candidates) {
    const res = await safeFetch(url, {
      headers: { ...jsonHeaders('https://www.betfair.com/'), 'x-application': 'betfair' },
      timeoutMs: 12_000,
      label: `betfair:${sport.slug}`,
    })
    if (res?.ok) { data = await res.json().catch(() => null); if (data) break }
  }
  if (!data) return []

  const events: any[] = data?.events
    ?? data?.competitions?.flatMap((c: any) => c.events ?? [])
    ?? data?.data?.events
    ?? []

  return events.flatMap((ev: any): Event[] => {
    const name = ev.event?.name ?? ev.name ?? ''
    const sep = name.includes(' v ') ? ' v '
      : name.includes(' vs ') ? ' vs '
      : name.includes(' @ ') ? ' @ '
      : null
    if (!sep) return []
    const parts = name.split(sep)
    if (parts.length < 2) return []
    const homeTeam = sep === ' @ ' ? parts[1].trim() : parts[0].trim()
    const awayTeam = sep === ' @ ' ? parts[0].trim() : parts[1].trim()

    const runners: any[] = ev.runners ?? ev.markets?.[0]?.runners ?? []
    const markets: Market[] = []

    if (runners.length >= 2) {
      const outcomes = runners.slice(0, 3).map((r: any) => {
        const backPrice: number = r.ex?.availableToBack?.[0]?.price
          ?? r.lastPriceTraded
          ?? r.winPrice
          ?? r.price
          ?? 0
        return {
          name: r.runnerName ?? r.name ?? 'Unknown',
          price: typeof backPrice === 'number' && backPrice > 1 ? backPrice : 0,
        }
      }).filter(o => o.price > 1)

      if (outcomes.length >= 2) {
        markets.push({ key: 'h2h', label: 'Match Odds (Exchange)', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = markets.length > 0
      ? [{ key: 'betfair', title: 'Betfair Exchange', lastUpdate: new Date().toISOString(), markets }]
      : []

    return [{
      id: `bf_${ev.event?.id ?? ev.id ?? `${homeTeam}_${awayTeam}`}`,
      sport: sport.sport,
      sportTitle: ev.competition?.name ?? ev.competitionName ?? sport.name,
      league: ev.competition?.name ?? ev.competitionName ?? sport.name,
      commenceTime: ev.event?.openDate ?? ev.startTime ?? new Date().toISOString(),
      homeTeam,
      awayTeam,
      isLive: ev.inPlay ?? ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getBetfairEvents(): Promise<Event[]> {
  const cacheKey = 'betfair_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    BF_SPORTS.map(s => fetchBetfairSportbook(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[betfair] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
