/**
 * Ladbrokes Australia — major Australian bookmaker (different entity from UK Ladbrokes).
 *
 * AU Ladbrokes uses an API based on the Racing.com / Neds infrastructure.
 * No authentication required.
 *
 * Base: https://api.ladbrokes.com.au/v2/sport
 * Endpoint: GET /competition?sport={sport}&betType=WIN&limit=20
 *
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://api.ladbrokes.com.au/v2/sport'

const LBAU_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'Soccer',              sport: 'soccer',            name: 'Soccer' },
  { slug: 'AFL',                 sport: 'rugby',             name: 'AFL' },
  { slug: 'NRL',                 sport: 'rugby',             name: 'NRL' },
  { slug: 'Cricket',             sport: 'cricket',           name: 'Cricket' },
  { slug: 'Tennis',              sport: 'tennis',            name: 'Tennis' },
  { slug: 'Basketball',          sport: 'basketball',        name: 'Basketball' },
  { slug: 'Rugby_Union',         sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'American_Football',   sport: 'american_football', name: 'American Football' },
  { slug: 'Ice_Hockey',          sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'Golf',                sport: 'golf',              name: 'Golf' },
  { slug: 'MMA',                 sport: 'mma',               name: 'MMA' },
]

interface LBAUEntrant { name: string; returnWin?: number; price?: number }
interface LBAUMkt { betType?: string; name?: string; entrants?: LBAUEntrant[] }
interface LBAUEvent {
  id?: string | number
  name?: string
  startTime?: string
  isLive?: boolean
  competition?: string
  markets?: LBAUMkt[]
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

async function fetchLBAUSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('api.ladbrokes.com.au', 400)

  const url = `${BASE}/competition?sport=${sport.slug}&betType=WIN&limit=50`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.ladbrokes.com.au/'),
    timeoutMs: 12_000,
    label: `ladbrokes-au:${sport.slug}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: LBAUEvent[] = data?.events ?? data?.competitions?.flatMap((c: any) => c.events ?? []) ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: LBAUMkt[] = ev.markets ?? []
    const matchMkt = allMkts.find(m =>
      ['HEAD_TO_HEAD', 'H2H', 'WIN', 'MATCH_ODDS', 'RESULT'].some(t =>
        (m.betType ?? m.name ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    if (matchMkt?.entrants && matchMkt.entrants.length >= 2) {
      const outcomes = matchMkt.entrants.slice(0, 3)
        .map((e: LBAUEntrant) => ({
          name: e.name,
          price: e.returnWin ?? e.price ?? 0,
        }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.name || 'Head to Head', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'ladbrokes_au', title: 'Ladbrokes AU', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `lbau_${ev.id ?? `${teams.home}_${teams.away}`}`,
      sport: sport.sport,
      sportTitle: ev.competition ?? sport.name,
      league: ev.competition ?? sport.name,
      commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getLadbrokesAUEvents(): Promise<Event[]> {
  const cacheKey = 'ladbrokes_au_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    LBAU_SPORTS.map(s => fetchLBAUSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[ladbrokes-au] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
