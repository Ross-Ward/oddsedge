/**
 * Betway Sportsbook — global operator (UK, EU, Africa, Americas).
 *
 * Betway exposes a public REST API used by their web app.
 * No authentication required.
 *
 * Base: https://sports.betway.com
 * Endpoint: GET /api/pub/v3/events/sport/{sport}?attachments=MARKET&count=30
 *
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sports.betway.com/api/pub/v3'

const BW_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'FOOTBALL',           sport: 'soccer',            name: 'Football' },
  { slug: 'BASKETBALL',         sport: 'basketball',        name: 'Basketball' },
  { slug: 'TENNIS',             sport: 'tennis',            name: 'Tennis' },
  { slug: 'ICE_HOCKEY',         sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'BASEBALL',           sport: 'baseball',          name: 'Baseball' },
  { slug: 'AMERICAN_FOOTBALL',  sport: 'american_football', name: 'American Football' },
  { slug: 'CRICKET',            sport: 'cricket',           name: 'Cricket' },
  { slug: 'RUGBY_UNION',        sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'MMA',                sport: 'mma',               name: 'MMA' },
  { slug: 'BOXING',             sport: 'mma',               name: 'Boxing' },
  { slug: 'GOLF',               sport: 'golf',              name: 'Golf' },
]

interface BWSel { name: string; decimalOdds?: number; price?: number }
interface BWMkt { type: string; name: string; selections?: BWSel[] }
interface BWEvent {
  id: string
  name?: string
  startTime?: string
  isInPlay?: boolean
  competition?: { name: string }
  attachments?: { markets?: { all?: BWMkt[] } }
  markets?: BWMkt[]
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : name.includes(' - ') ? ' - '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

async function fetchBetwayEvents(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.betway.com', 400)

  const url = `${BASE}/events/sport/${sport.slug}?attachments=MARKET&maxResults=100&sortBy=SCORE&status=UPCOMING`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.betway.com/'),
    timeoutMs: 12_000,
    label: `betway:${sport.slug}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: BWEvent[] = data?.page?.content ?? data?.events ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: BWMkt[] = ev.markets ?? ev.attachments?.markets?.all ?? []
    const matchMkt = allMkts.find(m =>
      ['MATCH_ODDS', '1X2', 'MATCH_RESULT', 'MONEYLINE', 'WIN_DRAW_WIN'].some(t =>
        (m.type ?? '').toUpperCase().includes(t) || (m.name ?? '').toUpperCase().includes(t)
      )
    )

    const domMarkets: Market[] = []
    if (matchMkt?.selections && matchMkt.selections.length >= 2) {
      const outcomes = matchMkt.selections.slice(0, 3).map((s: BWSel) => ({
        name: s.name,
        price: s.decimalOdds ?? s.price ?? 0,
      })).filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.name || 'Match Result', outcomes })
      }
    }

    // Spread
    const spreadMkt = allMkts.find(m =>
      ['SPREAD', 'HANDICAP', 'POINT_SPREAD', 'ASIAN_HANDICAP'].some(t =>
        (m.type ?? '').toUpperCase().includes(t) || (m.name ?? '').toUpperCase().includes(t)
      )
    )
    if (spreadMkt?.selections && spreadMkt.selections.length >= 2) {
      const outcomes = spreadMkt.selections.slice(0, 2).map((s: BWSel) => ({
        name: s.name, price: s.decimalOdds ?? s.price ?? 0,
      })).filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'spreads', label: spreadMkt.name || 'Spread', outcomes })
    }

    // Totals
    const totalMkt = allMkts.find(m =>
      ['TOTAL', 'OVER_UNDER', 'OVER/UNDER'].some(t =>
        (m.type ?? '').toUpperCase().includes(t) || (m.name ?? '').toUpperCase().includes(t)
      )
    )
    if (totalMkt?.selections && totalMkt.selections.length >= 2) {
      const outcomes = totalMkt.selections.slice(0, 2).map((s: BWSel) => ({
        name: s.name, price: s.decimalOdds ?? s.price ?? 0,
      })).filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'totals', label: totalMkt.name || 'Total', outcomes })
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'betway', title: 'Betway', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `bwy_${ev.id}`,
      sport: sport.sport,
      sportTitle: ev.competition?.name ?? sport.name,
      league: ev.competition?.name ?? sport.name,
      commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isInPlay ?? false,
      bookmakers,
    }]
  })
}

export async function getBetwayEvents(): Promise<Event[]> {
  const cacheKey = 'betway_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    BW_SPORTS.map(s => fetchBetwayEvents(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[betway] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
