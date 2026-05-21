/**
 * Value Bets engine tests
 *
 * Use cases covered:
 *   UC-VB-1  Identify a bet where one bookmaker's odds exceed consensus fair value
 *   UC-VB-2  Require a minimum of 2 bookmakers for a reliable consensus
 *   UC-VB-3  Exclude bets below the minimum EV threshold (default 3%)
 *   UC-VB-4  Exclude bets above the sanity-cap EV threshold (default 50%)
 *   UC-VB-5  Sort results by EV% descending (highest EV first)
 *   UC-VB-6  Return empty array when no events are passed
 *   UC-VB-7  Return correct bookmaker attribution for the value bet
 *   UC-VB-8  Handle both h2h and totals markets
 */

import { describe, it, expect } from 'vitest'
import { getValueBets } from '@/lib/value-bets'
import { VALUE_EVENT, NO_ARB_EVENT, SINGLE_BK_EVENT, bk, h2h } from '../fixtures'
import type { Event } from '@/lib/types'

// ── UC-VB-1: genuine value bet detected ──────────────────────────────────────

describe('getValueBets — value bet detection', () => {
  it('finds a value bet when one bookmaker is significantly above consensus', () => {
    const bets = getValueBets([VALUE_EVENT])
    expect(bets.length).toBeGreaterThan(0)

    // The value bet should be on Home from Book B (2.40 vs ~2.00 consensus)
    const homeBet = bets.find(b => b.bookmaker === 'bookB' && b.outcome === 'Home')
    expect(homeBet).toBeDefined()
    expect(homeBet!.evPercent).toBeGreaterThanOrEqual(3)
    expect(homeBet!.odds).toBe(2.40)
  })

  it('correctly identifies which bookmaker offers the value', () => {
    const bets = getValueBets([VALUE_EVENT])
    const valueBet = bets.find(b => b.evPercent > 0)
    expect(valueBet?.bookmakerTitle).toBe('Book B')
  })

  it('calculates fair odds as the consensus across all books (not the max)', () => {
    const bets = getValueBets([VALUE_EVENT])
    const homeBet = bets.find(b => b.bookmaker === 'bookB' && b.outcome === 'Home')
    // Fair odds are normalised (margin-removed) average — slightly above the 2.00 majority
    // With bookA=2.00, bookB=2.40, bookC=2.00 the normalised consensus sits around 2.23
    expect(homeBet!.fairOdds).toBeGreaterThan(1.9)
    expect(homeBet!.fairOdds).toBeLessThan(2.35)
  })
})

// ── UC-VB-2: minimum bookmaker count ─────────────────────────────────────────

describe('getValueBets — minimum bookmaker count', () => {
  it('returns no bets when only one bookmaker covers the market', () => {
    const bets = getValueBets([SINGLE_BK_EVENT])
    expect(bets).toHaveLength(0)
  })

  it('respects a custom minBooks threshold', () => {
    // VALUE_EVENT has 3 books; requiring 4 should yield no bets
    const bets = getValueBets([VALUE_EVENT], 3, 50, 4)
    expect(bets).toHaveLength(0)
  })
})

// ── UC-VB-3: below minimum EV threshold ──────────────────────────────────────

describe('getValueBets — minimum EV threshold', () => {
  it('excludes bets whose EV falls below the minimum', () => {
    // Set an impossibly high minimum: no bet should qualify
    const bets = getValueBets([VALUE_EVENT], 99)
    expect(bets).toHaveLength(0)
  })

  it('includes bets at exactly the minimum EV when lowered', () => {
    // Lower the threshold enough to capture even marginal value
    const bets = getValueBets([VALUE_EVENT], 0)
    expect(bets.length).toBeGreaterThan(0)
  })
})

// ── UC-VB-4: above sanity-cap EV ─────────────────────────────────────────────

describe('getValueBets — sanity cap', () => {
  it('excludes bets above the maximum EV sanity cap', () => {
    // Construct an event where one book has absurdly high odds (data glitch)
    const glitchEvent: Event = {
      ...VALUE_EVENT,
      id: 'test_glitch',
      bookmakers: [
        bk('bookA', 'Book A', h2h(2.00, 3.40, 3.60)),
        bk('bookB', 'Book B', h2h(2.00, 3.30, 3.60)),
        bk('glitch', 'Glitch Book', h2h(120.00, 3.30, 3.60)), // impossibly high home odds
      ],
    }
    const bets = getValueBets([glitchEvent], 3, 50)
    // The glitch book's Home price should be filtered out (EV way above cap)
    const glitchBet = bets.find(b => b.bookmaker === 'glitch' && b.outcome === 'Home')
    expect(glitchBet).toBeUndefined()
  })
})

// ── UC-VB-5: sorting ──────────────────────────────────────────────────────────

describe('getValueBets — sorting', () => {
  it('returns bets sorted by EV% descending', () => {
    const bets = getValueBets([VALUE_EVENT, NO_ARB_EVENT])
    for (let i = 1; i < bets.length; i++) {
      expect(bets[i - 1].evPercent).toBeGreaterThanOrEqual(bets[i].evPercent)
    }
  })
})

// ── UC-VB-6: empty inputs ─────────────────────────────────────────────────────

describe('getValueBets — empty inputs', () => {
  it('returns an empty array when no events are provided', () => {
    expect(getValueBets([])).toHaveLength(0)
  })

  it('returns an empty array for an event with no bookmakers', () => {
    const empty: Event = { ...VALUE_EVENT, bookmakers: [] }
    expect(getValueBets([empty])).toHaveLength(0)
  })
})

// ── UC-VB-7: returned data shape ─────────────────────────────────────────────

describe('getValueBets — result shape', () => {
  it('includes all required fields on each result', () => {
    const [bet] = getValueBets([VALUE_EVENT])
    expect(bet).toHaveProperty('id')
    expect(bet).toHaveProperty('event')
    expect(bet).toHaveProperty('bookmaker')
    expect(bet).toHaveProperty('bookmakerTitle')
    expect(bet).toHaveProperty('outcome')
    expect(bet).toHaveProperty('odds')
    expect(bet).toHaveProperty('fairOdds')
    expect(bet).toHaveProperty('evPercent')
    expect(bet).toHaveProperty('impliedProb')
    expect(bet).toHaveProperty('fairProb')
    expect(bet).toHaveProperty('market')
    expect(bet).toHaveProperty('marketLabel')
    expect(bet).toHaveProperty('bookCount')
  })

  it('implied probability is the inverse of odds', () => {
    const [bet] = getValueBets([VALUE_EVENT])
    expect(bet.impliedProb).toBeCloseTo(1 / bet.odds, 5)
  })

  it('fair probability is the inverse of fair odds', () => {
    const [bet] = getValueBets([VALUE_EVENT])
    expect(bet.fairProb).toBeCloseTo(1 / bet.fairOdds, 2)
  })
})

// ── UC-VB-8: totals market ────────────────────────────────────────────────────

describe('getValueBets — totals market', () => {
  it('scans totals markets in addition to h2h', () => {
    const eventWithTotals: Event = {
      ...VALUE_EVENT,
      id: 'test_totals',
      bookmakers: [
        {
          key: 'bookA',
          title: 'Book A',
          lastUpdate: new Date().toISOString(),
          markets: [
            {
              key: 'totals',
              label: 'Over/Under',
              outcomes: [
                { name: 'Over 2.5', price: 1.90 },
                { name: 'Under 2.5', price: 1.90 },
              ],
            },
          ],
        },
        {
          key: 'bookB',
          title: 'Book B',
          lastUpdate: new Date().toISOString(),
          markets: [
            {
              key: 'totals',
              label: 'Over/Under',
              outcomes: [
                { name: 'Over 2.5', price: 2.30 }, // above consensus
                { name: 'Under 2.5', price: 1.75 },
              ],
            },
          ],
        },
      ],
    }
    const bets = getValueBets([eventWithTotals], 0)
    const totalsBet = bets.find(b => b.market === 'totals')
    expect(totalsBet).toBeDefined()
  })
})
