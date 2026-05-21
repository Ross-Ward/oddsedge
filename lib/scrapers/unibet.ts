/**
 * Unibet — standalone scraper for the Unibet EU website.
 *
 * While Kambi is Unibet's backend platform (covered by kambi.ts), this scraper
 * uses Unibet's own public REST API for richer market data and additional sports.
 *
 * Base: https://www.unibet.com/sportsbook-feeds/views/filter
 * Endpoint: GET /sport/{sport}/top/all/competitions.json?lang=en-GB&market=GB
 *
 * Odds: decimal format.
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.unibet.com/sportsbook-feeds/views/filter'

const UB_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'football',          sport: 'soccer',            name: 'Football' },
  { slug: 'basketball',        sport: 'basketball',        name: 'Basketball' },
  { slug: 'tennis',            sport: 'tennis',            name: 'Tennis' },
  { slug: 'ice-hockey',        sport: 'hockey',            name: 'Ice Hockey' },
  { slug: 'baseball',          sport: 'baseball',          name: 'Baseball' },
  { slug: 'american-football', sport: 'american_football', name: 'American Football' },
  { slug: 'cricket',           sport: 'cricket',           name: 'Cricket' },
  { slug: 'rugby-union',       sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'golf',              sport: 'golf',              name: 'Golf' },
  { slug: 'mma',               sport: 'mma',               name: 'MMA/UFC' },
]

interface UBOutcome { label: string; englishLabel?: string; odds: number }
interface UBBetOffer { criterion: { label: string }; betOfferType: { name: string }; outcomes: UBOutcome[]; suspended: boolean }
interface UBEvent {
  id: number
  name: string
  homeName?: string
  awayName?: string
  start: string
  state?: string
  sport: string
  group: string
  betOffers?: UBBetOffer[]
}

function parseTeams(ev: UBEvent): { home: string; away: string } | null {
  if (ev.homeName && ev.awayName) return { home: ev.homeName, away: ev.awayName }
  const sep = ev.name.includes(' v ') ? ' v '
    : ev.name.includes(' - ') ? ' - '
    : null
  if (!sep) return null
  const [a, b] = ev.name.split(sep)
  return { home: a.trim(), away: b.trim() }
}

async function fetchUnibetSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('www.unibet.com', 400)

  const url = `${BASE}/${sport.slug}/top/all/competitions.json?lang=en-GB&market=GB&limit=50`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.unibet.com/'),
    timeoutMs: 15_000,
    label: `unibet:${sport.slug}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const sections: any[] = data?.layout?.sections ?? []
  const rawEvents: UBEvent[] = sections
    .flatMap((s: any) => s.widgets ?? [])
    .flatMap((w: any) => w.matches ?? w.events ?? [])

  return rawEvents.flatMap((ev): Event[] => {
    const teams = parseTeams(ev)
    if (!teams) return []

    const betOffers: UBBetOffer[] = ev.betOffers ?? []
    const matchOffer = betOffers.find(o =>
      !o.suspended &&
      ['MATCH_WINNER', '1X2', 'MONEYLINE', 'MATCH_RESULT'].some(t =>
        (o.betOfferType?.name ?? '').toUpperCase().includes(t)
      )
    )

    const domMarkets: Market[] = []
    if (matchOffer && matchOffer.outcomes.length >= 2) {
      const outcomes = matchOffer.outcomes.slice(0, 3)
        .map(o => ({ name: o.englishLabel ?? o.label, price: o.odds / 1000 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchOffer.criterion.label || 'Match Result', outcomes })
      }
    }

    // Spread
    const spreadOffer = betOffers.find(o =>
      !o.suspended &&
      ['HANDICAP', 'POINT_SPREAD', 'ASIAN_HANDICAP'].some(t =>
        (o.betOfferType?.name ?? '').toUpperCase().includes(t)
      )
    )
    if (spreadOffer && spreadOffer.outcomes.length >= 2) {
      const outcomes = spreadOffer.outcomes.slice(0, 2)
        .map(o => ({ name: o.englishLabel ?? o.label, price: o.odds / 1000 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'spreads', label: spreadOffer.criterion.label || 'Spread', outcomes })
    }

    // Totals
    const totalOffer = betOffers.find(o =>
      !o.suspended &&
      ['TOTAL', 'OVER_UNDER'].some(t =>
        (o.betOfferType?.name ?? '').toUpperCase().includes(t)
      )
    )
    if (totalOffer && totalOffer.outcomes.length >= 2) {
      const outcomes = totalOffer.outcomes.slice(0, 2)
        .map(o => ({ name: o.englishLabel ?? o.label, price: o.odds / 1000 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'totals', label: totalOffer.criterion.label || 'Total', outcomes })
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'unibet', title: 'Unibet', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `ub_${ev.id}`,
      sport: sport.sport,
      sportTitle: ev.group ?? sport.name,
      league: ev.group ?? sport.name,
      commenceTime: new Date(ev.start).toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.state === 'STARTED',
      bookmakers,
    }]
  })
}

export async function getUnibetEvents(): Promise<Event[]> {
  const cacheKey = 'unibet_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    UB_SPORTS.map(s => fetchUnibetSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[unibet] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
