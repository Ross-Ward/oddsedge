/**
 * Kalshi — US CFTC-regulated prediction exchange.
 *
 * Covers: Politics, Finance/Markets, Crypto, Sports, Science/Climate, Pop Culture.
 * API base: https://trading-api.kalshi.com/trade-api/v2
 *
 * No authentication required for GET (public market data).
 *
 * Pricing:  yes_bid / yes_ask are in cents (0–99).
 *   Mid-price  = (bid + ask) / 2  → probability p  (e.g. 65 cents = 0.65)
 *   Decimal    = 1 / p            (e.g. 0.65 → 1.538)
 */

import { Event, BookmakerOdds, Market, EventCategory } from '../types'
import { safeFetch, jsonHeaders, rateLimit } from './utils'
import { cacheGet, cacheSet } from '../cache'

const BASE = 'https://trading-api.kalshi.com/trade-api/v2'
const CACHE_KEY = 'kalshi_events'
const CACHE_TTL = 300_000 // 5 min

// ─── Types ───────────────────────────────────────────────────────────────────

interface KalshiMarket {
  ticker: string
  event_ticker: string
  title: string
  subtitle?: string
  yes_bid: number   // cents
  yes_ask: number
  no_bid: number
  no_ask: number
  volume: number
  open_interest: number
  close_time: string
  category: string
  status: string
}

interface KalshiMarketsResponse {
  markets: KalshiMarket[]
  cursor?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function centsToDecimal(cents: number): number {
  const p = cents / 100
  if (p <= 0.01 || p >= 0.99) return 0
  return parseFloat((1 / p).toFixed(3))
}

function kalshiCategoryToEventCategory(cat: string): EventCategory {
  const c = cat.toLowerCase()
  if (c.includes('politi') || c.includes('elect') || c.includes('gov')) return 'politics'
  if (c.includes('crypto') || c.includes('bitcoin') || c.includes('ethereum')) return 'crypto'
  if (c.includes('financ') || c.includes('market') || c.includes('stock') || c.includes('econ') || c.includes('fed') || c.includes('rate')) return 'finance'
  if (c.includes('sport') || c.includes('nfl') || c.includes('nba') || c.includes('mlb') || c.includes('nhl')) return 'sport'
  if (c.includes('climate') || c.includes('weather') || c.includes('science') || c.includes('tech')) return 'science'
  if (c.includes('entertain') || c.includes('award') || c.includes('music') || c.includes('film') || c.includes('tv')) return 'entertainment'
  return 'politics' // default for Kalshi (majority are policy/governance)
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────

async function fetchKalshiPage(cursor?: string): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({ limit: '200', status: 'open' })
  if (cursor) params.set('cursor', cursor)
  const url = `${BASE}/markets?${params}`

  await rateLimit('trading-api.kalshi.com', 600)

  const res = await safeFetch(url, {
    headers: jsonHeaders('https://kalshi.com/'),
    timeoutMs: 20_000,
    label: 'kalshi:markets',
  })
  if (!res?.ok) return []

  const data: KalshiMarketsResponse | null = await res.json().catch(() => null)
  return data?.markets ?? []
}

function buildEvents(markets: KalshiMarket[]): Event[] {
  const events: Event[] = []
  // Group by event_ticker — only take best-priced (highest volume) market per event
  const byEvent = new Map<string, KalshiMarket>()

  for (const mkt of markets) {
    if (mkt.status !== 'open') continue
    if (!mkt.yes_bid || !mkt.yes_ask || !mkt.no_bid || !mkt.no_ask) continue

    const existing = byEvent.get(mkt.event_ticker)
    if (!existing || mkt.volume > existing.volume) {
      byEvent.set(mkt.event_ticker, mkt)
    }
  }

  for (const mkt of byEvent.values()) {
    const yesMid = (mkt.yes_bid + mkt.yes_ask) / 2
    const noMid  = (mkt.no_bid  + mkt.no_ask)  / 2

    const yesDecimal = centsToDecimal(yesMid)
    const noDecimal  = centsToDecimal(noMid)
    if (yesDecimal < 1.01 || noDecimal < 1.01) continue

    const market: Market = {
      key: 'h2h',
      label: 'Yes / No',
      outcomes: [
        { name: 'Yes', price: yesDecimal },
        { name: 'No',  price: noDecimal  },
      ],
    }

    const bookmaker: BookmakerOdds = {
      key: 'kalshi',
      title: 'Kalshi',
      lastUpdate: new Date().toISOString(),
      markets: [market],
    }

    const category = kalshiCategoryToEventCategory(mkt.category)
    const commenceTime = mkt.close_time
      ? new Date(mkt.close_time).toISOString()
      : new Date(Date.now() + 7 * 86_400_000).toISOString()

    events.push({
      id: `kal_${mkt.ticker}`,
      sport: 'prediction_market',
      sportTitle: 'Prediction Market',
      league: mkt.category || 'Kalshi',
      commenceTime,
      homeTeam: 'Yes',
      awayTeam: 'No',
      isLive: false,
      bookmakers: [bookmaker],
      category,
      question: mkt.title,
      volume: mkt.volume,
    })
  }

  return events
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function getKalshiEvents(): Promise<Event[]> {
  const cached = cacheGet<Event[]>(CACHE_KEY, CACHE_TTL)
  if (cached) return cached

  try {
    const markets = await fetchKalshiPage()
    const events = buildEvents(markets)
    console.log(`[kalshi] ${events.length} prediction markets`)
    cacheSet(CACHE_KEY, events)
    return events
  } catch (e) {
    console.error('[kalshi]', e)
    return []
  }
}
