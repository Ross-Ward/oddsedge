/**
 * Ladbrokes UK Sportsbook — Entain/GVC group (same platform as Coral & bwin).
 *
 * Uses the same OpenBet SSViewer JSON API as Coral, with brand-specific base URL.
 *
 * Base: https://sports.ladbrokes.com
 * Same typeId structure as Coral.
 *
 * Odds: fractional → decimal.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sports.ladbrokes.com'

const LB_TYPES: Array<{ typeId: number; sport: Sport; name: string }> = [
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

function parseFractional(num: string | number, den: string | number): number {
  const n = parseFloat(String(num))
  const d = parseFloat(String(den))
  if (!d || isNaN(n) || isNaN(d)) return 0
  return parseFloat((1 + n / d).toFixed(3))
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v ' : name.includes(' vs ') ? ' vs ' : null
  if (!sep) return null
  const [home, away] = name.split(sep)
  return { home: home.trim(), away: away.trim() }
}

async function fetchLadbrokeType(type: { typeId: number; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.ladbrokes.com', 350)

  const nowTs = Date.now()
  const url = `${BASE}/openbet-ssviewer/json/v2.31/EventsForType/${type.typeId}?action=GetEventType&eventStatusId=1&simpleFilter=event.startTime:greaterThan:${nowTs}&translationLang=en&responseFormat=json&priceHistory=1&numMarkets=1`

  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.ladbrokes.com/'),
    timeoutMs: 12_000,
    label: `ladbrokes:${type.name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const typeChildren: any[] = data?.SSResponse?.children?.[0]?.type?.children ?? []

  return typeChildren.flatMap((child: any): Event[] => {
    const ev = child?.event
    if (!ev?.name) return []

    const teams = parseTeams(ev.name)
    if (!teams) return []

    const markets: any[] = child?.markets ?? []
    const matchMkt = markets.find((m: any) =>
      ['MATCH_BETTING', 'MATCH_RESULT', '1X2', 'MONEYLINE'].some(t =>
        (m?.type ?? m?.name ?? '').toUpperCase().includes(t)
      )
    ) ?? markets[0]

    const domMarkets: Market[] = []
    if (matchMkt?.outcomes?.length >= 2) {
      const outcomes = (matchMkt.outcomes as any[])
        .slice(0, 3)
        .map((o: any) => ({
          name: o.name ?? '',
          price: parseFractional(o.priceNum, o.priceDen),
        }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.name || 'Match Result', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'ladbrokes', title: 'Ladbrokes', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `lb_${ev.id}`,
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

export async function getLadbrokesEvents(): Promise<Event[]> {
  const cacheKey = 'ladbrokes_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    LB_TYPES.map(t => fetchLadbrokeType(t))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[ladbrokes] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
