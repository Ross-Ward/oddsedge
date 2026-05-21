/**
 * Marathonbet — international bookmaker (strong in Russia/Eastern Europe).
 *
 * Marathonbet serves JSON from their public API endpoint.
 * No authentication required.
 *
 * Base: https://www.marathonbet.co.uk
 * Endpoint: GET /en/sports/Football  (HTML, but also has JSON via Accept header)
 *
 * Better endpoint: GET https://www.marathonbet.co.uk/en/ajax/mbe/event/list?sports=1&lang=en
 *
 * Or their API format:
 *   GET https://www.marathonbet.co.uk/api/sports-lineup-by-sports/{SPORT}?locale=en
 *
 * Odds: decimal.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.marathonbet.co.uk'

const MB_SPORTS: Array<{ sportCode: string; sport: Sport; name: string }> = [
  { sportCode: 'football',           sport: 'soccer',            name: 'Football' },
  { sportCode: 'tennis',             sport: 'tennis',            name: 'Tennis' },
  { sportCode: 'basketball',         sport: 'basketball',        name: 'Basketball' },
  { sportCode: 'ice-hockey',         sport: 'hockey',            name: 'Ice Hockey' },
  { sportCode: 'baseball',           sport: 'baseball',          name: 'Baseball' },
  { sportCode: 'american-football',  sport: 'american_football', name: 'American Football' },
  { sportCode: 'cricket',            sport: 'cricket',           name: 'Cricket' },
  { sportCode: 'rugby-union',        sport: 'rugby',             name: 'Rugby Union' },
  { sportCode: 'mma',                sport: 'mma',               name: 'MMA' },
  { sportCode: 'golf',               sport: 'golf',              name: 'Golf' },
]

interface MBOdds { name: string; price?: number; odds?: number }
interface MBEvent {
  id?: string | number
  name?: string
  startDate?: string
  isLive?: boolean
  competition?: string | { name: string }
  markets?: Array<{
    name?: string
    type?: string
    odds?: MBOdds[]
    selections?: MBOdds[]
  }>
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' vs. ') ? ' vs. '
    : name.includes(' - ') ? ' - '
    : name.includes(' vs ') ? ' vs '
    : name.includes(' v ') ? ' v '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

async function fetchMBSport(sport: { sportCode: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('www.marathonbet.co.uk', 500)

  const url = `${BASE}/api/sports-lineup-by-sports/${sport.sportCode}?locale=en&count=50`
  const res = await safeFetch(url, {
    headers: {
      ...jsonHeaders('https://www.marathonbet.co.uk/'),
      'Accept': 'application/json',
    },
    timeoutMs: 15_000,
    label: `marathonbet:${sport.sportCode}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: MBEvent[] = data?.events ?? data?.items ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts = ev.markets ?? []
    const matchMkt = allMkts.find(m =>
      ['MATCH_RESULT', '1X2', 'WIN OR DRAW', 'MONEYLINE', 'MATCH_ODDS'].some(t =>
        (m.type ?? m.name ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    const sels: MBOdds[] = matchMkt?.odds ?? matchMkt?.selections ?? []
    if (sels.length >= 2) {
      const outcomes = sels.slice(0, 3)
        .map(s => ({ name: s.name, price: s.price ?? s.odds ?? 0 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt?.name || 'Match Result', outcomes })
      }
    }

    const compName = typeof ev.competition === 'string' ? ev.competition : ev.competition?.name

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'marathonbet', title: 'Marathonbet', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `mb_${ev.id ?? `${teams.home}_${teams.away}`}`,
      sport: sport.sport,
      sportTitle: compName ?? sport.name,
      league: compName ?? sport.name,
      commenceTime: ev.startDate ? new Date(ev.startDate).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getMarathonbetEvents(): Promise<Event[]> {
  const cacheKey = 'marathonbet_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    MB_SPORTS.map(s => fetchMBSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[marathonbet] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
