/**
 * Betfred Sportsbook — UK's largest independent bookmaker.
 *
 * Betfred uses the SBTech platform (same family as Sky Bet).
 * Their public API is accessible without auth.
 *
 * Base: https://www.betfred.com
 * Endpoint: GET https://www.betfred.com/sports-api/sports/{sport}/markets?type=MATCH_ODDS&limit=20
 *
 * Odds: fractional → decimal.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, fractionalToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.betfred.com/sports-api'

const BF_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'football',           sport: 'soccer',            name: 'Football' },
  { slug: 'tennis',             sport: 'tennis',            name: 'Tennis' },
  { slug: 'cricket',            sport: 'cricket',           name: 'Cricket' },
  { slug: 'basketball',         sport: 'basketball',        name: 'Basketball' },
  { slug: 'american-football',  sport: 'american_football', name: 'American Football' },
  { slug: 'ice-hockey',         sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'rugby-union',        sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'mma',                sport: 'mma',               name: 'MMA' },
  { slug: 'golf',               sport: 'golf',              name: 'Golf' },
  { slug: 'baseball',           sport: 'baseball',          name: 'Baseball' },
]

interface BFSel { name: string; odds?: string; decimalOdds?: number }
interface BFMkt { type: string; name?: string; selections?: BFSel[] }
interface BFEvent {
  id?: string | number
  name?: string
  startTime?: string
  isLive?: boolean
  competition?: { name: string }
  markets?: BFMkt[]
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : name.includes(' @ ') ? ' @ '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return sep === ' @ ' ? { home: b.trim(), away: a.trim() } : { home: a.trim(), away: b.trim() }
}

function selPrice(sel: BFSel): number {
  if (sel.decimalOdds && sel.decimalOdds > 1) return sel.decimalOdds
  if (sel.odds?.includes('/')) return fractionalToDecimal(sel.odds)
  return parseFloat(sel.odds ?? '0') || 0
}

async function fetchBetfredSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('www.betfred.com', 400)

  const endpoints = [
    `${BASE}/sports/${sport.slug}/markets?type=MATCH_ODDS&limit=50&timeFilter=UPCOMING_24H`,
    `${BASE}/sports/${sport.slug}/events?limit=50&status=UPCOMING`,
  ]

  let data: any = null
  for (const url of endpoints) {
    const res = await safeFetch(url, {
      headers: jsonHeaders('https://www.betfred.com/'),
      timeoutMs: 12_000,
      label: `betfred:${sport.slug}`,
    })
    if (res?.ok) { data = await res.json().catch(() => null); if (data) break }
  }
  if (!data) return []

  const raw: BFEvent[] = data?.events ?? data?.data?.events ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: BFMkt[] = ev.markets ?? []
    const matchMkt = allMkts.find(m =>
      ['MATCH_ODDS', 'MATCH_BETTING', 'MATCH_RESULT', '1X2', 'MONEYLINE'].some(t =>
        (m.type ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    if (matchMkt?.selections && matchMkt.selections.length >= 2) {
      const outcomes = matchMkt.selections.slice(0, 3)
        .map(s => ({ name: s.name, price: selPrice(s) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.name || 'Match Result', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'betfred', title: 'Betfred', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `bf_${ev.id ?? `${teams.home}_${teams.away}`}`,
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

export async function getBetfredEvents(): Promise<Event[]> {
  const cacheKey = 'betfred_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    BF_SPORTS.map(s => fetchBetfredSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[betfred] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
