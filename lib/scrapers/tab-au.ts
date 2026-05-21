/**
 * TAB Australia — government-owned Australian totalisator agency.
 * Covers racing and sports betting across AU & NZ.
 *
 * TAB exposes a public REST API — no authentication required.
 *
 * Base: https://api.tab.com.au/v1/tab-info-service
 * Endpoint: GET /sports/{sport}/matches?jurisdiction=SA&returnOffers=true
 *
 * Sports: Soccer, Cricket, AFL, NRL, Rugby Union, Tennis, Basketball, Golf.
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://api.tab.com.au/v1/tab-info-service'

const TAB_SPORTS: Array<{ name: string; sport: Sport; sportTitle: string }> = [
  { name: 'Soccer',            sport: 'soccer',            sportTitle: 'Soccer' },
  { name: 'Cricket',           sport: 'cricket',           sportTitle: 'Cricket' },
  { name: 'Australian%20Rules', sport: 'rugby',            sportTitle: 'AFL' },
  { name: 'Rugby%20League',    sport: 'rugby',             sportTitle: 'NRL' },
  { name: 'Rugby%20Union',     sport: 'rugby',             sportTitle: 'Rugby Union' },
  { name: 'Tennis',            sport: 'tennis',            sportTitle: 'Tennis' },
  { name: 'Basketball',        sport: 'basketball',        sportTitle: 'Basketball' },
  { name: 'American%20Football', sport: 'american_football', sportTitle: 'NFL/NCAAF' },
  { name: 'Ice%20Hockey',        sport: 'hockey',            sportTitle: 'Ice Hockey' },
  { name: 'Golf',                sport: 'golf',              sportTitle: 'Golf' },
]

interface TABContestant { name: string; returnWin?: number; winOdds?: number; number?: number }
interface TABMeeting {
  name?: string
  startTime?: string
  isLive?: boolean
  competition?: { competitionName: string }
  markets?: Array<{
    betOption?: string
    contestants?: TABContestant[]
  }>
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

async function fetchTABSport(sport: { name: string; sport: Sport; sportTitle: string }): Promise<Event[]> {
  await rateLimit('api.tab.com.au', 500)

  const url = `${BASE}/sports/${sport.name}/matches?jurisdiction=SA&returnOffers=true`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.tab.com.au/'),
    timeoutMs: 12_000,
    label: `tab:${sport.name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const meetings: TABMeeting[] = data?.matches ?? data?.meetings ?? []

  return meetings.flatMap((m): Event[] => {
    const teams = parseTeams(m.name ?? '')
    if (!teams) return []

    const mkt = (m.markets ?? []).find(mk =>
      ['HEAD_TO_HEAD', 'H2H', 'WIN', 'MATCH_ODDS'].some(t =>
        (mk.betOption ?? '').toUpperCase().includes(t)
      )
    ) ?? m.markets?.[0]

    const domMarkets: Market[] = []
    if (mkt?.contestants && mkt.contestants.length >= 2) {
      const outcomes = mkt.contestants.slice(0, 3).map((c: TABContestant) => ({
        name: c.name,
        price: c.returnWin ?? c.winOdds ?? 0,
      })).filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: mkt.betOption || 'Head to Head', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'tab_au', title: 'TAB', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `tab_${teams.home}_${teams.away}`.replace(/\s/g, '_').toLowerCase(),
      sport: sport.sport,
      sportTitle: m.competition?.competitionName ?? sport.sportTitle,
      league: m.competition?.competitionName ?? sport.sportTitle,
      commenceTime: m.startTime ? new Date(m.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: m.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getTABAUEvents(): Promise<Event[]> {
  const cacheKey = 'tab_au_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    TAB_SPORTS.map(s => fetchTABSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[tab-au] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
