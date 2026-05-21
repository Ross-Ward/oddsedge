/**
 * DraftKings Sportsbook — largest US daily fantasy / sports betting operator.
 *
 * DraftKings exposes a public JSON odds API used by their web app.
 * No API key required; accessible from any browser.
 *
 * Primary:   GET https://sportsbook.draftkings.com/api/odds/v1/leagues/{id}/categories/{cat}/subcategories/{sub}
 * Fallback:  GET https://sportsbook.draftkings.com/api/odds/v1/leagues/{id}/events/featured?format=json
 *
 * Category IDs:  583 = moneylines, 487 = spreads, 488 = totals
 * Subcategory IDs vary by sport — configured per league below.
 * Odds format: American → converted to decimal by utils.americanToDecimal
 */
import { Event, BookmakerOdds, Market, Sport } from '../types'
import { safeFetch, jsonHeaders, americanToDecimal, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://sportsbook.draftkings.com/api/odds/v1'

// DraftKings league IDs — verified current IDs (2024-2026)
// subcat: moneyline subcategory for this sport (4980 = Game Lines, 4881 = Fight Lines, etc.)
const DK_LEAGUES: Array<{ leagueId: number; sport: Sport; name: string; subcat?: number }> = [
  // ── US sports ──────────────────────────────────────────────────────────────
  { leagueId: 88808,  sport: 'american_football', name: 'NFL' },
  { leagueId: 91368,  sport: 'american_football', name: 'NCAAF' },
  { leagueId: 91540,  sport: 'american_football', name: 'CFL' },
  { leagueId: 89655,  sport: 'basketball',        name: 'NBA' },
  { leagueId: 92483,  sport: 'basketball',        name: 'NCAAB' },
  { leagueId: 89549,  sport: 'basketball',        name: 'WNBA' },
  { leagueId: 84240,  sport: 'baseball',          name: 'MLB' },
  { leagueId: 89682,  sport: 'hockey',            name: 'NHL' },
  { leagueId: 9,      sport: 'mma',               name: 'UFC/MMA',      subcat: 4881 },
  { leagueId: 97554,  sport: 'mma',               name: 'Boxing',       subcat: 4881 },
  // ── Soccer ─────────────────────────────────────────────────────────────────
  { leagueId: 91511,  sport: 'soccer',            name: 'MLS' },
  { leagueId: 97857,  sport: 'soccer',            name: 'Premier League' },
  { leagueId: 97862,  sport: 'soccer',            name: 'Champions League' },
  { leagueId: 97860,  sport: 'soccer',            name: 'Europa League' },
  { leagueId: 97863,  sport: 'soccer',            name: 'La Liga' },
  { leagueId: 97864,  sport: 'soccer',            name: 'Serie A' },
  { leagueId: 97861,  sport: 'soccer',            name: 'Bundesliga' },
  { leagueId: 97858,  sport: 'soccer',            name: 'Ligue 1' },
  { leagueId: 97866,  sport: 'soccer',            name: 'Eredivisie' },
  { leagueId: 97869,  sport: 'soccer',            name: 'Brazilian Serie A' },
  { leagueId: 91527,  sport: 'soccer',            name: 'Copa Libertadores' },
  // ── Tennis / Other ──────────────────────────────────────────────────────────
  { leagueId: 87637,  sport: 'tennis',            name: 'Tennis',       subcat: 4858 },
  // ── Golf ───────────────────────────────────────────────────────────────────
  { leagueId: 91670,  sport: 'golf',              name: 'PGA Tour' },
  { leagueId: 97567,  sport: 'golf',              name: 'Golf Majors' },
  // ── Motorsport ─────────────────────────────────────────────────────────────
  { leagueId: 97580,  sport: 'motorsport',        name: 'Formula 1' },
  { leagueId: 97576,  sport: 'motorsport',        name: 'NASCAR Cup' },
]

interface DKOffer {
  label: string
  oddsAmerican: string
  oddsDecimal: number
  line?: number
}

interface DKFeaturedEvent {
  eventId: number
  name?: string
  teamName1?: string
  teamName2?: string
  startDate: string
  isLive?: boolean
  teamShortName1?: string
  teamShortName2?: string
}

interface DKMarketOffer {
  eventId: number
  outcomes?: DKOffer[]
  label?: string
}

interface DKResponse {
  eventGroup?: {
    events?: DKFeaturedEvent[]
    offerCategories?: Array<{
      name: string
      offerSubcategoryDescriptors?: Array<{
        name: string
        offerSubcategory?: {
          offers?: DKMarketOffer[]
        }
      }>
    }>
  }
  events?: DKFeaturedEvent[]
}

function parseEventName(name: string): { home: string; away: string } | null {
  if (name.includes(' @ ')) {
    const [away, home] = name.split(' @ ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' vs. ')) {
    const [home, away] = name.split(' vs. ')
    return { home: home.trim(), away: away.trim() }
  }
  if (name.includes(' vs ')) {
    const [home, away] = name.split(' vs ')
    return { home: home.trim(), away: away.trim() }
  }
  return null
}

function dkPrice(offer: DKOffer): number {
  if (offer.oddsDecimal > 1) return offer.oddsDecimal
  const am = parseInt(offer.oddsAmerican, 10)
  return isNaN(am) ? 0 : americanToDecimal(am)
}

async function fetchDKLeague(league: { leagueId: number; sport: Sport; name: string; subcat?: number }): Promise<Event[]> {
  await rateLimit('sportsbook.draftkings.com', 300)

  const subcat = league.subcat ?? 4980
  const headers = jsonHeaders('https://sportsbook.draftkings.com/')
  const fetchOpts = { headers, timeoutMs: 15_000, label: `draftkings:${league.name}` }

  // Try 1: sport-specific subcategory
  let data: DKResponse | null = null
  const r1 = await safeFetch(`${BASE}/leagues/${league.leagueId}/categories/583/subcategories/${subcat}`, fetchOpts)
  if (r1?.ok) data = await r1.json().catch(() => null)

  // Try 2: generic game-lines subcategory (if different from above)
  if (!data?.eventGroup?.events?.length && subcat !== 4980) {
    const r2 = await safeFetch(`${BASE}/leagues/${league.leagueId}/categories/583/subcategories/4980`, fetchOpts)
    if (r2?.ok) data = await r2.json().catch(() => null)
  }

  // Try 3: featured events (always has inline odds for active leagues)
  if (!data?.eventGroup?.events?.length) {
    const r3 = await safeFetch(`${BASE}/leagues/${league.leagueId}/events/featured?format=json`, fetchOpts)
    if (r3?.ok) data = await r3.json().catch(() => null)
  }

  if (!data) return []

  const rawEvents: DKFeaturedEvent[] = data.eventGroup?.events ?? data.events ?? []

  // Build odds map: eventId → { home, away, draw, homeSpread, awaySpread, over, under }
  type OddsEntry = { ml?: { home: DKOffer; away: DKOffer; draw?: DKOffer }; spread?: { home: DKOffer; away: DKOffer }; total?: { over: DKOffer; under: DKOffer } }
  const oddsMap = new Map<number, OddsEntry>()

  for (const cat of data.eventGroup?.offerCategories ?? []) {
    const catName = (cat.name ?? '').toUpperCase()
    for (const sub of cat.offerSubcategoryDescriptors ?? []) {
      const subName = (sub.name ?? '').toUpperCase()
      const offers: DKMarketOffer[] = sub.offerSubcategory?.offers ?? []

      for (const offer of offers) {
        const eid = offer.eventId
        if (!eid) continue
        if (!oddsMap.has(eid)) oddsMap.set(eid, {})
        const entry = oddsMap.get(eid)!
        const outcomes: DKOffer[] = offer.outcomes ?? []

        if ((catName.includes('MONEYLINE') || subName.includes('MONEYLINE') || subName.includes('GAME') || subName.includes('WINNER')) && outcomes.length >= 2) {
          let homeO: DKOffer | undefined, awayO: DKOffer | undefined, drawO: DKOffer | undefined
          for (const o of outcomes) {
            const lbl = (o.label ?? '').toLowerCase()
            if (lbl === 'home' || lbl.endsWith('home')) homeO = o
            else if (lbl === 'away' || lbl.endsWith('away')) awayO = o
            else if (lbl === 'draw' || lbl === 'tie') drawO = o
            else if (!homeO) homeO = o
            else if (!awayO) awayO = o
          }
          if (homeO && awayO) entry.ml = { home: homeO, away: awayO, draw: drawO }
        } else if ((subName.includes('SPREAD') || subName.includes('HANDICAP')) && outcomes.length >= 2) {
          entry.spread = { home: outcomes[0], away: outcomes[outcomes.length - 1] }
        } else if ((subName.includes('TOTAL') || subName.includes('OVER')) && outcomes.length >= 2) {
          const over = outcomes.find(o => (o.label ?? '').toUpperCase().includes('OVER')) ?? outcomes[0]
          const under = outcomes.find(o => (o.label ?? '').toUpperCase().includes('UNDER')) ?? outcomes[1]
          if (over && under) entry.total = { over, under }
        }
      }
    }
  }

  return rawEvents.flatMap((ev): Event[] => {
    let homeTeam = ev.teamName1 ?? ev.teamShortName1 ?? ''
    let awayTeam = ev.teamName2 ?? ev.teamShortName2 ?? ''

    if (!homeTeam || !awayTeam) {
      const parsed = parseEventName(ev.name ?? '')
      if (!parsed) return []
      homeTeam = parsed.home
      awayTeam = parsed.away
    }
    if (!homeTeam || !awayTeam) return []

    const markets: Market[] = []
    const entry = oddsMap.get(ev.eventId)

    // Moneyline
    if (entry?.ml) {
      const { home: hO, away: aO, draw: dO } = entry.ml
      const outcomes = [
        { name: homeTeam, price: dkPrice(hO) },
        dO ? { name: 'Draw', price: dkPrice(dO) } : null,
        { name: awayTeam, price: dkPrice(aO) },
      ].filter((o): o is { name: string; price: number } => o !== null && o.price > 1)
      if (outcomes.length >= 2) markets.push({ key: 'h2h', label: 'Moneyline', outcomes })
    }

    // Spread
    if (entry?.spread) {
      const { home: hS, away: aS } = entry.spread
      const ph = dkPrice(hS), pa = dkPrice(aS)
      if (ph > 1 && pa > 1) {
        markets.push({
          key: 'spreads',
          label: `Spread ${hS.label || ''}`,
          outcomes: [
            { name: `${homeTeam} ${hS.line != null ? (hS.line >= 0 ? '+' : '') + hS.line : hS.label}`, price: ph },
            { name: `${awayTeam} ${aS.line != null ? (aS.line >= 0 ? '+' : '') + aS.line : aS.label}`, price: pa },
          ],
        })
      }
    }

    // Totals
    if (entry?.total) {
      const { over: oO, under: uO } = entry.total
      const po = dkPrice(oO), pu = dkPrice(uO)
      if (po > 1 && pu > 1) {
        markets.push({
          key: 'totals',
          label: `Total ${oO.line ?? ''}`.trim(),
          outcomes: [
            { name: `Over ${oO.line ?? ''}`.trim(), price: po },
            { name: `Under ${uO.line ?? ''}`.trim(), price: pu },
          ],
        })
      }
    }

    const bookmakers: BookmakerOdds[] = markets.length > 0
      ? [{ key: 'draftkings', title: 'DraftKings', lastUpdate: new Date().toISOString(), markets }]
      : []

    return [{
      id: `dk_${ev.eventId}`,
      sport: league.sport,
      sportTitle: league.name,
      league: league.name,
      commenceTime: new Date(ev.startDate).toISOString(),
      homeTeam,
      awayTeam,
      isLive: ev.isLive ?? false,
      bookmakers,
    }]
  })
}

export async function getDraftKingsEvents(): Promise<Event[]> {
  const cacheKey = 'draftkings_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(
    DK_LEAGUES.map(l => fetchDKLeague(l))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[draftkings] fetched ${all.length} events`)
  cacheSet(cacheKey, all)
  return all
}
