/**
 * Sportsbet Australia — Australia's largest online bookmaker.
 *
 * Sportsbet exposes a public REST API backing their web and mobile apps.
 * No authentication required.
 *
 * Base: https://www.sportsbet.com.au/apigw/sportsbook-sports/Sportsbook
 * Key endpoint:
 *   GET /Sports/Events/{sportId}/SportMatches/Filter/0/20
 *   GET /Sports/NextToGo/20
 *
 * Australian sport coverage: AFL, NRL, Cricket, Horse Racing, Soccer, NBA, NFL.
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.sportsbet.com.au/apigw/sportsbook-sports/Sportsbook'

// Sportsbet AU internal sport IDs
const SB_SPORTS: Array<{ sportId: number; sport: Sport; name: string }> = [
  { sportId: 7,   sport: 'rugby',             name: 'AFL' },     // AFL = 7
  { sportId: 8,   sport: 'rugby',             name: 'NRL' },     // NRL = 8
  { sportId: 5,   sport: 'cricket',           name: 'Cricket' }, // Cricket = 5
  { sportId: 1,   sport: 'soccer',            name: 'Soccer' },  // Soccer = 1
  { sportId: 12,  sport: 'basketball',        name: 'Basketball (NBA)' },
  { sportId: 15,  sport: 'american_football', name: 'American Football (NFL)' },
  { sportId: 3,   sport: 'rugby',             name: 'Rugby Union' },
  { sportId: 14,  sport: 'tennis',            name: 'Tennis' },
]

interface SBSel { displayName: string; winOdds?: number; returnWin?: number }
interface SBMkt {
  displayName?: string
  marketTypeCode?: string
  propositions?: SBSel[]
}
interface SBEvent {
  id?: number
  name?: string
  startDateTime?: string
  inRunning?: boolean
  competitionName?: string
  markets?: SBMkt[]
  childMarketsCount?: number
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

async function fetchSBSport(sportMeta: { sportId: number; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('www.sportsbet.com.au', 400)

  const url = `${BASE}/Sports/Events/${sportMeta.sportId}/SportMatches/Filter/0/50`
  const res = await safeFetch(url, {
    headers: {
      ...jsonHeaders('https://www.sportsbet.com.au/'),
      'X-SB-ClientConfig': 'au',
    },
    timeoutMs: 12_000,
    label: `sportsbet:${sportMeta.name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: SBEvent[] = data ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: SBMkt[] = ev.markets ?? []
    const matchMkt = allMkts.find(m =>
      ['HEAD_TO_HEAD', 'MATCH_ODDS', 'MATCH_RESULT', 'WIN'].some(t =>
        (m.marketTypeCode ?? m.displayName ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    if (matchMkt?.propositions && matchMkt.propositions.length >= 2) {
      const outcomes = matchMkt.propositions.slice(0, 3)
        .map((s: SBSel) => ({
          name: s.displayName,
          price: s.winOdds ?? s.returnWin ?? 0,
        }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.displayName || 'Head to Head', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'sportsbet_au', title: 'Sportsbet', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `sbau_${ev.id ?? `${teams.home}_${teams.away}`}`,
      sport: sportMeta.sport,
      sportTitle: ev.competitionName ?? sportMeta.name,
      league: ev.competitionName ?? sportMeta.name,
      commenceTime: ev.startDateTime ? new Date(ev.startDateTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.inRunning ?? false,
      bookmakers,
    }]
  })
}

export async function getSportsbetAUEvents(): Promise<Event[]> {
  const cacheKey = 'sportsbet_au_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    SB_SPORTS.map(s => fetchSBSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[sportsbet-au] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
