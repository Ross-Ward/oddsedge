/**
 * API route tests
 *
 * All routes are tested by importing the handler directly and calling it
 * with a mock Request object. Network calls are mocked via vi.mock().
 *
 * Use cases covered:
 *   UC-API-1  GET /api/events — returns all events with success:true
 *   UC-API-2  GET /api/events?sport=soccer — filters by sport
 *   UC-API-3  GET /api/events — returns 500 on library error
 *   UC-API-4  GET /api/arbitrage — returns arb opportunities
 *   UC-API-5  GET /api/arbitrage — returns 500 on library error
 *   UC-API-6  GET /api/news — returns news articles
 *   UC-API-7  GET /api/news — returns 500 on library error
 *   UC-API-8  GET /api/dropping-odds — returns dropping odds data
 *   UC-API-9  GET /api/dropping-odds — returns 500 on library error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ARB_EVENT, NO_ARB_EVENT, INJURY_ARTICLE } from '../fixtures'
import type { ArbOpportunity, DroppingOdds } from '@/lib/types'

// ── Mocks — must be at top level so Vitest can hoist them ─────────────────────

vi.mock('@/lib/aggregator', () => ({
  getAllEvents: vi.fn(),
  getArbOpportunities: vi.fn(),
  getDroppingOdds: vi.fn(),
}))

vi.mock('@/lib/news', () => ({
  getNewsArticles: vi.fn(),
}))

import * as aggregator from '@/lib/aggregator'
import * as newsLib from '@/lib/news'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url)
}

async function readJson(response: Response) {
  return response.json()
}

// ── UC-API-1 & UC-API-2 & UC-API-3: GET /api/events ─────────────────────────

describe('GET /api/events', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns success:true with all events when no sport filter applied', async () => {
    vi.mocked(aggregator.getAllEvents).mockResolvedValue([ARB_EVENT, NO_ARB_EVENT])

    const { GET } = await import('@/app/api/events/route')
    const res = await GET(makeRequest('http://localhost:3000/api/events'))
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(body.data).toHaveLength(2)
  })

  it('filters events by sport query param', async () => {
    vi.mocked(aggregator.getAllEvents).mockResolvedValue([ARB_EVENT, NO_ARB_EVENT])

    const { GET } = await import('@/app/api/events/route')
    const res = await GET(makeRequest('http://localhost:3000/api/events?sport=soccer'))
    const body = await readJson(res)

    // Both fixture events are soccer
    expect(body.success).toBe(true)
    expect(body.data.every((e: { sport: string }) => e.sport === 'soccer')).toBe(true)
  })

  it('returns only basketball events when sport=basketball', async () => {
    vi.mocked(aggregator.getAllEvents).mockResolvedValue([ARB_EVENT, NO_ARB_EVENT])

    const { GET } = await import('@/app/api/events/route')
    // ARB_EVENT and NO_ARB_EVENT are soccer — result should be empty
    const res = await GET(makeRequest('http://localhost:3000/api/events?sport=basketball'))
    const body = await readJson(res)

    expect(body.success).toBe(true)
    expect(body.count).toBe(0)
    expect(body.data).toHaveLength(0)
  })

  it('returns 500 when getAllEvents throws', async () => {
    vi.mocked(aggregator.getAllEvents).mockRejectedValue(new Error('DB down'))

    const { GET } = await import('@/app/api/events/route')
    const res = await GET(makeRequest('http://localhost:3000/api/events'))
    const body = await readJson(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })
})

// ── UC-API-4 & UC-API-5: GET /api/arbitrage ──────────────────────────────────

describe('GET /api/arbitrage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns success:true with arbitrage opportunities', async () => {
    const mockArb: ArbOpportunity = {
      id: 'arb_1',
      event: ARB_EVENT,
      market: 'h2h',
      marketLabel: 'Match Result',
      profitPct: 2.1,
      stakes: [],
      totalImpliedProbability: 0.979,
      fetchedAt: new Date().toISOString(),
    }
    vi.mocked(aggregator.getArbOpportunities).mockResolvedValue([mockArb])

    const { GET } = await import('@/app/api/arbitrage/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.count).toBe(1)
    expect(body.data[0].profitPct).toBe(2.1)
  })

  it('returns an empty array when no arbitrage exists', async () => {
    vi.mocked(aggregator.getArbOpportunities).mockResolvedValue([])

    const { GET } = await import('@/app/api/arbitrage/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
  })

  it('returns 500 when getArbOpportunities throws', async () => {
    vi.mocked(aggregator.getArbOpportunities).mockRejectedValue(new Error('timeout'))

    const { GET } = await import('@/app/api/arbitrage/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })
})

// ── UC-API-6 & UC-API-7: GET /api/news ───────────────────────────────────────

describe('GET /api/news', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns success:true with news articles', async () => {
    vi.mocked(newsLib.getNewsArticles).mockResolvedValue([INJURY_ARTICLE])

    const { GET } = await import('@/app/api/news/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.count).toBe(1)
    expect(body.data[0].id).toBe('art_injury')
  })

  it('returns 500 when getNewsArticles throws', async () => {
    vi.mocked(newsLib.getNewsArticles).mockRejectedValue(new Error('RSS unavailable'))

    const { GET } = await import('@/app/api/news/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })
})

// ── UC-API-8 & UC-API-9: GET /api/dropping-odds ──────────────────────────────

describe('GET /api/dropping-odds', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns success:true with dropping odds data', async () => {
    const mockDrop: DroppingOdds = {
      id: 'drop_1',
      event: ARB_EVENT,
      bookmaker: 'bookA',
      bookmakerTitle: 'Book A',
      outcome: 'Home',
      market: 'h2h',
      previousOdds: 3.20,
      currentOdds: 2.80,
      changePct: -12.5,
      droppedAt: new Date().toISOString(),
    }
    vi.mocked(aggregator.getDroppingOdds).mockResolvedValue([mockDrop])

    const { GET } = await import('@/app/api/dropping-odds/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.count).toBe(1)
    expect(body.data[0].changePct).toBe(-12.5)
  })

  it('returns 500 when getDroppingOdds throws', async () => {
    vi.mocked(aggregator.getDroppingOdds).mockRejectedValue(new Error('cache miss'))

    const { GET } = await import('@/app/api/dropping-odds/route')
    const res = await GET()
    const body = await readJson(res)

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
  })
})
