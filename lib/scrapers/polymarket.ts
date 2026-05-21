/**
 * Polymarket — decentralised prediction market running on Polygon.
 *
 * Covers: Politics, Crypto, Sports, Finance, Science, Entertainment.
 * API: Gamma API (free, no auth)
 *   GET https://gamma-api.polymarket.com/events?active=true&closed=false
 *   GET https://gamma-api.polymarket.com/markets?active=true
 *
 * Pricing: outcomePrices is a JSON array of strings, each 0–1 representing
 * implied probability.  Decimal odds = 1 / price.
 *   price 0.65 → decimal 1.538
 *
 * Multi-outcome markets are supported — all runners appear in one h2h market.
 */

import { Event, BookmakerOdds, Market, EventCategory } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const GAMMA_BASE = 'https://gamma-api.polymarket.com'
const CACHE_KEY  = 'polymarket_events'
const CACHE_TTL  = 300_000

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolyTag {
  id: string
  label: string
}

interface PolyMarket {
  id: string
  question: string
  conditionId?: string
  /** JSON-encoded string array, e.g. '["Yes","No"]' */
  outcomes: string
  /** JSON-encoded string array of 0–1 prices, e.g. '["0.72","0.28"]' */
  outcomePrices: string
  volume: number
  active: boolean
  closed: boolean
  endDate?: string
}

interface PolyEvent {
  id: string
  title: string
  description?: string
  active: boolean
  closed: boolean
  endDate?: string
  startDate?: string
  volume?: number
  tags?: PolyTag[]
  markets?: PolyMarket[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priceToDecimal(price: number): number {
  if (price <= 0.01 || price >= 0.99) return 0
  return parseFloat((1 / price).toFixed(3))
}

function tagsToCategory(tags?: PolyTag[]): EventCategory {
  const labels = (tags ?? []).map(t => t.label.toLowerCase()).join(' ')
  if (labels.includes('politi') || labels.includes('elect') || labels.includes('govern')) return 'politics'
  if (labels.includes('crypto') || labels.includes('bitcoin') || labels.includes('web3') || labels.includes('defi')) return 'crypto'
  if (labels.includes('financ') || labels.includes('market') || labels.includes('stock') || labels.includes('econ')) return 'finance'
  if (labels.includes('sport') || labels.includes('nfl') || labels.includes('nba') || labels.includes('soccer') || labels.includes('tennis')) return 'sport'
  if (labels.includes('climate') || labels.includes('science') || labels.includes('tech') || labels.includes('ai')) return 'science'
  if (labels.includes('entertain') || labels.includes('award') || labels.includes('music') || labels.includes('film')) return 'entertainment'
  return 'politics'
}

function parseMarket(ev: PolyEvent, mkt: PolyMarket): Event | null {
  let outcomeNames: string[] = []
  let outcomePrices: number[] = []

  try { outcomeNames  = JSON.parse(mkt.outcomes) }    catch { return null }
  try { outcomePrices = JSON.parse(mkt.outcomePrices).map(Number) } catch { return null }

  if (outcomeNames.length < 2 || outcomePrices.length < 2) return null

  const marketOutcomes = outcomeNames
    .map((name, i) => ({ name, price: priceToDecimal(outcomePrices[i] ?? 0) }))
    .filter(o => o.price > 1)

  if (marketOutcomes.length < 2) return null

  const h2hMarket: Market = {
    key: 'h2h',
    label: 'Prediction',
    outcomes: marketOutcomes,
  }

  const bk: BookmakerOdds = {
    key: 'polymarket',
    title: 'Polymarket',
    lastUpdate: new Date().toISOString(),
    markets: [h2hMarket],
  }

  const commenceTime = mkt.endDate
    ? new Date(mkt.endDate).toISOString()
    : (ev.endDate ? new Date(ev.endDate).toISOString() : new Date(Date.now() + 30 * 86_400_000).toISOString())

  const category = tagsToCategory(ev.tags)

  // Use first two outcomes as homeTeam/awayTeam for display consistency
  return {
    id: `pm_${mkt.id}`,
    sport: 'prediction_market',
    sportTitle: 'Prediction Market',
    league: (ev.tags?.[0]?.label ?? 'Polymarket').substring(0, 40),
    commenceTime,
    homeTeam: outcomeNames[0] ?? 'Yes',
    awayTeam: outcomeNames[1] ?? 'No',
    isLive: false,
    bookmakers: [bk],
    category,
    question: mkt.question ?? ev.title,
    volume: mkt.volume ?? ev.volume,
  }
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchPolyEvents(): Promise<Event[]> {
  await rateLimit('gamma-api.polymarket.com', 600)

  const url = `${GAMMA_BASE}/events?active=true&closed=false&limit=100&order=volume&ascending=false`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://polymarket.com/'),
    timeoutMs: 20_000,
    label: 'polymarket:events',
  })

  if (!res?.ok) return []

  const raw: PolyEvent[] | null = await res.json().catch(() => null)
  if (!Array.isArray(raw)) return []

  const events: Event[] = []

  for (const ev of raw) {
    if (!ev.active || ev.closed) continue
    const markets = ev.markets ?? []

    // Use the highest-volume market per event
    const sorted = markets
      .filter(m => m.active && !m.closed)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))

    if (sorted.length === 0) continue

    const parsed = parseMarket(ev, sorted[0])
    if (parsed) events.push(parsed)
  }

  return events
}

async function fetchPolyMarkets(): Promise<Event[]> {
  await rateLimit('gamma-api.polymarket.com', 600)

  const url = `${GAMMA_BASE}/markets?active=true&limit=100&order=volume&ascending=false`
  const res = await safeFetch(url, {
    headers: jsonHeaders('https://polymarket.com/'),
    timeoutMs: 20_000,
    label: 'polymarket:markets',
  })

  if (!res?.ok) return []

  const raw: PolyMarket[] | null = await res.json().catch(() => null)
  if (!Array.isArray(raw)) return []

  const events: Event[] = []
  for (const mkt of raw) {
    if (!mkt.active || mkt.closed) continue
    const fakeEvent: PolyEvent = {
      id: mkt.id,
      title: mkt.question,
      active: true,
      closed: false,
      endDate: mkt.endDate,
      markets: [mkt],
    }
    const parsed = parseMarket(fakeEvent, mkt)
    if (parsed) events.push(parsed)
  }
  return events
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getPolymarketEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>(CACHE_KEY, CACHE_TTL)
  if (cached) return cached

  try {
    // Prefer /events (richer data); fall back to /markets
    let events = await fetchPolyEvents()
    if (events.length === 0) events = await fetchPolyMarkets()

    // Deduplicate by question (trimmed, lowercased)
    const seen = new Set<string>()
    const deduped = events.filter(e => {
      const key = (e.question ?? e.homeTeam).toLowerCase().substring(0, 80)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[polymarket] ${deduped.length} prediction markets`)
    cacheSet(CACHE_KEY, deduped)
    return deduped
  } catch (e) {
    console.error('[polymarket]', e)
    return []
  }
}
