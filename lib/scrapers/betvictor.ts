/**
 * BetVictor Sportsbook — independent UK bookmaker.
 *
 * BetVictor serves JSON from a public REST API backing their website.
 * No API key required.
 *
 * Base: https://www.betvictor.com/en-gb/sport
 * API: https://www.betvictor.com/en-gb/sport/football/in-play/all-in-play.json
 *      https://www.betvictor.com/en-gb/sport/football/in-play/today.json
 *
 * Alternative (newer API):
 *   GET https://www.betvictor.com/api/en-gb/sport/{sport}/events?page=1&perPage=20
 *
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.betvictor.com'

const BV_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'football',           sport: 'soccer',            name: 'Football' },
  { slug: 'tennis',             sport: 'tennis',            name: 'Tennis' },
  { slug: 'cricket',            sport: 'cricket',           name: 'Cricket' },
  { slug: 'basketball',         sport: 'basketball',        name: 'Basketball' },
  { slug: 'american-football',  sport: 'american_football', name: 'American Football' },
  { slug: 'ice-hockey',         sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'rugby-union',        sport: 'rugby',             name: 'Rugby Union' },  { slug: 'mma',               sport: 'mma',               name: 'MMA/UFC' },
  { slug: 'baseball',          sport: 'baseball',          name: 'Baseball' },
  { slug: 'golf',              sport: 'golf',              name: 'Golf' },]

interface BVOutcome { desc: string; price?: { decimal?: number; num?: number; den?: number } }
interface BVMarket { desc: string; type?: string; outcomes?: BVOutcome[] }
interface BVEvent {
  id?: number
  desc?: string
  start_time?: string
  is_live?: boolean
  comp_name?: string
  markets?: BVMarket[]
  mkt?: BVMarket[]
}

function parseTeams(name: string): { home: string; away: string } | null {
  const sep = name.includes(' v ') ? ' v '
    : name.includes(' vs ') ? ' vs '
    : name.includes(' - ') ? ' - '
    : null
  if (!sep) return null
  const [a, b] = name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

function bvPrice(o: BVOutcome): number {
  if (o.price?.decimal && o.price.decimal > 1) return o.price.decimal
  if (o.price?.num != null && o.price?.den != null && o.price.den > 0) {
    return parseFloat((1 + o.price.num / o.price.den).toFixed(3))
  }
  return 0
}

async function fetchBVSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('www.betvictor.com', 400)

  const endpoints = [
    `${BASE}/api/en-gb/sport/${sport.slug}/events?page=1&perPage=50&eventType=MATCH`,
    `${BASE}/en-gb/sport/${sport.slug}/all-matches.json`,
  ]

  let data: any = null
  for (const url of endpoints) {
    const res = await safeFetch(url, {
      headers: jsonHeaders('https://www.betvictor.com/'),
      timeoutMs: 12_000,
      label: `betvictor:${sport.slug}`,
    })
    if (res?.ok) { data = await res.json().catch(() => null); if (data) break }
  }
  if (!data) return []

  const raw: BVEvent[] = data?.events ?? data?.result?.events ?? data?.data ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.desc ?? '')
    if (!teams) return []

    const allMkts: BVMarket[] = ev.markets ?? ev.mkt ?? []
    const matchMkt = allMkts.find(m =>
      ['MATCH_BETTING', 'MATCH ODDS', 'MATCH RESULT', '1X2', 'MONEYLINE'].some(t =>
        (m.type ?? m.desc ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    if (matchMkt?.outcomes && matchMkt.outcomes.length >= 2) {
      const outcomes = matchMkt.outcomes.slice(0, 3)
        .map(o => ({ name: o.desc, price: bvPrice(o) }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.desc || 'Match Result', outcomes })
      }
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'betvictor', title: 'BetVictor', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `bv_${ev.id ?? `${teams.home}_${teams.away}`}`,
      sport: sport.sport,
      sportTitle: ev.comp_name ?? sport.name,
      league: ev.comp_name ?? sport.name,
      commenceTime: ev.start_time ? new Date(ev.start_time).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.is_live ?? false,
      bookmakers,
    }]
  })
}

export async function getBetVictorEvents(): Promise<Event[]> {
  const cacheKey = 'betvictor_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    BV_SPORTS.map(s => fetchBVSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[betvictor] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
