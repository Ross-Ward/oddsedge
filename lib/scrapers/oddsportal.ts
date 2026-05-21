/**
 * OddsPortal HTML scraper — no API key required.
 * OddsPortal aggregates odds from 80+ bookmakers for all sports globally.
 *
 * Strategy: Parse their HTML "matches" tables using cheerio.
 * OddsPortal URL structure: https://www.oddsportal.com/{sport}/{country}/{league}/
 *
 * NOTE: OddsPortal blocks headless scraping with Cloudflare on some routes.
 * We use randomised headers and fallback gracefully.
 */
import * as cheerio from 'cheerio'
import { Event, BookmakerOdds, Market } from '../types'
import { safeFetch, browserHeaders, parseOdds, rateLimit } from './utils'
import { LEAGUES, LeagueMeta } from './config'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://www.oddsportal.com'

// OddsPortal sport slug → our sport
const OP_SPORT_MAP: Record<string, Event['sport']> = {
  'soccer':             'soccer',
  'basketball':         'basketball',
  'tennis':             'tennis',
  'hockey':             'hockey',
  'baseball':           'baseball',
  'american-football':  'american_football',
  'cricket':            'cricket',
  'rugby-union':        'rugby',
  'rugby-league':       'rugby',
  'mma':                'mma',
  'boxing':             'mma',
  'golf':               'golf',
  'australian-football': 'rugby',
  'darts':              'mma',
}

async function scrapeLeaguePage(league: LeagueMeta): Promise<Event[]> {
  if (!league.oddsportalPath) return []

  await rateLimit('oddsportal.com', 1000) // 1 second between requests

  const url = `${BASE}${league.oddsportalPath}`
  const res = await safeFetch(url, {
    headers: browserHeaders('https://www.oddsportal.com/'),
    timeoutMs: 20_000,
    label: `oddsportal:${league.id}`,
  })
  if (!res?.ok) return []

  const html = await res.text().catch(() => null)
  if (!html) return []

  // Primary: try to extract embedded __NEXT_DATA__ JSON (much more reliable than HTML parsing)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch?.[1]) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const extracted = parseNextData(nextData, league)
      if (extracted.length > 0) return extracted
    } catch {
      // fall through to Cheerio
    }
  }

  // Fallback: Cheerio HTML parsing
  return parseOddsPortalHTML(html, league)
}

/** Parse OddsPortal's embedded __NEXT_DATA__ JSON */
function parseNextData(nextData: any, league: LeagueMeta): Event[] {
  const events: Event[] = []

  // Navigate the JSON tree — OddsPortal structures vary, try multiple paths
  const rows: any[] = nextData?.props?.pageProps?.data?.rows
    ?? nextData?.props?.pageProps?.tournamentData?.rows
    ?? nextData?.props?.pageProps?.initialEventData?.rows
    ?? []

  for (const row of rows) {
    try {
      const homeTeam = row?.home ?? row?.homeTeam ?? row?.teams?.home ?? row?.participant1 ?? ''
      const awayTeam = row?.away ?? row?.awayTeam ?? row?.teams?.away ?? row?.participant2 ?? ''
      if (!homeTeam || !awayTeam) continue

      // Extract odds — could be under 'odds', 'avgOdds', 'maxOdds', 'winnerOdds'
      const oddsData = row?.odds ?? row?.avgOdds ?? row?.maxOdds ?? {}
      const outcomes: { name: string; price: number }[] = []

      const home1x2 = oddsData?.['1'] ?? oddsData?.home ?? 0
      const drawX = oddsData?.['X'] ?? oddsData?.draw ?? 0
      const away1x2 = oddsData?.['2'] ?? oddsData?.away ?? 0

      if (home1x2 > 1) outcomes.push({ name: homeTeam, price: home1x2 })
      if (league.sport === 'soccer' && drawX > 1) outcomes.push({ name: 'Draw', price: drawX })
      if (away1x2 > 1) outcomes.push({ name: awayTeam, price: away1x2 })

      const markets: Market[] = outcomes.length >= 2
        ? [{ key: 'h2h', label: league.sport === 'soccer' ? '1X2' : 'Match Result', outcomes }]
        : []

      const bookmakers: BookmakerOdds[] = markets.length > 0
        ? [{ key: 'oddsportal_best', title: 'Best Available (OddsPortal)', lastUpdate: new Date().toISOString(), markets }]
        : []

      const startTime = row?.startTime ?? row?.startDate ?? row?.eventStart ?? ''
      events.push({
        id: `op_${league.id}_${homeTeam}_${awayTeam}`.replace(/\s+/g, '_').toLowerCase(),
        sport: league.sport,
        sportTitle: league.name,
        league: league.name,
        commenceTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        homeTeam,
        awayTeam,
        isLive: row?.isLive === true || row?.status === 'live',
        bookmakers,
      })
    } catch {
      // skip malformed rows
    }
  }

  return events
}

function parseOddsPortalHTML(html: string, league: LeagueMeta): Event[] {
  const $ = cheerio.load(html)
  const events: Event[] = []

  // OddsPortal uses class-based structure; try multiple selectors
  // New layout (2023+): div.eventRow
  // Older layout: table.table-main tr
  const rows = $('div[class*="eventRow"], tr.lo, tr.deactivate')

  rows.each((i, el) => {
    try {
      const row = $(el)

      // Extract team names — multiple possible selectors
      let homeTeam = ''
      let awayTeam = ''

      const teamLinks = row.find('a[href*="/"]').filter((_, a) => {
        const href = $(a).attr('href') ?? ''
        return href.includes(league.oddsportalPath?.split('/').filter(Boolean)[0] ?? 'soccer')
      })

      if (teamLinks.length >= 2) {
        // New format: participant names in separate elements
        homeTeam = $(teamLinks[0]).text().trim()
        awayTeam = $(teamLinks[1]).text().trim()
      } else {
        // Old format: "Team A - Team B" in a single cell
        const matchCell = row.find('td.name, .name.table-participant')
        const text = matchCell.text().trim()
        const parts = text.split(' - ')
        if (parts.length === 2) {
          homeTeam = parts[0].trim()
          awayTeam = parts[1].trim()
        }
      }

      if (!homeTeam || !awayTeam || homeTeam === awayTeam) return

      // Extract odds values — look for cells with numeric values
      const oddsCells = row.find('td[class*="odds-nowrp"], td.odds, span[class*="odds-wrap"], td.table-odds')
      const oddsValues: number[] = []

      oddsCells.each((_, cell) => {
        const text = $(cell).text().trim()
        const val = parseOdds(text)
        if (val > 1.0 && val < 100) oddsValues.push(val)
      })

      if (oddsValues.length < 2) return

      // Build consensus bookmaker from OddsPortal "best odds" display
      const isSoccer = league.sport === 'soccer'
      const outcomes = isSoccer && oddsValues.length >= 3
        ? [
            { name: 'Home', price: oddsValues[0] },
            { name: 'Draw', price: oddsValues[1] },
            { name: 'Away', price: oddsValues[2] },
          ]
        : [
            { name: 'Home', price: oddsValues[0] },
            { name: 'Away', price: oddsValues[oddsValues.length - 1] },
          ]

      const bookmakers: BookmakerOdds[] = [{
        key: 'oddsportal_best',
        title: 'Best Available (OddsPortal)',
        lastUpdate: new Date().toISOString(),
        markets: [{ key: 'h2h', label: isSoccer ? '1X2' : 'Match Result', outcomes }],
      }]

      // Try to extract match time
      const timeEl = row.find('td.table-time, .eventTime, td[class*="time"]')
      const timeStr = timeEl.first().text().trim()
      const commenceTime = parseOddsPortalTime(timeStr)

      events.push({
        id: `op_${league.id}_${homeTeam}_${awayTeam}`.replace(/\s/g, '_').toLowerCase(),
        sport: league.sport,
        sportTitle: league.name,
        league: league.name,
        commenceTime,
        homeTeam,
        awayTeam,
        isLive: timeStr.includes('Live') || timeStr.toLowerCase().includes("'"),
        bookmakers,
      })
    } catch {
      // Skip malformed rows
    }
  })

  return events
}

function parseOddsPortalTime(timeStr: string): string {
  if (!timeStr) return new Date().toISOString()
  try {
    // Format: "14:30" — assume today
    if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(':').map(Number)
      const d = new Date()
      d.setHours(h, m, 0, 0)
      return d.toISOString()
    }
    // Format: "20 May" or "May 20"
    const parsed = new Date(timeStr)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  } catch {}
  return new Date().toISOString()
}

/** Scrape the top leagues across all sports from OddsPortal */
export async function getOddsPortalEvents(maxLeagues = 12): Promise<Event[]> {
  const cacheKey = 'oddsportal_events'
  const cached = cacheGet<Event[]>(cacheKey, 600_000) // 10 min cache
  if (cached) return cached

  // Prioritize tier-1 leagues with an oddsportalPath
  const targetLeagues = LEAGUES
    .filter(l => l.oddsportalPath && l.tier === 1)
    .slice(0, maxLeagues)

  const results = await Promise.allSettled(
    targetLeagues.map(league => scrapeLeaguePage(league))
  )

  const all: Event[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  console.log(`[oddsportal] scraped ${all.length} events from ${targetLeagues.length} leagues`)
  cacheSet(cacheKey, all)
  return all
}

/** Scrape a specific league by its OddsPortal path */
export async function getOddsPortalLeague(path: string, sport: Event['sport']): Promise<Event[]> {
  const league: LeagueMeta = {
    id: path.replace(/\//g, '_'),
    name: path.split('/').filter(Boolean).pop() ?? 'Unknown',
    sport,
    country: 'Unknown',
    continent: 'Unknown',
    tier: 1,
    oddsportalPath: path,
  }
  return scrapeLeaguePage(league)
}
