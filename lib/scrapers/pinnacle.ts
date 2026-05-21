/**
 * Pinnacle Sports — the world's sharpest bookmaker.
 * Pinnacle offers a public guest API with NO authentication required.
 *
 * Guest endpoint base: https://guest.api.arcadia.pinnacle.com/0.1
 *
 * NOTE: The /leagues?sportId= endpoint returns HTTP 204 (geo-restricted for
 * our server location). We use hardcoded league IDs verified to be accessible.
 *
 * Markets use American odds: -200 => 1.500 decimal, +150 => 2.500 decimal.
 * Market keys: s;0;m = full-game moneyline, s;0;ou;X = over/under, s;0;s;X = spread.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://guest.api.arcadia.pinnacle.com/0.1'

/** Leagues verified accessible without auth (other sport leagues return 401) */
const PINNACLE_LEAGUES: Array<{ id: number; name: string; sport: Sport }> = [
  // Soccer
  { id: 1980, name: 'England - Premier League',    sport: 'soccer' },
  { id: 1928, name: 'Scotland - Premiership',      sport: 'soccer' },
  { id: 1517, name: 'UEFA Champions League',       sport: 'soccer' },
  { id: 1845, name: 'Germany - Bundesliga',        sport: 'soccer' },
  { id: 2663, name: 'USA - MLS',                   sport: 'soccer' },
  // American Football
  { id: 889,  name: 'NFL',                         sport: 'american_football' },
  // Ice Hockey
  { id: 1456, name: 'NHL',                         sport: 'hockey' },
  // Tennis
  { id: 2627, name: 'WTA',                         sport: 'tennis' },
]

interface PinnacleParent {
  id: number
  participants: Array<{
    alignment: 'home' | 'away' | 'neutral'
    name: string
    id?: number
    order: number
  }>
  startTime: string
  isLive?: boolean
  hasMarkets?: boolean
}

interface PinnacleMatchup {
  id: number
  type: 'special' | 'matchup'
  parentId?: number
  parent?: PinnacleParent
  participants: Array<{ alignment: string; name: string; id?: number; order: number }>
  startTime?: string
  league?: { name: string; sport?: { name: string } }
  isLive?: boolean
}

interface PinnaclePrice {
  designation?: 'home' | 'away' | 'draw' | 'over' | 'under'
  participantId?: number
  price: number
  points?: number
}

interface PinnacleMarket {
  matchupId: number
  key: string
  period: number
  prices: PinnaclePrice[]
  cutoffAt?: string
}

/** Convert American odds integer to decimal odds */
function americanToDecimal(american: number): number {
  if (american === 0) return 1
  if (american < 0) return parseFloat((1 + 100 / Math.abs(american)).toFixed(3))
  return parseFloat((1 + american / 100).toFixed(3))
}

/**
 * Fetch matchups for a league. Returns a Map of parentId to parent game data.
 * The actual game matchups are exposed only through the `parent` field
 * of their child/special matchups in the response.
 */
async function fetchParentGames(leagueId: number): Promise<Map<number, PinnacleParent>> {
  await rateLimit('guest.api.arcadia.pinnacle.com', 250)
  const res = await safeFetch(`${BASE}/leagues/${leagueId}/matchups?brandId=0`, {
    headers: jsonHeaders('https://www.pinnacle.com/'),
    timeoutMs: 12_000,
    label: `pinnacle:matchups:${leagueId}`,
  })
  if (!res?.ok) {
    console.warn(`[pinnacle] matchups ${leagueId} returned ${res?.status}`)
    return new Map()
  }
  const data: PinnacleMatchup[] | null = await res.json().catch((e) => {
    console.warn(`[pinnacle] matchups ${leagueId} JSON parse failed: ${e.message}`)
    return null
  })
  if (!Array.isArray(data)) {
    console.warn(`[pinnacle] matchups ${leagueId} not array: ${typeof data}`)
    return new Map()
  }

  const parents = new Map<number, PinnacleParent>()
  for (const m of data) {
    if (!m.parentId || !m.parent) continue
    if (parents.has(m.parentId)) continue
    const p = m.parent
    const hasHome = p.participants.some(pp => pp.alignment === 'home')
    const hasAway = p.participants.some(pp => pp.alignment === 'away')
    if (hasHome && hasAway) {
      parents.set(m.parentId, p)
    }
  }
  return parents
}

async function fetchMarkets(leagueId: number): Promise<PinnacleMarket[]> {
  await rateLimit('guest.api.arcadia.pinnacle.com', 250)
  const res = await safeFetch(`${BASE}/leagues/${leagueId}/markets/straight`, {
    headers: jsonHeaders('https://www.pinnacle.com/'),
    timeoutMs: 12_000,
    label: `pinnacle:markets:${leagueId}`,
  })
  if (!res?.ok) return []
  const data: PinnacleMarket[] | null = await res.json().catch(() => null)
  return Array.isArray(data) ? data : []
}

async function fetchLeagueEvents(
  league: { id: number; name: string; sport: Sport },
): Promise<Event[]> {
  const [parents, markets] = await Promise.all([
    fetchParentGames(league.id),
    fetchMarkets(league.id),
  ])
  if (parents.size === 0) return []

  // Index full-game (period === 0) markets by matchupId
  const oddsMap = new Map<number, PinnacleMarket[]>()
  for (const mkt of markets) {
    if (mkt.period !== 0) continue
    const arr = oddsMap.get(mkt.matchupId) ?? []
    arr.push(mkt)
    oddsMap.set(mkt.matchupId, arr)
  }

  const events: Event[] = []

  for (const [parentId, game] of parents) {
    const home = game.participants.find(p => p.alignment === 'home')
    const away = game.participants.find(p => p.alignment === 'away')
    if (!home || !away) continue

    const matchMarkets = oddsMap.get(parentId) ?? []
    const domMarkets: Market[] = []

    // ── Moneyline (key: s;0;m) ──
    const mlMkt = matchMarkets.find(m => m.key === 's;0;m')
    if (mlMkt) {
      const homeP = mlMkt.prices.find(p => p.designation === 'home')
      const awayP = mlMkt.prices.find(p => p.designation === 'away')
      const drawP = mlMkt.prices.find(p => p.designation === 'draw')
      const outcomes = [
        homeP ? { name: home.name, price: americanToDecimal(homeP.price) } : null,
        drawP ? { name: 'Draw',    price: americanToDecimal(drawP.price) } : null,
        awayP ? { name: away.name, price: americanToDecimal(awayP.price) } : null,
      ].filter((o): o is { name: string; price: number } => o !== null && o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: 'Moneyline', outcomes })
      }
    }

    // ── Over/Under totals (key: s;0;ou;X) ──
    const totalMkt = matchMarkets.find(m => m.key.startsWith('s;0;ou;'))
    if (totalMkt) {
      const overP  = totalMkt.prices.find(p => p.designation === 'over')
      const underP = totalMkt.prices.find(p => p.designation === 'under')
      if (overP && underP) {
        const line = totalMkt.key.split(';')[3] ?? ''
        domMarkets.push({
          key: 'totals',
          label: `Total ${line}`.trim(),
          outcomes: [
            { name: `Over ${line}`.trim(),  price: americanToDecimal(overP.price) },
            { name: `Under ${line}`.trim(), price: americanToDecimal(underP.price) },
          ],
        })
      }
    }

    // ── Spread/handicap (key: s;0;s;X) — pick line closest to 0 ──
    const spreadMkts = matchMarkets.filter(m => m.key.startsWith('s;0;s;'))
    const spreadMkt  = spreadMkts.sort(
      (a, b) =>
        Math.abs(parseFloat(a.key.split(';')[3] ?? '9')) -
        Math.abs(parseFloat(b.key.split(';')[3] ?? '9')),
    )[0]
    if (spreadMkt) {
      const homeP = spreadMkt.prices.find(p => p.designation === 'home')
      const awayP = spreadMkt.prices.find(p => p.designation === 'away')
      if (homeP && awayP) {
        const hPts = homeP.points ?? 0
        const aPts = awayP.points ?? 0
        domMarkets.push({
          key: 'spreads',
          label: 'Spread',
          outcomes: [
            { name: `${home.name} ${hPts >= 0 ? '+' : ''}${hPts}`, price: americanToDecimal(homeP.price) },
            { name: `${away.name} ${aPts >= 0 ? '+' : ''}${aPts}`, price: americanToDecimal(awayP.price) },
          ],
        })
      }
    }

    if (domMarkets.length === 0) continue

    events.push({
      id: `pn_${parentId}`,
      sport: league.sport,
      sportTitle: league.name,
      league: league.name,
      commenceTime: new Date(game.startTime).toISOString(),
      homeTeam: home.name,
      awayTeam: away.name,
      isLive: game.isLive ?? false,
      bookmakers: [{
        key: 'pinnacle',
        title: 'Pinnacle',
        lastUpdate: new Date().toISOString(),
        markets: domMarkets,
      }],
    })
  }
  return events
}

export async function getPinnacleEvents(): Promise<Event[]> {
  const cacheKey = 'pinnacle_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    PINNACLE_LEAGUES.map(l => fetchLeagueEvents(l))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[pinnacle] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
