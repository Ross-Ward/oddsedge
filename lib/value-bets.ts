/**
 * Value bet detection.
 *
 * A value bet is any outcome where a bookmaker's offered odds are
 * meaningfully higher than the consensus "fair" odds derived from the
 * market as a whole.
 *
 * Fair odds calculation:
 *   1. Collect all bookmakers offering the same market.
 *   2. Average the implied probabilities per outcome (1 / odds).
 *   3. If Pinnacle is present use it as the sole sharp reference instead.
 *   4. EV% = (bookmaker_odds / fair_odds - 1) × 100
 */

import { Event } from './types'

export interface ValueBet {
  id: string
  event: Event
  bookmaker: string
  bookmakerTitle: string
  outcome: string
  /** The bookmaker's offered odds */
  odds: number
  /** Fair-value odds derived from consensus */
  fairOdds: number
  /** Expected value percentage */
  evPercent: number
  /** Bookmaker's implied probability */
  impliedProb: number
  /** Consensus fair probability */
  fairProb: number
  market: string
  marketLabel: string
  /** How many bookmakers priced this market (higher = more reliable consensus) */
  bookCount: number
}

const MARKETS = [
  { key: 'h2h',    label: 'Match Result' },
  { key: 'totals', label: 'Over/Under'   },
]

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getValueBets(
  events: Event[],
  minEV      = 3,   // minimum EV% to include
  maxEV      = 50,  // sanity cap — above this implies data corruption / live-game odds mismatch
  minBooks   = 2,   // minimum bookmakers needed for a reliable consensus
): ValueBet[] {
  const results: ValueBet[] = []

  for (const event of events) {
    for (const { key: mKey, label: mLabel } of MARKETS) {

      // Collect all bookmaker prices per normalised outcome name
      const byOutcome = new Map<string, {
        displayName: string
        entries: { bk: string; title: string; price: number }[]
      }>()

      for (const bk of event.bookmakers) {
        const market = bk.markets.find(m => m.key === mKey)
        if (!market) continue
        for (const o of market.outcomes) {
          const key = norm(o.name)
          if (!byOutcome.has(key)) {
            byOutcome.set(key, { displayName: o.name, entries: [] })
          }
          byOutcome.get(key)!.entries.push({ bk: bk.key, title: bk.title, price: o.price })
        }
      }

      // Build consensus fair probability per outcome
      const consensus = new Map<string, { fairProb: number; displayName: string; bookCount: number }>()
      for (const [key, { displayName, entries }] of byOutcome) {
        if (entries.length < minBooks) continue

        // Prefer Pinnacle as sharp reference (lowest overround)
        const pin = entries.find(e => e.bk === 'pinnacle')
        let fairProb: number
        if (pin) {
          fairProb = 1 / pin.price
        } else {
          // Average implied probability across all books
          fairProb = entries.reduce((s, e) => s + 1 / e.price, 0) / entries.length
        }
        consensus.set(key, { fairProb, displayName, bookCount: entries.length })
      }

      // Need consensus on at least 2 outcomes to validate the market shape
      if (consensus.size < 2) continue

      // Normalise fair probs so they sum to 1 (remove the bookmaker margin)
      const totalFairProb = Array.from(consensus.values()).reduce((s, c) => s + c.fairProb, 0)
      for (const c of consensus.values()) {
        c.fairProb = c.fairProb / totalFairProb
      }

      // Find value bets
      for (const bk of event.bookmakers) {
        const market = bk.markets.find(m => m.key === mKey)
        if (!market) continue
        for (const o of market.outcomes) {
          const key = norm(o.name)
          const c = consensus.get(key)
          if (!c) continue

          const fairOdds  = 1 / c.fairProb
          const ev        = (o.price / fairOdds - 1) * 100

          if (ev >= minEV && ev <= maxEV) {
            results.push({
              id:             `${event.id}_${bk.key}_${key}_${mKey}`,
              event,
              bookmaker:      bk.key,
              bookmakerTitle: bk.title,
              outcome:        c.displayName,
              odds:           o.price,
              fairOdds,
              evPercent:      ev,
              impliedProb:    1 / o.price,
              fairProb:       c.fairProb,
              market:         mKey,
              marketLabel:    mLabel,
              bookCount:      c.bookCount,
            })
          }
        }
      }
    }
  }

  return results.sort((a, b) => b.evPercent - a.evPercent)
}
