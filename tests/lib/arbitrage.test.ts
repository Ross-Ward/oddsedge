/**
 * Arbitrage engine tests
 *
 * Use cases covered:
 *   UC-ARB-1  Identify the best available odds per outcome across all bookmakers
 *   UC-ARB-2  Detect a genuine cross-bookmaker arbitrage opportunity
 *   UC-ARB-3  Reject a normal market (sum of best implied > 1)
 *   UC-ARB-4  Reject a single-bookmaker market (can't arb one book against itself)
 *   UC-ARB-5  Reject a suspiciously wide spread (profit > 15% = bad data)
 *   UC-ARB-6  Calculate optimal stake distribution that guarantees equal returns
 *   UC-ARB-7  Skip past events when scanning (they are already in progress)
 *   UC-ARB-8  Detect dropping odds given a previous snapshot
 */

import { describe, it, expect } from 'vitest'
import {
  findBestOdds,
  calculateArbitrage,
  scanAllArbitrage,
  detectDroppedOdds,
} from '@/lib/arbitrage'
import {
  ARB_EVENT,
  NO_ARB_EVENT,
  SINGLE_BK_EVENT,
  PAST_EVENT,
  STALE_ARB_EVENT,
  bk,
  h2h2,
} from '../fixtures'
import type { Event } from '@/lib/types'

// ── UC-ARB-1: findBestOdds ────────────────────────────────────────────────────

describe('findBestOdds', () => {
  it('returns the best price per outcome across bookmakers', () => {
    const best = findBestOdds(ARB_EVENT, 'h2h')
    const homeEntry = best.find(o => o.outcome === 'Home')
    const awayEntry = best.find(o => o.outcome === 'Away')

    // Book A offers 2.80 for Home — should win over Book B's 2.55
    expect(homeEntry?.odds).toBe(2.80)
    expect(homeEntry?.bookmakerTitle).toBe('Book A')

    // Book B offers 2.95 for Away — should win over Book A's 2.60
    expect(awayEntry?.odds).toBe(2.95)
    expect(awayEntry?.bookmakerTitle).toBe('Book B')
  })

  it('returns an empty array for a market that does not exist on the event', () => {
    const best = findBestOdds(ARB_EVENT, 'spreads')
    expect(best).toHaveLength(0)
  })

  it('tracks the second-best odds for each outcome', () => {
    const best = findBestOdds(ARB_EVENT, 'h2h')
    const homeEntry = best.find(o => o.outcome === 'Home')
    // Second-best home odds come from Book B (2.55)
    expect(homeEntry?.secondBestOdds).toBe(2.55)
  })
})

// ── UC-ARB-2: genuine arbitrage detected ─────────────────────────────────────

describe('calculateArbitrage — genuine arb', () => {
  it('detects a cross-bookmaker arbitrage and returns positive profit', () => {
    const result = calculateArbitrage(ARB_EVENT, 'h2h', 'Match Result')
    expect(result).not.toBeNull()
    expect(result!.profitPct).toBeGreaterThan(0)
    expect(result!.profitPct).toBeLessThan(15) // within sanity range
    expect(result!.totalImpliedProbability).toBeLessThan(1)
  })

  it('returns stakes for every outcome', () => {
    const result = calculateArbitrage(ARB_EVENT, 'h2h', 'Match Result')
    expect(result!.stakes).toHaveLength(3) // Home, Draw, Away
    for (const stake of result!.stakes) {
      expect(stake.stakeAmount).toBeGreaterThan(0)
      expect(stake.odds).toBeGreaterThan(1)
    }
  })
})

// ── UC-ARB-6: stake calculator guarantees equal returns ───────────────────────

describe('calculateArbitrage — stake calculator', () => {
  it('stakes sum to the bankroll', () => {
    const bankroll = 100
    const result = calculateArbitrage(ARB_EVENT, 'h2h', 'Match Result', bankroll)
    const totalStaked = result!.stakes.reduce((s, st) => s + st.stakeAmount, 0)
    expect(totalStaked).toBeCloseTo(bankroll, 1)
  })

  it('each outcome returns approximately the same guaranteed profit', () => {
    const result = calculateArbitrage(ARB_EVENT, 'h2h', 'Match Result', 100)
    const returns = result!.stakes.map(s => s.returns)
    const min = Math.min(...returns)
    const max = Math.max(...returns)
    // All returns should be within £0.10 of each other (rounding tolerance)
    expect(max - min).toBeLessThan(0.11)
  })
})

// ── UC-ARB-3: no arb in normal market ────────────────────────────────────────

describe('calculateArbitrage — no arb', () => {
  it('returns null when the best odds still sum to implied > 1', () => {
    const result = calculateArbitrage(NO_ARB_EVENT, 'h2h', 'Match Result')
    expect(result).toBeNull()
  })
})

// ── UC-ARB-4: single bookmaker ────────────────────────────────────────────────

describe('calculateArbitrage — single bookmaker', () => {
  it('returns null when only one bookmaker covers the market', () => {
    const result = calculateArbitrage(SINGLE_BK_EVENT, 'h2h', 'Match Result')
    expect(result).toBeNull()
  })
})

// ── UC-ARB-5: stale / corrupt data rejected ───────────────────────────────────

describe('calculateArbitrage — stale data sanity check', () => {
  it('returns null when implied profit exceeds 15% (suspected bad data)', () => {
    const result = calculateArbitrage(STALE_ARB_EVENT, 'h2h', 'Match Result')
    expect(result).toBeNull()
  })
})

// ── UC-ARB-7: scan skips past events ─────────────────────────────────────────

describe('scanAllArbitrage', () => {
  it('does not include arbs for events that have already started', () => {
    // PAST_EVENT has two bookmakers and would otherwise qualify
    const results = scanAllArbitrage([PAST_EVENT])
    expect(results).toHaveLength(0)
  })

  it('returns arbs for upcoming events', () => {
    const results = scanAllArbitrage([ARB_EVENT])
    expect(results.length).toBeGreaterThan(0)
  })

  it('sorts results by profit percentage descending', () => {
    const results = scanAllArbitrage([ARB_EVENT, NO_ARB_EVENT])
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].profitPct).toBeGreaterThanOrEqual(results[i].profitPct)
    }
  })
})

// ── UC-ARB-8: dropping odds detection ────────────────────────────────────────

describe('detectDroppedOdds', () => {
  it('flags an outcome whose odds dropped by more than the threshold', () => {
    const snapshot = new Map<string, number>([
      [`${ARB_EVENT.id}_bookA_Home_h2h`, 3.20], // was 3.20, now 2.80 = -12.5%
    ])
    const drops = detectDroppedOdds([ARB_EVENT], snapshot, 5)
    expect(drops.length).toBeGreaterThan(0)
    const drop = drops.find(d => d.outcome === 'Home')
    expect(drop).toBeDefined()
    expect(drop!.changePct).toBeLessThan(0)
    expect(Math.abs(drop!.changePct)).toBeGreaterThanOrEqual(5)
  })

  it('does not flag an outcome that has not dropped', () => {
    const snapshot = new Map<string, number>([
      [`${ARB_EVENT.id}_bookA_Home_h2h`, 2.80], // unchanged
    ])
    const drops = detectDroppedOdds([ARB_EVENT], snapshot, 5)
    const homeDrops = drops.filter(d => d.outcome === 'Home' && d.bookmaker === 'bookA')
    expect(homeDrops).toHaveLength(0)
  })

  it('does not flag an outcome that has risen in price', () => {
    const snapshot = new Map<string, number>([
      [`${ARB_EVENT.id}_bookA_Home_h2h`, 2.40], // was 2.40, now 2.80 = +16%
    ])
    const drops = detectDroppedOdds([ARB_EVENT], snapshot, 5)
    const homeDrops = drops.filter(d => d.outcome === 'Home' && d.bookmaker === 'bookA')
    expect(homeDrops).toHaveLength(0)
  })

  it('uses a custom threshold', () => {
    // Drop from 3.00 to 2.80 = -6.7%, should be caught at 5% but not at 10%
    const snapshot = new Map<string, number>([
      [`${ARB_EVENT.id}_bookA_Home_h2h`, 3.00],
    ])
    const dropsAt5 = detectDroppedOdds([ARB_EVENT], snapshot, 5)
    const dropsAt10 = detectDroppedOdds([ARB_EVENT], snapshot, 10)
    const homeAt5 = dropsAt5.filter(d => d.outcome === 'Home' && d.bookmaker === 'bookA')
    const homeAt10 = dropsAt10.filter(d => d.outcome === 'Home' && d.bookmaker === 'bookA')
    expect(homeAt5.length).toBeGreaterThan(0)
    expect(homeAt10).toHaveLength(0)
  })

  it('returns an empty array when no snapshot exists', () => {
    const drops = detectDroppedOdds([ARB_EVENT], new Map(), 5)
    // No previous data → nothing to compare against → nothing flagged
    expect(drops).toHaveLength(0)
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('arbitrage edge cases', () => {
  it('returns null for an event with no bookmakers', () => {
    const empty: Event = { ...ARB_EVENT, bookmakers: [] }
    expect(calculateArbitrage(empty, 'h2h', 'Match Result')).toBeNull()
  })

  it('requires at least 2 outcomes to produce a valid arb', () => {
    const oneOutcome: Event = {
      ...ARB_EVENT,
      bookmakers: [
        bk('bookA', 'Book A', {
          key: 'h2h',
          label: 'Match Result',
          outcomes: [{ name: 'Home', price: 1.50 }],
        }),
        bk('bookB', 'Book B', {
          key: 'h2h',
          label: 'Match Result',
          outcomes: [{ name: 'Home', price: 1.55 }],
        }),
      ],
    }
    expect(calculateArbitrage(oneOutcome, 'h2h', 'Match Result')).toBeNull()
  })
})
