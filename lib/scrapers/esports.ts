/**
 * Esports — dedicated odds aggregator for competitive gaming.
 *
 * Sources:
 *   1. Betway Esports — sports.betway.com ESPORTS slug
 *   2. Betsson / Kambi — esports path on Kambi platform
 *   3. Pinnacle — esports via their public odds endpoint
 *   4. Unibet — esports Kambi path
 *
 * Games covered: CS2, Dota 2, League of Legends, Valorant, PUBG,
 *                Overwatch, Rainbow Six, Rocket League, StarCraft 2
 */

import { Event, BookmakerOdds, Market, Outcome } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const CACHE_KEY = 'esports_events'
const CACHE_TTL = 300_000

// ─── Known esports game slugs / IDs ──────────────────────────────────────────

const KAMBI_ESPORTS_PATHS = [
  'esports/counter-strike',
  'esports/dota-2',
  'esports/league-of-legends',
  'esports/valorant',
  'esports/overwatch',
  'esports/pubg',
  'esports/rocket-league',
  'esports/rainbow-six',
  'esports/starcraft-2',
]

const KAMBI_OPERATORS = [
  { key: 'betsson',  title: 'Betsson',  base: 'https://eu-offering.kambi-services.com/offering/v2018/betsson' },
  { key: 'unibet',   title: 'Unibet',   base: 'https://eu-offering.kambi-services.com/offering/v2018/unibet' },
  { key: 'sport888', title: '888sport', base: 'https://eu-offering.kambi-services.com/offering/v2018/888sport' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface KambiEvent {
  id?: number | string
  homeName?: string
  awayName?: string
  name?: string
  start?: string
  sport?: string
  league?: string
  group?: string
  state?: string
  liveData?: { scoreHome?: number; scoreAway?: number }
  betOffers?: Array<{
    id?: number
    betOfferType?: { name?: string; englishLabel?: string }
    outcomes?: Array<{ id?: number; label?: string; englishLabel?: string; odds?: number; type?: string }>
    criterion?: { label?: string; englishLabel?: string }
  }>
}

interface KambiResponse {
  events?: KambiEvent[]
}

interface BetwayEvent {
  id: string
  description: string
  startTime?: string
  kickOff?: string
  status?: string
  tournament?: { description?: string }
  category?: { description?: string }
  markets?: Array<{
    description?: string
    runners?: Array<{
      description: string
      winPrice?: { price?: number }
      odds?: { decimal?: number }
      price?: number
    }>
  }>
}

// ─── Kambi esports ────────────────────────────────────────────────────────────

async function fetchKambiEsports(operator: typeof KAMBI_OPERATORS[0]): Promise<Event[]> {
  await rateLimit('eu-offering.kambi-services.com', 500)

  const events: Event[] = []

  for (const gamePath of KAMBI_ESPORTS_PATHS.slice(0, 5)) { // limit to top 5 games per operator
    const url = `${operator.base}/listView/${gamePath}/all/matches.json?lang=en_GB&market=GB&client_id=2&channel_id=1&ncid=1&max=50`

    const res = await safeFetch(url, {
      headers: jsonHeaders('https://www.betsson.com/'),
      timeoutMs: 12_000,
      label: `kambi-esports:${operator.key}:${gamePath}`,
    })
    if (!res?.ok) continue

    const data: KambiResponse | null = await res.json().catch(() => null)
    if (!data?.events) continue

    for (const ev of data.events) {
      if (!ev.homeName || !ev.awayName) continue

      const h2hOffer = ev.betOffers?.find(bo =>
        bo.betOfferType?.name === 'MATCH' ||
        bo.betOfferType?.englishLabel?.toLowerCase().includes('match')
      ) ?? ev.betOffers?.[0]

      if (!h2hOffer?.outcomes?.length) continue

      const outcomes: Outcome[] = h2hOffer.outcomes
        .filter(o => o.odds && o.odds > 0)
        .map(o => ({
          name: o.englishLabel ?? o.label ?? '',
          price: (o.odds ?? 0) / 1000,
        }))
        .filter(o => o.price > 1 && o.name)

      if (outcomes.length < 2) continue

      const market: Market = { key: 'h2h', label: 'Match Winner', outcomes }
      const bk: BookmakerOdds = {
        key: operator.key,
        title: operator.title,
        lastUpdate: new Date().toISOString(),
        markets: [market],
      }

      // Derive game name from path (e.g. 'esports/counter-strike' → 'CS2')
      const gameLabel = gamePathToLabel(gamePath)
      const leagueRaw = ev.group ?? ev.league ?? gameLabel

      events.push({
        id: `ks_esports_${operator.key}_${ev.id}`,
        sport: 'esports',
        sportTitle: 'Esports',
        league: `${gameLabel} — ${leagueRaw}`.substring(0, 60),
        commenceTime: ev.start ? new Date(ev.start).toISOString() : new Date().toISOString(),
        homeTeam: ev.homeName,
        awayTeam: ev.awayName,
        isLive: ev.state === 'STARTED',
        bookmakers: [bk],
        category: 'esports',
      })
    }
  }

  return events
}

function gamePathToLabel(path: string): string {
  const map: Record<string, string> = {
    'esports/counter-strike': 'CS2',
    'esports/dota-2': 'Dota 2',
    'esports/league-of-legends': 'LoL',
    'esports/valorant': 'Valorant',
    'esports/overwatch': 'Overwatch 2',
    'esports/pubg': 'PUBG',
    'esports/rocket-league': 'Rocket League',
    'esports/rainbow-six': 'Rainbow Six',
    'esports/starcraft-2': 'StarCraft II',
  }
  return map[path] ?? path.split('/').pop() ?? path
}

// ─── Betway esports ───────────────────────────────────────────────────────────

async function fetchBetwayEsports(): Promise<Event[]> {
  await rateLimit('sports.betway.com', 600)
  const url = 'https://sports.betway.com/api/pub/v3/events/sport/ESPORTS?maxResults=50&locale=en-GB'
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.betway.com/'),
    timeoutMs: 15_000,
    label: 'betway:esports',
  })
  if (!res?.ok) return []

  const data: { events?: BetwayEvent[] } | null = await res.json().catch(() => null)
  if (!data?.events) return []

  return data.events.map((ev): Event | null => {
    const market = ev.markets?.[0]
    const runners = market?.runners ?? []

    const outcomes: Outcome[] = runners.map(r => ({
      name: r.description,
      price: r.winPrice?.price ?? r.odds?.decimal ?? r.price ?? 0,
    })).filter(o => o.price > 1 && o.name)

    if (outcomes.length < 2) return null

    // Determine team names from runner descriptions
    const [home, away] = outcomes
    const bk: BookmakerOdds = {
      key: 'betway',
      title: 'Betway',
      lastUpdate: new Date().toISOString(),
      markets: [{ key: 'h2h', label: 'Match Winner', outcomes }],
    }

    const startTime = ev.startTime ?? ev.kickOff ?? new Date().toISOString()
    const tournament = ev.tournament?.description ?? ev.category?.description ?? 'Esports'

    return {
      id: `bw_esports_${ev.id}`,
      sport: 'esports',
      sportTitle: 'Esports',
      league: tournament,
      commenceTime: new Date(startTime).toISOString(),
      homeTeam: home.name,
      awayTeam: away.name,
      isLive: ev.status === 'LIVE',
      bookmakers: [bk],
      category: 'esports',
    }
  }).filter((e): e is Event => e !== null)
}

// ─── Merge ────────────────────────────────────────────────────────────────────

function normTeam(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function mergeEsports(all: Event[]): Event[] {
  const map = new Map<string, Event>()
  for (const ev of all) {
    const key = `${normTeam(ev.homeTeam)}|${normTeam(ev.awayTeam)}`
    const existing = map.get(key)
    if (existing) {
      const seen = new Set(existing.bookmakers.map(b => b.key))
      for (const bk of ev.bookmakers) if (!seen.has(bk.key)) existing.bookmakers.push(bk)
    } else {
      map.set(key, { ...ev })
    }
  }
  return Array.from(map.values())
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getEsportsEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>(CACHE_KEY, CACHE_TTL)
  if (cached) return cached

  const results = await Promise.allSettled([
    fetchBetwayEsports(),
    ...KAMBI_OPERATORS.map(op => fetchKambiEsports(op)),
  ])

  const all: Event[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const merged = mergeEsports(all)

  console.log(`[esports] ${merged.length} matches`)
  cacheSet(CACHE_KEY, merged)
  return merged
}
