/**
 * Kambi Sportsbook Platform API — no authentication required.
 * Kambi powers: Unibet, 888sport, Betsson, Mr Green, NordicBet, Betsafe,
 *               Rush Street Interactive (BetRivers), and many others.
 *
 * Public offering API endpoint:
 *   https://eu-offering.kambi-services.com/offering/v2018/{operator}/listView/{eventPath}/matches.json
 *
 * Odds are returned in milli-decimal format: 1850 = 1.850
 */
import { Event, BookmakerOdds, Market, Outcome, Sport } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'
import { LEAGUES, KAMBI_OPERATORS, LeagueMeta } from './config'

const BASE = 'https://eu-offering.kambi-services.com/offering/v2018'

interface KambiOutcome {
  id: number
  label: string
  englishLabel: string
  odds: number   // milli-decimal: 1850 = 1.850
  status: 'OPEN' | 'SUSPENDED'
  type: string
}

interface KambiBetOffer {
  id: number
  criterion: { label: string; type: string }
  betOfferType: { name: string }
  outcomes: KambiOutcome[]
  suspended: boolean
}

interface KambiEvent {
  id: number
  name: string
  englishName: string
  homeName: string
  awayName: string
  start: string
  state: 'STARTED' | 'NOT_STARTED' | 'FINISHED'
  sport: string
  group: string
  groupId: number
  path: Array<{ id: number; englishName: string }>
}

function milliToDecimal(milli: number): number {
  return parseFloat((milli / 1000).toFixed(3))
}

function kambiSportToOurs(kSport: string): Sport {
  const map: Record<string, Sport> = {
    FOOTBALL:            'soccer',
    BASKETBALL:          'basketball',
    TENNIS:              'tennis',
    'ICE_HOCKEY':        'hockey',
    BASEBALL:            'baseball',
    'AMERICAN_FOOTBALL': 'american_football',
    CRICKET:             'cricket',
    RUGBY_UNION:         'rugby',
    RUGBY_LEAGUE:        'rugby',
    MMA:                 'mma',
    GOLF:                'golf',
    ESPORTS:             'esports',
  }
  return map[kSport.toUpperCase()] ?? 'soccer'
}

function buildBookmakerOdds(operator: string, betOffers: KambiBetOffer[]): BookmakerOdds | null {
  const markets: Market[] = []

  for (const offer of betOffers) {
    if (offer.suspended) continue
    const openOutcomes = offer.outcomes.filter(o => o.status === 'OPEN')
    if (openOutcomes.length < 2) continue

    const type = offer.betOfferType?.name ?? offer.criterion?.type ?? ''
    let marketKey = 'h2h'
    let marketLabel = 'Match Result'

    if (type.includes('MATCH_WINNER') || type.includes('1X2')) {
      marketKey = 'h2h'
      marketLabel = 'Match Result (1X2)'
    } else if (type.includes('MONEYLINE') || type.includes('MONEY_LINE')) {
      marketKey = 'h2h'
      marketLabel = 'Moneyline'
    } else if (type.includes('SPREAD') || type.includes('HANDICAP')) {
      marketKey = 'spreads'
      marketLabel = 'Handicap'
    } else if (type.includes('TOTAL') || type.includes('OVER_UNDER')) {
      marketKey = 'totals'
      marketLabel = 'Over/Under'
    } else {
      continue // skip unknown markets
    }

    const outcomes: Outcome[] = openOutcomes.map(o => ({
      name: o.englishLabel || o.label,
      price: milliToDecimal(o.odds),
    }))

    markets.push({ key: marketKey, label: marketLabel, outcomes })
  }

  if (markets.length === 0) return null

  const bookKey = Object.entries(KAMBI_OPERATORS).find(([, op]) => op === operator)?.[0] ?? operator
  const bookTitle = bookKey.charAt(0).toUpperCase() + bookKey.slice(1).replace(/_/g, ' ')

  return {
    key: bookKey,
    title: bookTitle,
    lastUpdate: new Date().toISOString(),
    markets,
  }
}

async function fetchKambiOperator(operator: string, path: string): Promise<Event[]> {
  await rateLimit(`kambi-${operator}`, 500)

  const url = `${BASE}/${operator}/listView/${path}/matches.json?lang=en_GB&market=GB&client_id=2&channel_id=1&ncid=1&start=0&limit=50`

  const res = await safeFetch(url, {
    headers: jsonHeaders(`https://www.${operator.replace('_', '')}.com/`),
    timeoutMs: 15_000,
    label: `kambi:${operator}:${path}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  if (!data?.events) return []

  const events: Event[] = []

  for (const entry of data.events as Array<{ event: KambiEvent; betOffers?: KambiBetOffer[] }>) {
    const kEvent = entry.event
    if (!kEvent?.homeName || !kEvent?.awayName) continue

    const bookmakerOdds = buildBookmakerOdds(operator, entry.betOffers ?? [])

    const league = LEAGUES.find(l => l.kambiPath === path) ?? null

    events.push({
      id: `kb_${kEvent.id}`,
      sport: kambiSportToOurs(kEvent.sport),
      sportTitle: kEvent.group ?? league?.name ?? 'Unknown',
      league: kEvent.group ?? league?.name ?? 'Unknown',
      commenceTime: kEvent.start ? new Date(kEvent.start).toISOString() : new Date().toISOString(),
      homeTeam: kEvent.homeName,
      awayTeam: kEvent.awayName,
      isLive: kEvent.state === 'STARTED',
      bookmakers: bookmakerOdds ? [bookmakerOdds] : [],
    })
  }

  return events
}

/** Fetch events for all leagues from all Kambi operators */
export async function getKambiEvents(): Promise<Event[]> {
  const cacheKey = 'kambi_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  // Get leagues that have a kambiPath
  const kambiLeagues = LEAGUES.filter(l => l.kambiPath)

  const jobs: Array<{ operator: string; path: string }> = []
  for (const [, operator] of Object.entries(KAMBI_OPERATORS)) {
    for (const league of kambiLeagues) {
      jobs.push({ operator, path: league.kambiPath! })
    }
  }

  const results = await Promise.allSettled(
    jobs.map(j => fetchKambiOperator(j.operator, j.path))
  )

  // Merge: group by homeTeam+awayTeam, combine bookmaker odds
  const eventMap = new Map<string, Event>()

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const ev of r.value) {
      const key = `${ev.homeTeam}|${ev.awayTeam}|${ev.sport}`
      const existing = eventMap.get(key)
      if (existing) {
        existing.bookmakers.push(...ev.bookmakers)
      } else {
        eventMap.set(key, { ...ev })
      }
    }
  }

  const all = Array.from(eventMap.values())
  console.log(`[kambi] fetched ${all.length} events across ${Object.keys(KAMBI_OPERATORS).length} operators`)
  cacheSet(cacheKey, all)
  return all
}

/** Fetch a single operator's events for a given path */
export async function getKambiOperatorEvents(operator: string, kambiPath: string): Promise<Event[]> {
  return fetchKambiOperator(operator, kambiPath)
}
