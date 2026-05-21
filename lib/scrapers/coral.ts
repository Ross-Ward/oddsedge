/**
 * Coral Sportsbook — major UK bookmaker (Entain/GVC group).
 *
 * Coral uses the Entain REST API platform (same base as Ladbrokes & bwin).
 * Public API, no auth required — used by the Coral mobile web app.
 *
 * Base: https://sports.coral.co.uk
 * Endpoint: GET /openbet-ssviewer/json/v2.31/EventsForType/{typeId}?action=GetEventType&eventStatusId=1&simpleFilter=event.startTime:greaterThan:{timestamp}
 *
 * Odds format: fractional (numerator/denominator) → converted to decimal.
 *
 * Coral typeIds for major competitions:
 *   442 = Premier League, 29 = Champions League, 36 = La Liga,
 *   2013 = NFL, 2014 = NBA, 2012 = MLB, 2015 = NHL
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, fractionalToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sports.coral.co.uk'

const CORAL_TYPES: Array<{ typeId: number; sport: Sport; name: string }> = [
  { typeId: 442,  sport: 'soccer',            name: 'Premier League' },
  { typeId: 444,  sport: 'soccer',            name: 'Championship' },
  { typeId: 29,   sport: 'soccer',            name: 'Champions League' },
  { typeId: 30,   sport: 'soccer',            name: 'Europa League' },
  { typeId: 36,   sport: 'soccer',            name: 'La Liga' },
  { typeId: 44,   sport: 'soccer',            name: 'Bundesliga' },
  { typeId: 46,   sport: 'soccer',            name: 'Serie A' },
  { typeId: 47,   sport: 'soccer',            name: 'Ligue 1' },
  { typeId: 2013, sport: 'american_football', name: 'NFL' },
  { typeId: 2014, sport: 'basketball',        name: 'NBA' },
  { typeId: 2012, sport: 'baseball',          name: 'MLB' },
  { typeId: 2015, sport: 'hockey',            name: 'NHL' },
  { typeId: 7,    sport: 'tennis',            name: 'Tennis' },
  { typeId: 5,    sport: 'cricket',           name: 'Cricket' },
  { typeId: 6,    sport: 'rugby',             name: 'Rugby Union' },
  { typeId: 4,    sport: 'rugby',             name: 'Rugby League' },
]

interface CoralOutcome {
  id: string
  name: string
  priceNum: string | number
  priceDen: string | number
  priceDecimal?: number
}

interface CoralMarket {
  id: string
  name: string
  type?: string
  outcomes?: CoralOutcome[]
}

interface CoralEvent {
  id: string
  name?: string
  startTime?: string
  isLive?: boolean
  categoryName?: string
  className?: string
  typeName?: string
  markets?: CoralMarket[]
}

function coralOdds(num: string | number, den: string | number, dec?: number): number {
  if (dec && dec > 1) return dec
  const n = parseInt(String(num), 10)
  const d = parseInt(String(den), 10)
  if (!d || isNaN(n) || isNaN(d)) return 0
  return parseFloat((1 + n / d).toFixed(3))
}

function parseCoralTeams(name: string): { home: string; away: string } | null {
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

async function fetchCoralType(type: { typeId: number; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.coral.co.uk', 350)

  const nowTs = Date.now()
  const url = `${BASE}/openbet-ssviewer/json/v2.31/EventsForType/${type.typeId}?action=GetEventType&eventStatusId=1&simpleFilter=event.startTime:greaterThan:${nowTs}&translationLang=en&responseFormat=json&priceHistory=1&numMarkets=1`

  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.coral.co.uk/'),
    timeoutMs: 12_000,
    label: `coral:${type.name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  // OpenBet returns { SSResponse: { children: [{ type: { children: [{ event: {...}, markets: [...] }] } }] } }
  const typeChildren: any[] = data?.SSResponse?.children?.[0]?.type?.children ?? []

  return typeChildren.flatMap((child: any): Event[] => {
    const ev: CoralEvent = child?.event
    if (!ev) return []

    const teams = parseCoralTeams(ev.name ?? '')
    if (!teams) return []

    const coralMarkets: CoralMarket[] = child?.markets ?? ev.markets ?? []
    const matchMarket = coralMarkets.find(m =>
      ['MATCH_BETTING', 'MATCH_RESULT', '1X2', 'MONEYLINE'].some(t =>
        (m.type ?? m.name ?? '').toUpperCase().includes(t)
      )
    ) ?? coralMarkets[0]

    const domMarkets: Market[] = []
    if (matchMarket && matchMarket.outcomes && matchMarket.outcomes.length >= 2) {
      const outcomes = matchMarket.outcomes
        .slice(0, 3)
        .map(o => ({
          name: o.name,
          price: coralOdds(o.priceNum, o.priceDen, o.priceDecimal),
        }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMarket.name || 'Match Result', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'coral', title: 'Coral', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `co_${ev.id}`,
      sport: type.sport,
      sportTitle: type.name,
      league: type.name,
      commenceTime: ev.startTime ? new Date(parseInt(ev.startTime, 10)).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getCoralEvents(): Promise<Event[]> {
  const cacheKey = 'coral_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    CORAL_TYPES.map(t => fetchCoralType(t))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[coral] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
