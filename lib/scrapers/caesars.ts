/**
 * Caesars Sportsbook — formerly William Hill US (acquired 2021).
 *
 * Caesars uses the former William Hill US platform (GAN/OpenBet).
 * Their public API endpoint is accessible without authentication.
 *
 * Base: https://api.ia.sportsbook.caesars.com/v3
 * Endpoint: GET /categories/{sportCode}/events?page=1&limit=30
 *
 * Odds: American → decimal.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, americanToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://api.ia.sportsbook.caesars.com/v3'

const CZ_SPORTS: Array<{ code: string; sport: Sport; name: string }> = [
  { code: 'americanfootball', sport: 'american_football', name: 'NFL' },
  { code: 'basketball',       sport: 'basketball',        name: 'NBA' },
  { code: 'baseball',         sport: 'baseball',          name: 'MLB' },
  { code: 'icehockey',        sport: 'hockey',            name: 'NHL' },
  { code: 'soccer',           sport: 'soccer',            name: 'Soccer' },
  { code: 'tennis',           sport: 'tennis',            name: 'Tennis' },
  { code: 'mma',              sport: 'mma',               name: 'MMA/UFC' },
  { code: 'boxing',           sport: 'mma',               name: 'Boxing' },
  { code: 'golf',             sport: 'golf',              name: 'Golf' },
  { code: 'rugbyunion',       sport: 'rugby',             name: 'Rugby Union' },
  { code: 'cricket',          sport: 'cricket',           name: 'Cricket' },
]

interface CZOdds { american: number; decimal?: number }
interface CZSel { name: string; price?: CZOdds; odds?: CZOdds }
interface CZMkt { type?: string; name?: string; selections?: CZSel[]; runners?: CZSel[] }
interface CZEvent {
  id?: string
  name?: string
  startTime?: string
  isLive?: boolean
  competition?: { name: string }
  markets?: CZMkt[]
}

function parseTeams(name: string): { home: string; away: string } | null {
  if (name.includes(' @ ')) {
    const [away, home] = name.split(' @ ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' vs. ')) {
    const [a, b] = name.split(' vs. ')
    return { home: a.trim(), away: b.trim() }
  }
  if (name.includes(' vs ')) {
    const [a, b] = name.split(' vs ')
    return { home: a.trim(), away: b.trim() }
  }
  if (name.includes(' v ')) {
    const [a, b] = name.split(' v ')
    return { home: a.trim(), away: b.trim() }
  }
  return null
}

function czPrice(sel: CZSel): number {
  const odds = sel.price ?? sel.odds
  if (!odds) return 0
  if (odds.decimal && odds.decimal > 1) return odds.decimal
  return americanToDecimal(odds.american)
}

async function fetchCaesarsSport(sport: { code: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('api.ia.sportsbook.caesars.com', 400)

  const url = `${BASE}/categories/${sport.code}/events?page=1&limit=100&status=PRE`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sportsbook.caesars.com/'),
    timeoutMs: 12_000,
    label: `caesars:${sport.code}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: CZEvent[] = data?.events ?? data?.data ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: CZMkt[] = ev.markets ?? []
    const matchMkt = allMkts.find(m =>
      ['MONEYLINE', 'MATCH_RESULT', '1X2', 'WIN'].some(t =>
        (m.type ?? m.name ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    const sels: CZSel[] = matchMkt?.selections ?? matchMkt?.runners ?? []
    if (sels.length >= 2) {
      const outcomes = sels.slice(0, 3)
        .map(s => ({ name: s.name, price: czPrice(s) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt?.name || 'Moneyline', outcomes })
      }
    }

    // Spread market
    const spreadMkt = allMkts.find(m =>
      ['SPREAD', 'HANDICAP', 'POINT_SPREAD', 'RUNLINE'].some(t =>
        (m.type ?? m.name ?? '').toUpperCase().includes(t)
      )
    )
    const spreadSels: CZSel[] = spreadMkt?.selections ?? spreadMkt?.runners ?? []
    if (spreadSels.length >= 2) {
      const outcomes = spreadSels.slice(0, 2)
        .map(s => ({ name: s.name, price: czPrice(s) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'spreads', label: spreadMkt?.name || 'Spread', outcomes })
    }

    // Totals market
    const totalMkt = allMkts.find(m =>
      ['TOTAL', 'OVER_UNDER', 'OVER/UNDER'].some(t =>
        (m.type ?? m.name ?? '').toUpperCase().includes(t)
      )
    )
    const totalSels: CZSel[] = totalMkt?.selections ?? totalMkt?.runners ?? []
    if (totalSels.length >= 2) {
      const outcomes = totalSels.slice(0, 2)
        .map(s => ({ name: s.name, price: czPrice(s) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'totals', label: totalMkt?.name || 'Total', outcomes })
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'caesars', title: 'Caesars', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `cz_${ev.id ?? `${teams.home}_${teams.away}`}`,
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

export async function getCaesarsEvents(): Promise<Event[]> {
  const cacheKey = 'caesars_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    CZ_SPORTS.map(s => fetchCaesarsSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[caesars] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
