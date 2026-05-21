/**
 * Action Network public API — no API key required.
 * Returns real consensus odds from multiple US bookmakers.
 * Covers: NFL, NBA, MLB, NHL, NCAAF, NCAAB, MLS, UFC, golf.
 *
 * Endpoint: GET https://api.actionnetwork.com/web/v1/scoreboard/{sport}
 */
import { Event, BookmakerOdds, Market } from '../types'
import { safeFetch, jsonHeaders, americanToDecimal } from './utils'
import { cacheGet, cacheSet } from '../cache'
import { ACTION_NETWORK_BOOK_IDS } from './config'

const BASE = 'https://api.actionnetwork.com/web/v1'

// Action Network sport keys → our sport keys
const AN_SPORTS: Array<{ anKey: string; sport: Event['sport']; title: string }> = [
  { anKey: 'nfl',       sport: 'american_football', title: 'NFL' },
  { anKey: 'nba',       sport: 'basketball',        title: 'NBA' },
  { anKey: 'mlb',       sport: 'baseball',          title: 'MLB' },
  { anKey: 'nhl',       sport: 'hockey',            title: 'NHL' },
  { anKey: 'ncaaf',     sport: 'american_football', title: 'NCAAF' },
  { anKey: 'ncaab',     sport: 'basketball',        title: 'NCAAB' },
  { anKey: 'mls',       sport: 'soccer',            title: 'MLS' },
  { anKey: 'ufc',       sport: 'mma',               title: 'UFC' },
  { anKey: 'epl',       sport: 'soccer',            title: 'Premier League' },
  { anKey: 'wnba',      sport: 'basketball',        title: 'WNBA' },
  { anKey: 'cfl',       sport: 'american_football', title: 'CFL' },
  { anKey: 'tennis',    sport: 'tennis',            title: 'Tennis' },
]

// Action Network book IDs joined for query param
const BOOK_IDS = Object.values(ACTION_NETWORK_BOOK_IDS).join(',')

function parseMarkets(game: any, books: Record<number, string>, homeTeam: string, awayTeam: string): BookmakerOdds[] {
  const result: BookmakerOdds[] = []

  if (!Array.isArray(game.odds)) return result

  // Group all odds entries by book_id
  const bookGroups = new Map<number, any[]>()
  for (const odd of game.odds) {
    if (!odd.book_id) continue
    const arr = bookGroups.get(odd.book_id) ?? []
    arr.push(odd)
    bookGroups.set(odd.book_id, arr)
  }

  for (const [bookId, entries] of bookGroups) {
    const bookKey = books[bookId]
    if (!bookKey) continue

    // Merge all entries for this book
    const merged: Record<string, any> = {}
    for (const e of entries) Object.assign(merged, e)

    const markets: Market[] = []

    // ── Moneyline ──
    const homeMl = merged.ml_home
    const awayMl = merged.ml_away
    const drawMl = merged.ml_draw

    if (homeMl != null && awayMl != null) {
      const outcomes = [
        { name: homeTeam || 'Home', price: americanToDecimal(homeMl) },
        drawMl != null ? { name: 'Draw', price: americanToDecimal(drawMl) } : null,
        { name: awayTeam || 'Away', price: americanToDecimal(awayMl) },
      ].filter((o): o is { name: string; price: number } => o !== null && o.price > 1)

      if (outcomes.length >= 2) {
        markets.push({ key: 'h2h', label: 'Moneyline', outcomes })
      }
    }

    // ── Spread ──
    // API: spread_home = handicap line (e.g. -7.5), spread_home_line = American odds (e.g. -110)
    const homeSpread = merged.spread_home
    const awaySpread = merged.spread_away
    const homeSpreadOdds = merged.spread_home_line
    const awaySpreadOdds = merged.spread_away_line

    if (homeSpreadOdds != null && awaySpreadOdds != null) {
      markets.push({
        key: 'spreads',
        label: 'Spread',
        outcomes: [
          { name: `${homeTeam || 'Home'} ${homeSpread >= 0 ? '+' : ''}${homeSpread ?? ''}`, price: americanToDecimal(homeSpreadOdds) },
          { name: `${awayTeam || 'Away'} ${awaySpread >= 0 ? '+' : ''}${awaySpread ?? ''}`, price: americanToDecimal(awaySpreadOdds) },
        ].filter(o => o.price > 1),
      })
    }

    // ── Total (Over/Under) ──
    const overOdds = merged.over
    const underOdds = merged.under
    const totalLine = merged.total

    if (overOdds != null && underOdds != null) {
      markets.push({
        key: 'totals',
        label: `Total ${totalLine ?? ''}`.trim(),
        outcomes: [
          { name: `Over ${totalLine ?? ''}`.trim(), price: americanToDecimal(overOdds) },
          { name: `Under ${totalLine ?? ''}`.trim(), price: americanToDecimal(underOdds) },
        ].filter(o => o.price > 1),
      })
    }

    if (markets.length === 0) continue

    const bookEntry = Object.entries(ACTION_NETWORK_BOOK_IDS).find(([, id]) => id === bookId)
    const bookName = bookEntry?.[0] ?? `book_${bookId}`
    result.push({
      key: bookName,
      title: bookName.charAt(0).toUpperCase() + bookName.slice(1).replace(/_/g, ' '),
      lastUpdate: new Date().toISOString(),
      markets,
    })
  }

  return result
}

async function fetchActionNetworkSport(anKey: string): Promise<Event[]> {
  const bookParam = Object.values(ACTION_NETWORK_BOOK_IDS).join(',')
  const url = `${BASE}/scoreboard/${anKey}?period=game&bookIds=${bookParam}`

  const res = await safeFetch(url, {
    headers: jsonHeaders('https://www.actionnetwork.com/'),
    timeoutMs: 15_000,
    label: `action-network:${anKey}`,
  })
  if (!res?.ok) return []

  const data = await res.json().catch(() => null)
  if (!data?.games) return []

  const books: Record<number, string> = Object.fromEntries(
    Object.entries(ACTION_NETWORK_BOOK_IDS).map(([k, v]) => [v, k])
  )

  const sportMeta = AN_SPORTS.find(s => s.anKey === anKey)!

  return (data.games as any[]).flatMap((g: any): Event[] => {
    // g.teams is an array; g.home_team_id / g.away_team_id identify which is which
    const teamsArr: any[] = Array.isArray(g.teams) ? g.teams : []
    const home =
      teamsArr.find((t: any) => t.id === g.home_team_id)?.full_name ??
      teamsArr[0]?.full_name ?? ''
    const away =
      teamsArr.find((t: any) => t.id === g.away_team_id)?.full_name ??
      teamsArr[1]?.full_name ?? ''
    if (!home || !away) return []

    const isLive = g.status === 'in-progress' || g.period != null
    const startTs = g.start_time
      ? new Date(g.start_time).toISOString()
      : new Date().toISOString()

    const bookmakers = parseMarkets(g, books, home, away)

    return [{
      id: `an_${g.id ?? `${anKey}_${home}_${away}`.replace(/\s/g, '_')}`,
      sport: sportMeta.sport,
      sportTitle: sportMeta.title,
      league: sportMeta.title,
      commenceTime: startTs,
      homeTeam: home,
      awayTeam: away,
      isLive,
      bookmakers,
    }]
  })
}

export async function getActionNetworkEvents(): Promise<Event[]> {
  const cacheKey = 'action_network_events'
  const cached = cacheGet<Event[]>(cacheKey, 300_000)
  if (cached) return cached

  const results = await Promise.allSettled(AN_SPORTS.map(s => fetchActionNetworkSport(s.anKey)))

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  console.log(`[action-network] fetched ${all.length} events across ${AN_SPORTS.length} sports`)

  cacheSet(cacheKey, all)
  return all
}
