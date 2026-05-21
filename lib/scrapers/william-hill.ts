/**
 * William Hill / Evoke scraper.
 *
 * William Hill uses the OpenBet platform.
 * Their public-facing API serves the website without auth.
 *
 * Endpoints:
 *   GET https://sports.williamhill.com/betting/en-gb/football/matches
 *   GET https://sports.williamhill.com/api/pub/v2/events?sport={sport}&competition={comp}
 *
 * Fallback: their SportsBook API returns JSON for the mobile app.
 *   GET https://builderscore.williamhill.com/api/sportsbook/sports/{sport}/competitions/{id}/events
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, fractionalToDecimal, parseOdds, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const API_BASE = 'https://sports.williamhill.com/api/pub/v2'

const WH_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'football',           sport: 'soccer',            name: 'Football' },
  { slug: 'tennis',             sport: 'tennis',            name: 'Tennis' },
  { slug: 'cricket',            sport: 'cricket',           name: 'Cricket' },
  { slug: 'basketball',         sport: 'basketball',        name: 'Basketball' },
  { slug: 'american-football',  sport: 'american_football', name: 'American Football' },
  { slug: 'ice-hockey',         sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'baseball',           sport: 'baseball',          name: 'Baseball' },
  { slug: 'rugby-union',        sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'boxing',             sport: 'mma',               name: 'Boxing' },
  { slug: 'golf',               sport: 'golf',              name: 'Golf' },
]

// Known competition IDs for Premier League, Champions League etc.
const WH_COMPETITIONS: Array<{ sport: string; id: string; name: string }> = [
  { sport: 'football', id: '295',  name: 'Premier League' },
  { sport: 'football', id: '296',  name: 'Championship' },
  { sport: 'football', id: '304',  name: 'Champions League' },
  { sport: 'football', id: '305',  name: 'Europa League' },
  { sport: 'football', id: '298',  name: 'La Liga' },
  { sport: 'football', id: '300',  name: 'Bundesliga' },
  { sport: 'football', id: '302',  name: 'Serie A' },
  { sport: 'football', id: '303',  name: 'Ligue 1' },
  { sport: 'basketball', id: 'NBA', name: 'NBA' },
  { sport: 'american-football', id: 'NFL', name: 'NFL' },
]

interface WHOutcome {
  name: string
  priceDen?: number
  priceNum?: number
  decimalPrice?: number
  sp?: boolean
}

interface WHMarket {
  type: string
  name: string
  outcomes?: WHOutcome[]
  runners?: WHOutcome[]
}

interface WHEvent {
  id: string | number
  name?: string
  homeTeam?: string
  awayTeam?: string
  startTime?: string
  isInPlay?: boolean
  sport?: string
  typeName?: string
  competition?: { name: string }
  markets?: WHMarket[]
}

function whOddsToDecimal(o: WHOutcome): number {
  if (o.decimalPrice && o.decimalPrice > 1) return o.decimalPrice
  if (o.priceNum != null && o.priceDen != null && o.priceDen > 0) {
    return parseFloat((1 + o.priceNum / o.priceDen).toFixed(3))
  }
  return 0
}

function parseWHEvent(ev: WHEvent, sport: Sport, leagueName: string): Event | null {
  let homeTeam: string
  let awayTeam: string

  if (ev.homeTeam && ev.awayTeam) {
    homeTeam = ev.homeTeam
    awayTeam = ev.awayTeam
  } else {
    const name = ev.name ?? ''
    const sep = name.includes(' v ') ? ' v '
      : name.includes(' vs ') ? ' vs '
      : null
    if (!sep) return null
    const parts = name.split(sep)
    homeTeam = parts[0].trim()
    awayTeam = parts[1].trim()
  }

  if (!homeTeam || !awayTeam) return null

  // Build market from available markets
  const allMarkets: WHMarket[] = ev.markets ?? []
  const matchResultMarket = allMarkets.find(m =>
    ['MATCH_BETTING', '1X2', 'MATCH_RESULT', 'WIN_DRAW_WIN', 'MONEYLINE'].some(t =>
      (m.type ?? '').toUpperCase().includes(t) || (m.name ?? '').toUpperCase().includes(t)
    )
  )

  const markets: Market[] = []
  if (matchResultMarket) {
    const runners = matchResultMarket.outcomes ?? matchResultMarket.runners ?? []
    const outcomes = runners
      .map(r => ({ name: r.name, price: whOddsToDecimal(r) }))
      .filter(o => o.price > 1)
    if (outcomes.length >= 2) {
      markets.push({ key: 'h2h', label: matchResultMarket.name || 'Match Result', outcomes })
    }
  }

  const bookmakers: BookmakerOdds[] = markets.length > 0
    ? [{ key: 'williamhill', title: 'William Hill', lastUpdate: new Date().toISOString(), markets }]
    : []

  return {
    id: `wh_${ev.id}`,
    sport,
    sportTitle: ev.competition?.name ?? leagueName,
    league: ev.competition?.name ?? leagueName,
    commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
    homeTeam,
    awayTeam,
    isLive: ev.isInPlay ?? false,
    bookmakers,
  }
}

async function fetchWHSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.williamhill.com', 400)

  // Try multiple endpoint patterns in order
  const endpoints = [
    `${API_BASE}/events?sport=${sport.slug}&type=MATCH&isLive=false&limit=100&sort=startTime`,
    `https://builderscore.williamhill.com/api/sportsbook/sports/${sport.slug}/events?isLive=false&limit=100`,
    `https://sports.williamhill.com/betting/en-gb/${sport.slug}.json`,
  ]

  let data: any = null
  for (const url of endpoints) {
    const res = await safeFetch(url, {
      headers: jsonHeaders('https://sports.williamhill.com/'),
      timeoutMs: 12_000,
      label: `williamhill:${sport.slug}`,
    })
    if (res?.ok) { data = await res.json().catch(() => null); if (data) break }
  }
  if (!data) return []

  const raw: WHEvent[] = data?.events ?? data?.data ?? data?.competitions?.flatMap((c: any) => c.events ?? []) ?? []

  return raw.flatMap(ev => {
    const parsed = parseWHEvent(ev, sport.sport, sport.name)
    return parsed ? [parsed] : []
  })
}

export async function getWilliamHillEvents(): Promise<Event[]> {
  const cacheKey = 'williamhill_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    WH_SPORTS.map(s => fetchWHSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[williamhill] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
