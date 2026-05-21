/**
 * FanDuel Sportsbook — major US operator.
 *
 * FanDuel serves JSON from their sportsbook API to the web client
 * without requiring authentication.
 *
 * Endpoint: https://sbapi.{state}.sportsbook.fanduel.com/api/content-managed-page
 *   ?page=CUSTOM_COMPETITION&customPageId={id}&_ak=FhMFpcPWXMeyZxOx
 *
 * Alternative: https://sbapi.il.sportsbook.fanduel.com/api/sport-navigation
 *
 * Odds are American format → converted to decimal.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, americanToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

// FanDuel's public API key (embedded in their web app)
const AK = 'FhMFpcPWXMeyZxOx'
// Use the Illinois endpoint (accessible globally)
const BASE = 'https://sbapi.il.sportsbook.fanduel.com/api'

// FanDuel competition IDs for major leagues/sports
const FD_COMPETITIONS: Array<{ id: string; sport: Sport; name: string }> = [
  { id: '1000093656', sport: 'american_football', name: 'NFL' },
  { id: '1000093652', sport: 'basketball',        name: 'NBA' },
  { id: '1000093655', sport: 'baseball',          name: 'MLB' },
  { id: '1000093660', sport: 'hockey',            name: 'NHL' },
  { id: '1000116405', sport: 'soccer',            name: 'Premier League' },
  { id: '1000116417', sport: 'soccer',            name: 'Champions League' },
  { id: '1000116389', sport: 'soccer',            name: 'MLS' },
  { id: '1000093658', sport: 'mma',               name: 'UFC' },
  { id: '1000093651', sport: 'basketball',        name: 'NCAAB' },
  { id: '1000093653', sport: 'american_football', name: 'NCAAF' },
]

interface FDMarketRunner {
  runnerName: string
  winRunnerOdds?: {
    americanDisplayOdds?: { americanOdds: number }
    trueOdds?: number
  }
  handicap?: number
}

interface FDMarket {
  marketName: string
  marketType: string
  runners: FDMarketRunner[]
  inPlay?: boolean
}

interface FDEvent {
  eventId: number
  openDate?: string
  eventName?: string
  competitionName?: string
  markets?: FDMarket[]
  marketIds?: number[]
}

interface FDResponse {
  attachments?: {
    events?: Record<string, FDEvent>
    markets?: Record<string, FDMarket>
  }
  eventCount?: number
}

function parseEventTeams(name: string): { home: string; away: string } | null {
  if (name.includes(' @ ')) {
    const [away, home] = name.split(' @ ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' v ')) {
    const [home, away] = name.split(' v ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' vs ')) {
    const [home, away] = name.split(' vs ')
    return { home: home.trim(), away: away.trim() }
  }
  return null
}

function runnerToPrice(runner: FDMarketRunner): number {
  const american = runner.winRunnerOdds?.americanDisplayOdds?.americanOdds
  if (american != null) return americanToDecimal(american)
  const trueOdds = runner.winRunnerOdds?.trueOdds
  if (trueOdds && trueOdds > 1) return trueOdds
  return 0
}

async function fetchFDCompetition(comp: { id: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sbapi.il.sportsbook.fanduel.com', 300)

  // Try IL endpoint first, then NJ as fallback
  const urlIL = `${BASE}/content-managed-page?page=CUSTOM_COMPETITION&customPageId=${comp.id}&_ak=${AK}&timezone=Europe%2FLondon`
  const urlNJ = `https://sbapi.nj.sportsbook.fanduel.com/api/content-managed-page?page=CUSTOM_COMPETITION&customPageId=${comp.id}&_ak=${AK}&timezone=America%2FNew_York`

  let data: FDResponse | null = null
  for (const url of [urlIL, urlNJ]) {
    const res = await safeFetch(url, {
      headers: jsonHeaders('https://sportsbook.fanduel.com/'),
      timeoutMs: 15_000,
      label: `fanduel:${comp.name}`,
    })
    if (res?.ok) { data = await res.json().catch(() => null); if (data?.attachments) break }
  }
  if (!data?.attachments?.events) return []

  const events = Object.values(data.attachments.events)
  const markets = data.attachments.markets ?? {}

  return events.flatMap((ev): Event[] => {
    const teams = parseEventTeams(ev.eventName ?? '')
    if (!teams) return []

    // Scope markets to this event via marketIds if available
    const eventMarketSet = new Set((ev.marketIds ?? []).map(String))
    const evAllMkts: FDMarket[] = eventMarketSet.size > 0
      ? Object.entries(markets).filter(([id]) => eventMarketSet.has(id)).map(([, m]) => m)
      : Object.values(markets)

    // Find moneyline / match result market
    const matchMarket = evAllMkts.find((m: FDMarket) =>
      (m.marketType ?? '').toLowerCase().includes('moneyline') ||
      (m.marketType ?? '').toLowerCase().includes('match_result') ||
      (m.marketName ?? '').toLowerCase().includes('winner') ||
      (m.marketName ?? '').toLowerCase().includes('1x2')
    ) ?? evAllMkts[0]
    const domMarkets: Market[] = []

    if (matchMarket?.runners?.length >= 2) {
      const outcomes = matchMarket.runners
        .map(r => ({ name: r.runnerName, price: runnerToPrice(r) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMarket.marketName || 'Moneyline', outcomes })
      }
    }

    // Spread market
    const spreadMarket = evAllMkts.find((m: FDMarket) =>
      (m.marketType ?? '').toLowerCase().includes('spread') ||
      (m.marketName ?? '').toLowerCase().includes('spread') ||
      (m.marketName ?? '').toLowerCase().includes('handicap')
    )
    if (spreadMarket && spreadMarket.runners && spreadMarket.runners.length >= 2) {
      const outcomes = spreadMarket.runners
        .map(r => ({
          name: `${r.runnerName}${r.handicap != null ? ` (${r.handicap > 0 ? '+' : ''}${r.handicap})` : ''}`,
          price: runnerToPrice(r),
        }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'spreads', label: 'Spread', outcomes })
    }

    // Totals market
    const totalMarket = evAllMkts.find((m: FDMarket) =>
      (m.marketType ?? '').toLowerCase().includes('total') ||
      (m.marketName ?? '').toLowerCase().includes('over/under')
    )
    if (totalMarket && totalMarket.runners && totalMarket.runners.length >= 2) {
      const outcomes = totalMarket.runners
        .map(r => ({ name: r.runnerName, price: runnerToPrice(r) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'totals', label: 'Total', outcomes })
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'fanduel', title: 'FanDuel', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `fd_${ev.eventId}`,
      sport: comp.sport,
      sportTitle: ev.competitionName ?? comp.name,
      league: ev.competitionName ?? comp.name,
      commenceTime: ev.openDate ? new Date(ev.openDate).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: false,
      bookmakers,
    }]
  })
}

export async function getFanDuelEvents(): Promise<Event[]> {
  const cacheKey = 'fanduel_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    FD_COMPETITIONS.map(c => fetchFDCompetition(c))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[fanduel] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
