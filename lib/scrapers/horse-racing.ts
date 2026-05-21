/**
 * Horse & Greyhound Racing — aggregates odds from multiple free sources.
 *
 * Sources:
 *   1. Betway sports API  — HORSE_RACING / GREYHOUND_RACING sport slugs
 *   2. Betfair Exchange   — horse-racing / greyhound categories
 *   3. TAB Australia      — Australian racing (tab.com.au)
 *
 * Event structure:
 *   homeTeam  = race description  (e.g. "R1 3:30 Cheltenham")
 *   awayTeam  = meeting name      (e.g. "Cheltenham Festival")
 *   league    = meeting + country (e.g. "Cheltenham (UK)")
 *   market    = 'winner' with all runners as outcomes
 */

import { Event, BookmakerOdds, Market, Outcome } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const CACHE_KEY = 'horse_racing_events'
const CACHE_TTL = 300_000

// ─── Betway Racing ────────────────────────────────────────────────────────────

interface BetwayEvent {
  id: string
  description: string
  startTime?: string
  kickOff?: string
  status?: string
  markets?: BetwayMarket[]
  sport?: { description?: string }
  category?: { description?: string }
  subCategory?: { description?: string }
  tournament?: { description?: string }
}

interface BetwayMarket {
  id: string
  description: string
  status?: string
  runners?: BetwayRunner[]
}

interface BetwayRunner {
  id: string
  description: string
  runnerOrder?: number
  status?: string
  winPrice?: { price?: number; odds?: number }
  odds?: { decimal?: number }
  price?: number
}

async function fetchBetwayRacing(sportSlug: string): Promise<Event[]> {
  await rateLimit('sports.betway.com', 500)
  const url = `https://sports.betway.com/api/pub/v3/events/sport/${sportSlug}?maxResults=40&locale=en-GB`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.betway.com/'),
    timeoutMs: 15_000,
    label: `betway:${sportSlug}`,
  })
  if (!res?.ok) return []

  const data: { events?: BetwayEvent[] } | null = await res.json().catch(() => null)
  if (!data?.events) return []

  const sport = sportSlug === 'HORSE_RACING' ? 'horse_racing' as const : 'greyhound_racing' as const

  return data.events.map((ev): Event | null => {
    const market = ev.markets?.[0]
    if (!market?.runners?.length) return null

    const outcomes: Outcome[] = market.runners
      .filter(r => r.status !== 'REMOVED')
      .map(r => {
        const price =
          r.winPrice?.price ?? r.winPrice?.odds ??
          r.odds?.decimal ?? r.price ?? 0
        return { name: r.description, price: Number(price) }
      })
      .filter(o => o.price > 1)

    if (outcomes.length < 2) return null

    const winMarket: Market = { key: 'winner', label: 'Win', outcomes }
    const bk: BookmakerOdds = {
      key: 'betway',
      title: 'Betway',
      lastUpdate: new Date().toISOString(),
      markets: [winMarket],
    }

    const startTime = ev.startTime ?? ev.kickOff ?? new Date().toISOString()
    const meeting = ev.tournament?.description ?? ev.category?.description ?? 'Racing'
    const raceDesc = ev.description ?? `Race`

    return {
      id: `bw_race_${ev.id}`,
      sport,
      sportTitle: sport === 'horse_racing' ? 'Horse Racing' : 'Greyhound Racing',
      league: meeting,
      commenceTime: new Date(startTime).toISOString(),
      homeTeam: raceDesc,
      awayTeam: meeting,
      isLive: ev.status === 'LIVE',
      bookmakers: [bk],
      category: 'horse_racing',
      runners: outcomes.length,
    }
  }).filter((e): e is Event => e !== null)
}

// ─── Betfair Horse Racing ─────────────────────────────────────────────────────

interface BetfairEvent {
  event?: { id?: string; name?: string; countryCode?: string; timezone?: string; openDate?: string }
  marketCount?: number
}

interface BetfairMarketCatalogue {
  marketId?: string
  marketName?: string
  event?: { id?: string; name?: string; openDate?: string }
  runners?: Array<{ selectionId?: number; runnerName?: string; sortPriority?: number; status?: string }>
}

interface BetfairMarketBook {
  marketId?: string
  runners?: Array<{
    selectionId?: number
    status?: string
    ex?: {
      availableToBack?: Array<{ price?: number; size?: number }>
      availableToLay?: Array<{ price?: number; size?: number }>
    }
  }>
}

async function fetchBetfairRacing(): Promise<Event[]> {
  await rateLimit('api.betfair.com', 800)

  // Use Betfair's exchange API to get horse racing markets
  // This endpoint is public-readable for pre-match data
  const listUrl = 'https://api.betfair.com/exchange/betting/json-rpc/v1'

  const listMarketsPayload = JSON.stringify({
    jsonrpc: '2.0',
    method: 'SportsAPING/v1.0/listMarketCatalogue',
    params: {
      filter: {
        eventTypeIds: ['7'], // 7 = Horse Racing on Betfair
        marketCountries: ['GB', 'IE', 'AU', 'US', 'FR', 'ZA'],
        marketTypeCodes: ['WIN'],
        marketStartTime: {
          from: new Date().toISOString(),
          to: new Date(Date.now() + 48 * 3600_000).toISOString(),
        },
      },
      maxResults: '30',
      marketProjection: ['RUNNER_METADATA', 'EVENT', 'MARKET_START_TIME'],
    },
    id: 1,
  })

  const res = await safeFetch(listUrl, {
    headers: {
      ...jsonHeaders('https://www.betfair.com/'),
      'Content-Type': 'application/json',
      'X-Application': '1',
      'X-Authentication': '', // public read
    },
    label: 'betfair:horse-racing',
    timeoutMs: 15_000,
  })
  // Betfair exchange API requires authentication – skip if not available
  if (!res?.ok) return []

  const data: { result?: BetfairMarketCatalogue[] } | null = await res.json().catch(() => null)
  if (!data?.result) return []

  return data.result.map((cat): Event | null => {
    const runners = (cat.runners ?? []).filter(r => r.status !== 'REMOVED')
    if (runners.length < 2) return null

    const outcomes: Outcome[] = runners.map(r => ({
      name: r.runnerName ?? `Runner ${r.selectionId}`,
      price: 0, // prices would need a separate listMarketBook call
    }))

    const bk: BookmakerOdds = {
      key: 'betfair_ex',
      title: 'Betfair Exchange',
      lastUpdate: new Date().toISOString(),
      markets: [{ key: 'winner', label: 'Win Market', outcomes }],
    }

    const openDate = cat.event?.openDate ?? new Date().toISOString()

    return {
      id: `bf_race_${cat.marketId}`,
      sport: 'horse_racing',
      sportTitle: 'Horse Racing',
      league: cat.event?.name ?? 'Horse Racing',
      commenceTime: new Date(openDate).toISOString(),
      homeTeam: cat.marketName ?? 'Race',
      awayTeam: cat.event?.name ?? 'Meeting',
      isLive: false,
      bookmakers: [bk],
      category: 'horse_racing',
      runners: outcomes.length,
    }
  }).filter((e): e is Event => e !== null)
}

// ─── TAB Australia Racing ─────────────────────────────────────────────────────

interface TabRace {
  raceNumber?: number
  raceName?: string
  raceStartTime?: string
  raceStatus?: string
  meeting?: { meetingName?: string; location?: string; trackCondition?: string }
  runners?: Array<{
    runnerName?: string
    runnerNumber?: number
    fixedOdds?: { returnWin?: number }
    parimutuel?: { returnWin?: number }
  }>
}

interface TabMeeting {
  meetingName?: string
  location?: string
  races?: TabRace[]
}

interface TabResponse {
  meetings?: TabMeeting[]
}

async function fetchTabAuRacing(sportName: 'Horse%20Racing' | 'Greyhound%20Racing'): Promise<Event[]> {
  await rateLimit('api.tab.com.au', 600)

  const today = new Date().toISOString().split('T')[0]
  const url = `https://api.tab.com.au/v1/tab-info-service/racing/dates/${today}/meetings?jurisdiction=SA&sportName=${sportName}`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.tab.com.au/'),
    timeoutMs: 15_000,
    label: `tab:${sportName}`,
  })
  if (!res?.ok) return []

  const data: TabResponse | null = await res.json().catch(() => null)
  if (!data?.meetings) return []

  const events: Event[] = []
  const sport = sportName.includes('Horse') ? 'horse_racing' as const : 'greyhound_racing' as const

  for (const meeting of data.meetings) {
    const meetingName = meeting.meetingName ?? 'Racing'
    const races = meeting.races ?? []

    for (const race of races) {
      if (race.raceStatus === 'Abandoned' || race.raceStatus === 'Closed') continue

      const runners = race.runners ?? []
      const outcomes: Outcome[] = runners
        .filter(r => r.runnerName)
        .map(r => ({
          name: `${r.runnerNumber ?? ''}. ${r.runnerName}`.trim(),
          price: r.fixedOdds?.returnWin ?? r.parimutuel?.returnWin ?? 0,
        }))
        .filter(o => o.price > 1)

      if (outcomes.length < 2) continue

      const bk: BookmakerOdds = {
        key: 'tab_au',
        title: 'TAB Australia',
        lastUpdate: new Date().toISOString(),
        markets: [{ key: 'winner', label: 'Win', outcomes }],
      }

      const commenceTime = race.raceStartTime
        ? new Date(race.raceStartTime).toISOString()
        : new Date().toISOString()

      events.push({
        id: `tab_race_${meetingName}_R${race.raceNumber}`.replace(/\s/g, '_'),
        sport,
        sportTitle: sport === 'horse_racing' ? 'Horse Racing' : 'Greyhound Racing',
        league: `${meetingName} (AU)`,
        commenceTime,
        homeTeam: `R${race.raceNumber ?? ''} ${race.raceName ?? 'Race'}`.trim(),
        awayTeam: meetingName,
        isLive: race.raceStatus === 'Open',
        bookmakers: [bk],
        category: 'horse_racing',
        runners: outcomes.length,
      })
    }
  }
  return events
}

// ─── Merge logic ─────────────────────────────────────────────────────────────

/** Merge bookmaker odds for races with the same race name + meeting */
function mergeRaceEvents(allEvents: Event[]): Event[] {
  const map = new Map<string, Event>()

  for (const ev of allEvents) {
    const key = `${ev.homeTeam.toLowerCase().replace(/\s/g, '')}|${ev.sport}`
    const existing = map.get(key)
    if (existing) {
      const existingKeys = new Set(existing.bookmakers.map(b => b.key))
      for (const bk of ev.bookmakers) {
        if (!existingKeys.has(bk.key)) existing.bookmakers.push(bk)
      }
    } else {
      map.set(key, { ...ev })
    }
  }

  return Array.from(map.values())
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getHorseRacingEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>(CACHE_KEY, CACHE_TTL)
  if (cached) return cached

  const [bwHorse, bwGreyhound, bfHorse, tabHorse, tabGreyhound] = await Promise.allSettled([
    fetchBetwayRacing('HORSE_RACING'),
    fetchBetwayRacing('GREYHOUND_RACING'),
    fetchBetfairRacing(),
    fetchTabAuRacing('Horse%20Racing'),
    fetchTabAuRacing('Greyhound%20Racing'),
  ])

  const all: Event[] = [
    ...(bwHorse.status      === 'fulfilled' ? bwHorse.value      : []),
    ...(bwGreyhound.status  === 'fulfilled' ? bwGreyhound.value  : []),
    ...(bfHorse.status      === 'fulfilled' ? bfHorse.value      : []),
    ...(tabHorse.status     === 'fulfilled' ? tabHorse.value     : []),
    ...(tabGreyhound.status === 'fulfilled' ? tabGreyhound.value : []),
  ]

  const merged = mergeRaceEvents(all)
  console.log(`[horse-racing] ${merged.length} races`)
  cacheSet(CACHE_KEY, merged)
  return merged
}
