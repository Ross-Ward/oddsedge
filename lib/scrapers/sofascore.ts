/**
 * Sofascore public API — no API key required.
 * Covers football, basketball, tennis, cricket, hockey, baseball, rugby, MMA, and more.
 * Used by the official Sofascore app, publicly accessible.
 *
 * Sofascore gives us EVENTS (teams, time, league) but not bookmaker odds.
 * We enrich those events with odds from bookmaker scrapers.
 */
import { Event, BookmakerOdds, Sport } from '../types'
import { safeFetch, jsonHeaders, nextNDays, rateLimit } from './utils'
import { LEAGUES, LeagueMeta } from './config'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://api.sofascore.com/api/v1'

// Maps Sofascore sport name → our Sport type
const SPORT_NAME_MAP: Record<string, Sport> = {
  football:          'soccer',
  basketball:        'basketball',
  tennis:            'tennis',
  'ice-hockey':      'hockey',
  baseball:          'baseball',
  'american-football': 'american_football',
  cricket:           'cricket',
  rugby:             'rugby',
  'mma-ufc':         'mma',
}

const SPORT_SLUG_MAP: Record<Sport, string> = {
  soccer:            'football',
  basketball:        'basketball',
  tennis:            'tennis',
  hockey:            'ice-hockey',
  baseball:          'baseball',
  american_football: 'american-football',
  cricket:           'cricket',
  rugby:             'rugby',
  mma:               'mma-ufc',
  golf:              'golf',
  horse_racing:      'horse-racing',
  greyhound_racing:  'greyhound',
  motorsport:        'motorsport',
  esports:           'esports',
  prediction_market: 'prediction-market',
}

interface SofascoreTeam { name: string; nameCode: string }
interface SofascoreStatus { type: { state: string } }
interface SofascoreCompetition { name: string; category: { name: string } }
interface SofascoreRawEvent {
  id: string | number
  homeTeam: SofascoreTeam
  awayTeam: SofascoreTeam
  status: SofascoreStatus
  tournament: SofascoreCompetition & { uniqueTournament?: { id: number } }
  startTimestamp?: number
}
interface SofascoreChoice {
  name: string
  decimalValue?: number
  fractionalValue?: string | number
}
interface SofascoreFeaturedBookmaker {
  source?: string
  choices?: SofascoreChoice[]
}

function buildEvent(e: SofascoreRawEvent, league: LeagueMeta | null, sportSlug: string): Event | null {
  try {
    const home: SofascoreTeam = e.homeTeam
    const away: SofascoreTeam = e.awayTeam
    const status: SofascoreStatus = e.status
    const comp: SofascoreCompetition = e.tournament

    if (!home?.name || !away?.name) return null

    const sport: Sport = SPORT_NAME_MAP[sportSlug] ?? 'soccer'
    const isLive = status?.type?.state === 'inprogress'
    const startTime = e.startTimestamp
      ? new Date(e.startTimestamp * 1000).toISOString()
      : new Date().toISOString()

    return {
      id: `sf_${e.id}`,
      sport,
      sportTitle: comp?.name ?? league?.name ?? 'Unknown',
      league: comp?.name ?? league?.name ?? 'Unknown',
      commenceTime: startTime,
      homeTeam: home.name,
      awayTeam: away.name,
      isLive,
      bookmakers: [], // enriched later by bookmaker scrapers
    }
  } catch {
    return null
  }
}

/** Fetch all scheduled events for a specific sport + date */
async function fetchScheduledEvents(sportSlug: string, date: string): Promise<SofascoreRawEvent[]> {
  const url = `${BASE}/sport/${sportSlug}/scheduled-events/${date}`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.sofascore.com/'),
    timeoutMs: 12_000,
    label: `sofascore:${sportSlug}:${date}`,
  })
  if (!res?.ok) return []
  const data = await res.json().catch(() => null)
  return data?.events ?? []
}

/** Fetch events for a specific league by Sofascore tournament ID */
async function fetchLeagueEvents(sofascoreId: number, season?: string): Promise<SofascoreRawEvent[]> {
  // Get current season first if no season provided
  if (!season) {
    const seasonRes = await safeFetch(`${BASE}/unique-tournament/${sofascoreId}/seasons`, {
      headers: jsonHeaders('https://www.sofascore.com/'),
      timeoutMs: 8_000,
    })
    if (seasonRes?.ok) {
      const seasonData = await seasonRes.json().catch(() => null)
      const latestSeason = seasonData?.seasons?.[0]?.id
      if (latestSeason) season = latestSeason
    }
  }
  if (!season) return []

  const url = `${BASE}/unique-tournament/${sofascoreId}/season/${season}/events/next/0`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.sofascore.com/'),
    timeoutMs: 12_000,
    label: `sofascore:league:${sofascoreId}`,
  })
  if (!res?.ok) return []
  const data = await res.json().catch(() => null)
  return data?.events ?? []
}

/**
 * Fetch Sofascore's own bookmaker odds for an event.
 * Endpoint: GET /event/{id}/odds/1/featured/1
 * Returns featured odds from Sofascore's partner bookmakers (bet365, Unibet, etc.)
 */
async function fetchEventOdds(eventId: string | number): Promise<BookmakerOdds[]> {
  const res = await safeFetch(`${BASE}/event/${eventId}/odds/1/featured/1`, {
    headers: jsonHeaders('https://www.sofascore.com/'),
    timeoutMs: 8_000,
    label: `sofascore:odds:${eventId}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const featured: SofascoreFeaturedBookmaker[] = (data?.featured as SofascoreFeaturedBookmaker[]) ?? []
  if (!featured.length) return []

  const results: BookmakerOdds[] = []
  for (const bk of featured) {
    const choices: SofascoreChoice[] = bk.choices ?? []
    if (choices.length < 2) continue

    const outcomes = choices.map((c) => {
      // choices[].name = "1" | "X" | "2" for soccer, "1" | "2" for other sports
      const label = c.name === '1' ? 'Home' : c.name === '2' ? 'Away' : 'Draw'
      // prefer decimal, fall back to fractional
      let price: number = c.decimalValue ?? 0
      if (price <= 1 && c.fractionalValue) {
        const parts = String(c.fractionalValue).split('/')
        if (parts.length === 2) {
          price = parseFloat((1 + Number(parts[0]) / Number(parts[1])).toFixed(3))
        }
      }
      return { name: label, price }
    }).filter(o => o.price > 1)

    if (outcomes.length < 2) continue

    const sourceKey = (bk.source ?? 'sofascore_partner').toLowerCase().replace(/\s+/g, '_')
    results.push({
      key: sourceKey,
      title: bk.source ?? 'Sofascore Partner',
      lastUpdate: new Date().toISOString(),
      markets: [{ key: 'h2h', label: 'Match Result', outcomes }],
    })
  }

  return results
}

/** Get events for TODAY + NEXT 2 DAYS across all major sports, enriched with odds */
export async function getSofascoreEvents(): Promise<Event[]> {
  const cacheKey = 'sofascore_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000) // 5 min cache
  if (cached) return cached

  const dates = nextNDays(3) // today + 2 more days
  const sports: Array<{ slug: string; leagues: LeagueMeta[] }> = [
    { slug: 'football',          leagues: LEAGUES.filter(l => l.sport === 'soccer' && l.tier === 1).slice(0, 12) },
    { slug: 'basketball',        leagues: LEAGUES.filter(l => l.sport === 'basketball') },
    { slug: 'tennis',            leagues: LEAGUES.filter(l => l.sport === 'tennis').slice(0, 3) },
    { slug: 'ice-hockey',        leagues: LEAGUES.filter(l => l.sport === 'hockey') },
    { slug: 'baseball',          leagues: LEAGUES.filter(l => l.sport === 'baseball') },
    { slug: 'american-football', leagues: LEAGUES.filter(l => l.sport === 'american_football') },
    { slug: 'cricket',           leagues: LEAGUES.filter(l => l.sport === 'cricket') },
    { slug: 'rugby',             leagues: LEAGUES.filter(l => l.sport === 'rugby') },
    { slug: 'mma-ufc',           leagues: LEAGUES.filter(l => l.sport === 'mma') },
    { slug: 'volleyball',        leagues: [] },
    { slug: 'handball',          leagues: [] },
  ]

  const allEvents: Event[] = []
  const seen = new Set<string>()

  const fetches = sports.flatMap(({ slug, leagues }) =>
    dates.map(date => ({ slug, date, leagues }))
  )

  const results = await Promise.allSettled(
    fetches.map(async ({ slug, date, leagues }) => {
      const raw = await fetchScheduledEvents(slug, date)
      return raw
        .slice(0, 30) // up from 20
        .map(e => {
          const league = leagues.find(l => l.sofascoreId && e.tournament?.uniqueTournament?.id === l.sofascoreId) ?? null
          return buildEvent(e, league, slug)
        })
        .filter((e): e is Event => e !== null)
    })
  )

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const ev of r.value) {
      const key = `${ev.homeTeam}|${ev.awayTeam}`
      if (!seen.has(key)) {
        seen.add(key)
        allEvents.push(ev)
      }
    }
  }

  // Enrich the top 40 events with Sofascore bookmaker odds
  // Extract raw Sofascore IDs from event IDs (format: "sf_{id}")
  const toEnrich = allEvents.filter(e => e.id.startsWith('sf_')).slice(0, 40)
  const oddsResults = await Promise.allSettled(
    toEnrich.map(async ev => {
      const sfId = ev.id.replace('sf_', '')
      await rateLimit('api.sofascore.com', 150)
      const odds = await fetchEventOdds(sfId)
      return { id: ev.id, odds }
    })
  )

  const oddsMap = new Map<string, BookmakerOdds[]>()
  for (const r of oddsResults) {
    if (r.status === 'fulfilled' && r.value.odds.length > 0) {
      oddsMap.set(r.value.id, r.value.odds)
    }
  }

  // Merge odds into events
  for (const ev of allEvents) {
    const enrichOdds = oddsMap.get(ev.id)
    if (enrichOdds?.length) {
      ev.bookmakers = [...ev.bookmakers, ...enrichOdds]
    }
  }

  console.log(`[sofascore] fetched ${allEvents.length} events (${oddsMap.size} enriched with odds)`)
  cacheSet(cacheKey, allEvents)
  return allEvents
}

/** Get events for a specific league (by sofascoreId) */
export async function getSofascoreLeagueEvents(sofascoreId: number, sport: Sport): Promise<Event[]> {
  const raw = await fetchLeagueEvents(sofascoreId)
  const league = LEAGUES.find(l => l.sofascoreId === sofascoreId) ?? null
  const slug = SPORT_SLUG_MAP[sport] ?? 'football'
  return raw.slice(0, 20).map(e => buildEvent(e, league, slug)).filter((e): e is Event => e !== null)
}
