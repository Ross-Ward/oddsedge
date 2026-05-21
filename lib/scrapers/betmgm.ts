/**
 * BetMGM Sportsbook — Entain's US brand.
 *
 * BetMGM uses the same GVC/Entain platform as Coral & Ladbrokes UK
 * but with state-specific US endpoints.
 *
 * Endpoint (NJ state, accessible globally):
 *   GET https://sports.nj.betmgm.com/api/pub/v2/sports/{SPORT}/events?attachments=MARKET&maxResults=30
 *
 * Odds: decimal format (US players see American, API returns decimal).
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sports.nj.betmgm.com/api/pub/v2'

const MGM_SPORTS: Array<{ slug: string; sport: Sport; name: string }> = [
  { slug: 'FOOTBALL',           sport: 'soccer',            name: 'Football' },
  { slug: 'AMERICAN_FOOTBALL',  sport: 'american_football', name: 'American Football (NFL)' },
  { slug: 'BASKETBALL',         sport: 'basketball',        name: 'Basketball (NBA)' },
  { slug: 'BASEBALL',           sport: 'baseball',          name: 'Baseball (MLB)' },
  { slug: 'ICE_HOCKEY',         sport: 'hockey',            name: 'Ice Hockey (NHL)' },
  { slug: 'TENNIS',             sport: 'tennis',            name: 'Tennis' },
  { slug: 'RUGBY_UNION',        sport: 'rugby',             name: 'Rugby Union' },
  { slug: 'CRICKET',            sport: 'cricket',           name: 'Cricket' },
  { slug: 'MMA',                sport: 'mma',               name: 'MMA/UFC' },
  { slug: 'BOXING',             sport: 'mma',               name: 'Boxing' },
  { slug: 'GOLF',               sport: 'golf',              name: 'Golf' },
  { slug: 'ESPORTS',            sport: 'esports',           name: 'Esports' },
]

interface MGMSel { name: string; decimalOdds?: number; price?: number }
interface MGMMkt { type: string; name?: string; selections?: MGMSel[] }
interface MGMEvent {
  id?: string | number
  name?: string
  startTime?: string
  isLive?: boolean
  competition?: { name: string }
  attachments?: { markets?: { all?: MGMMkt[] } }
  markets?: MGMMkt[]
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

async function fetchMGMSport(sport: { slug: string; sport: Sport; name: string }): Promise<Event[]> {
  await rateLimit('sports.nj.betmgm.com', 400)

  const url = `${BASE}/sports/${sport.slug}/events?attachments=MARKET&maxResults=100&sortBy=SCORE`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://sports.betmgm.com/'),
    timeoutMs: 12_000,
    label: `betmgm:${sport.slug}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  const raw: MGMEvent[] = data?.page?.content ?? data?.events ?? []

  return raw.flatMap((ev): Event[] => {
    const teams = parseTeams(ev.name ?? '')
    if (!teams) return []

    const allMkts: MGMMkt[] = ev.markets ?? ev.attachments?.markets?.all ?? []
    const matchMkt = allMkts.find(m =>
      ['MATCH_ODDS', 'MATCH_RESULT', '1X2', 'MONEYLINE', 'WIN_DRAW_WIN'].some(t =>
        (m.type ?? '').toUpperCase().includes(t)
      )
    ) ?? allMkts[0]

    const domMarkets: Market[] = []
    if (matchMkt?.selections && matchMkt.selections.length >= 2) {
      const outcomes = matchMkt.selections.slice(0, 3)
        .map((s: MGMSel) => ({ name: s.name, price: s.decimalOdds ?? s.price ?? 0 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) {
        domMarkets.push({ key: 'h2h', label: matchMkt.name || 'Match Result', outcomes })
      }
    }

    // Spread market
    const spreadMkt = allMkts.find(m =>
      ['SPREAD', 'HANDICAP', 'POINT_SPREAD', 'ASIAN_HANDICAP'].some(t =>
        (m.type ?? '').toUpperCase().includes(t)
      )
    )
    if (spreadMkt?.selections && spreadMkt.selections.length >= 2) {
      const outcomes = spreadMkt.selections.slice(0, 2)
        .map((s: MGMSel) => ({ name: s.name, price: s.decimalOdds ?? s.price ?? 0 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'spreads', label: spreadMkt.name || 'Spread', outcomes })
    }

    // Totals market
    const totalMkt = allMkts.find(m =>
      ['TOTAL', 'OVER_UNDER', 'OVER/UNDER'].some(t =>
        (m.type ?? '').toUpperCase().includes(t)
      )
    )
    if (totalMkt?.selections && totalMkt.selections.length >= 2) {
      const outcomes = totalMkt.selections.slice(0, 2)
        .map((s: MGMSel) => ({ name: s.name, price: s.decimalOdds ?? s.price ?? 0 }))
        .filter(o => o.price > 1)
      if (outcomes.length >= 2) domMarkets.push({ key: 'totals', label: totalMkt.name || 'Total', outcomes })
    }

    const bookmakers: BookmakerOdds[] = domMarkets.length > 0
      ? [{ key: 'betmgm', title: 'BetMGM', lastUpdate: new Date().toISOString(), markets: domMarkets }]
      : []

    return [{
      id: `mgm_${ev.id ?? `${teams.home}_${teams.away}`}`,
      sport: sport.sport,
      sportTitle: ev.competition?.name ?? sport.name,
      league: ev.competition?.name ?? sport.name,
      commenceTime: ev.startTime ? new Date(ev.startTime).toISOString() : new Date().toISOString(),
      homeTeam: teams.home,
      awayTeam: teams.away,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getBetMGMEvents(): Promise<Event[]> {
  const cacheKey = 'betmgm_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    MGM_SPORTS.map(s => fetchMGMSport(s))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[betmgm] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
