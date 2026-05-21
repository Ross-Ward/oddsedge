/**
 * Paddy Power scraper — major UK/Irish bookmaker (now merged with Betfair).
 *
 * Paddy Power's public REST API is accessible without auth.
 * Base: https://www.paddypower.com/rest/v2
 *
 * Key endpoints:
 *   GET /sports/{sport}/competitions
 *   GET /events?competitionId={id}&attachments=MARKET
 *
 * Returns fractional odds.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, fractionalToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.paddypower.com/rest/v2'

const PP_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'FOOTBALL',          sport: 'soccer',            name: 'Football' },
  { slug: 'TENNIS',            sport: 'tennis',            name: 'Tennis' },
  { slug: 'CRICKET',           sport: 'cricket',           name: 'Cricket' },
  { slug: 'BASKETBALL',        sport: 'basketball',        name: 'Basketball' },
  { slug: 'AMERICAN_FOOTBALL', sport: 'american_football', name: 'American Football' },
  { slug: 'ICE_HOCKEY',        sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'BASEBALL',          sport: 'baseball',          name: 'Baseball' },
  { slug: 'RUGBY_UNION',       sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'MMA',               sport: 'mma',               name: 'MMA/UFC' },
  { slug: 'BOXING',            sport: 'mma',               name: 'Boxing' },
  { slug: 'GOLF',              sport: 'golf',              name: 'Golf' },
]

interface PPSelection {
  id: string
  name: string
  price?: { decimal: number; fractional: string }
}

interface PPMarket {
  id: string
  name: string
  type: string
  selections: PPSelection[]
}

interface PPEvent {
  id: string
  name: string
  startTime?: string
  competition?: { name: string }
  isLive?: boolean
  markets?: PPMarket[]
  attachments?: { markets?: { all?: PPMarket[] } }
}

function buildMarkets(ppEvent: PPEvent): Market[] {
  const markets: Market[] = []

  const ppMarkets: PPMarket[] = ppEvent.markets
    ?? ppEvent.attachments?.markets?.all
    ?? []

  for (const m of ppMarkets) {
    // Look for Match Result / Moneyline markets
    const type = (m.type ?? m.name ?? '').toUpperCase()
    if (
      !type.includes('MATCH_ODDS') &&
      !type.includes('MATCH_RESULT') &&
      !type.includes('1X2') &&
      !type.includes('MONEYLINE') &&
      !type.includes('WIN_DRAW_WIN') &&
      !type.includes('TO_WIN_OUTRIGHT')
    ) continue

    const outcomes = (m.selections ?? [])
      .filter(s => s.price)
      .map(s => ({
        name: s.name,
        price: s.price!.decimal > 1
          ? s.price!.decimal
          : fractionalToDecimal(s.price!.fractional ?? ''),
      }))
      .filter(o => o.price > 1)

    if (outcomes.length >= 2) {
      markets.push({
        key: type.includes('1X2') || type.includes('MATCH_ODDS') ? 'h2h' : 'h2h',
        label: m.name,
        outcomes,
      })
      break // one market per event is enough for arbitrage
    }
  }

  return markets
}

function parseEventNames(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : name.includes(' @ ') ? ' @ '
    : null
  if (!sep) return null
  const parts = name.split(sep)
  if (parts.length < 2) return null
  return { home: parts[0].trim(), away: parts[1].trim() }
}

async function fetchPPSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('paddypower.com', 400)

  // Fetch upcoming events directly
  const url = `${BASE}/sports/${sport.slug}/events?attachments=MARKET&maxResults=100&sortBy=SCORE`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.paddypower.com/'),
    timeoutMs: 15_000,
    label: `paddypower:${sport.slug}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const rawEvents: PPEvent[] = data?.page?.content ?? data?.events ?? []

  return rawEvents.flatMap((ev): Event[] => {
    const teams = parseEventNames(ev.name ?? '')
    if (!teams) return []

    const markets = buildMarkets(ev)
    const bookmakers: BookmakerOdds[] = markets.length > 0
      ? [{ key: 'paddy_power', title: 'Paddy Power', lastUpdate: new Date().toISOString(), markets }]
      : []

    return [{
      id: `pp_${ev.id}`,
      sport: sport.sport,
      sportTitle: ev.competition?.name ?? sport.name,
      league: ev.competition?.name ?? sport.name,
      commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getPaddyPowerEvents(): Promise<Event[]> {
  const cacheKey = 'paddypower_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    PP_SPORTS.map(s => fetchPPSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[paddypower] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
