/**
 * Utility function tests
 *
 * Use cases covered:
 *   UC-UTIL-1  timeAgo returns human-readable relative time
 *   UC-UTIL-2  formatOdds formats a decimal to 2dp
 *   UC-UTIL-3  formatPct prepends + for positives, shows sign for negatives
 *   UC-UTIL-4  formatCurrency formats with £ symbol
 *   UC-UTIL-5  formatMatchDate returns "Today" / "Tomorrow" / localised date
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  timeAgo,
  formatOdds,
  formatPct,
  formatCurrency,
  formatMatchDate,
} from '@/lib/utils'

// ── UC-UTIL-1: timeAgo ────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('returns "just now" for timestamps less than 1 minute ago', () => {
    const ts = new Date(Date.now() - 30_000).toISOString() // 30s ago
    expect(timeAgo(ts)).toBe('just now')
  })

  it('returns minutes for timestamps within the last hour', () => {
    const ts = new Date(Date.now() - 15 * 60_000).toISOString() // 15 min ago
    expect(timeAgo(ts)).toBe('15m ago')
  })

  it('returns hours for timestamps within the last day', () => {
    const ts = new Date(Date.now() - 3 * 3_600_000).toISOString() // 3h ago
    expect(timeAgo(ts)).toBe('3h ago')
  })

  it('returns days for timestamps older than 24 hours', () => {
    const ts = new Date(Date.now() - 2 * 86_400_000).toISOString() // 2d ago
    expect(timeAgo(ts)).toBe('2d ago')
  })
})

// ── UC-UTIL-2: formatOdds ─────────────────────────────────────────────────────

describe('formatOdds', () => {
  it('formats a whole number to 2 decimal places', () => {
    expect(formatOdds(2)).toBe('2.00')
  })

  it('formats a float to exactly 2 decimal places', () => {
    expect(formatOdds(2.5)).toBe('2.50')
    expect(formatOdds(1.909)).toBe('1.91')
  })

  it('rounds correctly', () => {
    expect(formatOdds(2.999)).toBe('3.00')
    // 1.005 has a known floating-point representation issue (stored as 1.00499...),
    // so use 1.006 which reliably rounds up to 1.01
    expect(formatOdds(1.006)).toBe('1.01')
  })
})

// ── UC-UTIL-3: formatPct ──────────────────────────────────────────────────────

describe('formatPct', () => {
  it('prepends + for a positive percentage', () => {
    expect(formatPct(2.5)).toBe('+2.50%')
  })

  it('shows the negative sign for a negative percentage', () => {
    expect(formatPct(-3.14)).toBe('-3.14%')
  })

  it('formats zero as +0.00%', () => {
    expect(formatPct(0)).toBe('+0.00%')
  })
})

// ── UC-UTIL-4: formatCurrency ─────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats an integer amount with £ sign', () => {
    expect(formatCurrency(100)).toBe('£100.00')
  })

  it('formats a fractional amount', () => {
    expect(formatCurrency(12.5)).toBe('£12.50')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('£0.00')
  })
})

// ── UC-UTIL-5: formatMatchDate ────────────────────────────────────────────────

describe('formatMatchDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today" for a date matching today', () => {
    const ts = new Date('2026-05-21T20:00:00Z').toISOString()
    expect(formatMatchDate(ts)).toBe('Today')
  })

  it('returns "Tomorrow" for a date matching tomorrow', () => {
    const ts = new Date('2026-05-22T15:00:00Z').toISOString()
    expect(formatMatchDate(ts)).toBe('Tomorrow')
  })

  it('returns a localised date string for a future date beyond tomorrow', () => {
    const ts = new Date('2026-05-25T15:00:00Z').toISOString()
    const result = formatMatchDate(ts)
    // Should NOT be Today or Tomorrow
    expect(result).not.toBe('Today')
    expect(result).not.toBe('Tomorrow')
    // Should contain some representation of the date
    expect(result).toBeTruthy()
  })
})
