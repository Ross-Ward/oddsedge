/**
 * bwin Sportsbook — Entain/GVC group (EU-facing brand).
 *
 * bwin uses a different API from Coral/Ladbrokes — their own JSON API
 * accessible at api.bwin.com with no authentication.
 *
 * Endpoints:
 *   GET https://sports.bwin.com/en/sports/api/widgets/prematch-event-list?sportId={id}&regionId={id}&leagueId={id}&count=20
 *   GET https://sports.bwin.com/en/sports/api/catalog/sport/{sportId}/competitions
 *
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sports.bwin.com/en/sports/api'

// bwin sport IDs
const BWIN_SPORTS: Array<{ sportId: number; sport: Sport; name: string }> = [
  { sportId: 4,   sport: 'soccer',            name: 'Football' },
  { sportId: 7,   sport: 'basketball',        name: 'Basketball' },
  { sportId: 5,   sport: 'tennis',            name: 'Tennis' },
  { sportId: 12,  sport: 'hockey',            name: 'Ice Hockey' },
  { sportId: 16,  sport: 'baseball',          name: 'Baseball' },
  { sportId: 11,  sport: 'american_football', name: 'American Football' },
  { sportId: 8,   sport: 'cricket',           name: 'Cricket' },
  { sportId: 9,   sport: 'rugby',             name: 'Rugby' },
  { sportId: 17,  sport: 'mma',               name: 'MMA/Boxing' },
]

interface BwinSelection {
  id: number
  name: { value: string }
  odds: number
}

interface BwinMarket {
  id: number
  name: { value: string }
  templateCategory?: { name: { value: string } }
  selections: BwinSelection[]
}

interface BwinEvent {
  id: number
  name: { value: string }
  startDate: string
  isLive?: boolean
  regionName?: { value: string }
  leagueName?: { value: string }
  markets?: BwinMarket[]
}

function parseBwinTeams(name: string): { home: string; away: string } | null {
  if (name.includes(' - ')) {
    const [home, away] = name.split(' - ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' vs ')) {
    const [home, away] = name.split(' vs ')
    return { home: home.trim(), away: away.trim() }
  }
  return null
}

async function fetchBwinSport(sportMeta: { sportId: number; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.bwin.com', 400)

  const url = `${BASE}/catalog/sport/${sportMeta.sportId}/regions?maxLeagueCount=3&lang=en`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.bwin.com/'),
    timeoutMs: 12_000,
    label: `bwin:${sportMeta.name}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const regions: any[] = data?.regions ?? data ?? []

  // Get top leagues from all regions
  const topLeagueIds: number[] = []
  for (const region of regions) {
    for (const league of (region.leagues ?? []).slice(0, 5)) {
      if (league?.id) topLeagueIds.push(league.id)
    }
  }

  if (topLeagueIds.length === 0) return []

  const allEvents: Event[] = []
  for (const leagueId of topLeagueIds) {
    await rateLimit('sports.bwin.com', 300)
    const evUrl = `${BASE}/widgets/prematch-event-list?sportId=${sportMeta.sportId}&leagueId=${leagueId}&count=30&lang=en`
    const evRes = await safeFetch(evUrl, {
      headers: jsonHeaders('https://sports.bwin.com/'),
      timeoutMs: 10_000,
      label: `bwin:events:${leagueId}`,
    })
    if (!evRes?.ok) continue

    const evData = await evRes.json().catch(() => null)
    const rawEvents: BwinEvent[] = evData?.events ?? evData?.items ?? []

    for (const ev of rawEvents) {
      const name = ev.name?.value ?? ''
      const teams = parseBwinTeams(name)
      if (!teams) continue

      const matchMkt = (ev.markets ?? []).find((m: BwinMarket) =>
        ['1X2', 'MATCH_RESULT', 'MONEYLINE', 'WINNER'].some(t =>
          (m.templateCategory?.name.value ?? m.name.value ?? '').toUpperCase().includes(t)
        )
      ) ?? ev.markets?.[0]

      const domMarkets: Market[] = []
      if (matchMkt && matchMkt.selections && matchMkt.selections.length >= 2) {
        const outcomes = matchMkt.selections
          .slice(0, 3)
          .map((s: BwinSelection) => ({ name: s.name.value, price: s.odds }))
          .filter((o: { name: string; price: number }) => o.price > 1)
        if (outcomes.length >= 2) {
          domMarkets.push({ key: 'h2h', label: matchMkt.name.value || 'Match Result', outcomes })
        }
      }

      const bookmakers: BookmakerOdds[] = domMarkets.length > 0
        ? [{ key: 'bwin', title: 'bwin', lastUpdate: new Date().toISOString(), markets: domMarkets }]
        : []

      allEvents.push({
        id: `bw_${ev.id}`,
        sport: sportMeta.sport,
        sportTitle: ev.leagueName?.value ?? sportMeta.name,
        league: ev.leagueName?.value ?? sportMeta.name,
        commenceTime: new Date(ev.startDate).toISOString(),
        homeTeam: teams.home,
        awayTeam: teams.away,
        isLive: ev.isLive ?? false,
        bookmakers,
      })
    }
  }

  return allEvents
}

export async function getBwinEvents(): Promise<Event[]> {
  const cacheKey = 'bwin_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    BWIN_SPORTS.map(s => fetchBwinSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[bwin] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
