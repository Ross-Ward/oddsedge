import { ArbOpportunity, ArbStake, Event, Market } from './types'

/**
 * Arbitrage (sure-bet) calculator.
 *
 * For a set of outcomes where each comes from the BEST odds available
 * across all bookmakers:
 *   implied_prob = sum(1 / best_odds[i])
 *   If implied_prob < 1.0  →  arbitrage exists
 *   profit_pct = (1/implied_prob - 1) * 100
 */

interface OutcomeWithBook {
  outcome: string
  odds: number
  bookmaker: string
  bookmakerTitle: string
  secondBestOdds?: number
}

export function findBestOdds(event: Event, marketKey: string): OutcomeWithBook[] {
  const outcomeMap = new Map<string, OutcomeWithBook>()

  for (const bk of event.bookmakers) {
    const market = bk.markets.find(m => m.key === marketKey)
    if (!market) continue

    for (const o of market.outcomes) {
      const existing = outcomeMap.get(o.name)
      if (!existing) {
        outcomeMap.set(o.name, {
          outcome: o.name,
          odds: o.price,
          bookmaker: bk.key,
          bookmakerTitle: bk.title,
        })
      } else if (o.price > existing.odds) {
        // New best — old best becomes second-best
        outcomeMap.set(o.name, {
          outcome: o.name,
          odds: o.price,
          bookmaker: bk.key,
          bookmakerTitle: bk.title,
          secondBestOdds: existing.odds,
        })
      } else if (!existing.secondBestOdds || o.price > existing.secondBestOdds) {
        // Better than current second-best but below current best
        existing.secondBestOdds = o.price
      }
    }
  }

  return Array.from(outcomeMap.values())
}

export function calculateArbitrage(
  event: Event,
  marketKey: string,
  marketLabel: string,
  bankroll = 100
): ArbOpportunity | null {
  const bestOdds = findBestOdds(event, marketKey)
  if (bestOdds.length < 2) return null

  // A real arbitrage requires placing bets at DIFFERENT bookmakers.
  // If all best prices are from the same book it is just a low-margin
  // market — not an exploitable opportunity.
  const uniqueBooks = new Set(bestOdds.map(o => o.bookmaker))
  if (uniqueBooks.size < 2) return null

  // Outlier filter: if any outcome's best odds are ≥40% above the second-best
  // available from another book, the data is likely stale/promotional rather
  // than a genuine market discrepancy (e.g. FanDuel stale EPL lines).
  const OUTLIER_RATIO = 1.40
  for (const o of bestOdds) {
    if (o.secondBestOdds && o.odds / o.secondBestOdds >= OUTLIER_RATIO) return null
  }

  // Sum of inverse odds = total implied probability
  const totalImplied = bestOdds.reduce((sum, o) => sum + 1 / o.odds, 0)

  // Only an arb if < 1
  if (totalImplied >= 1) return null

  // Sanity check: real-world arbs never exceed ~15%.
  // totalImplied < 0.87 means implied profit > 15% — almost always bad/mixed data
  // (e.g. 3-way market captured as 2-way, or data from different events merged incorrectly).
  if (totalImplied < 0.87) return null

  const profitPct = ((1 / totalImplied) - 1) * 100

  // Calculate optimal stakes for each outcome
  const stakes: ArbStake[] = bestOdds.map(o => {
    const stakePercent = (1 / o.odds / totalImplied) * 100
    const stakeAmount = (stakePercent / 100) * bankroll
    const returns = stakeAmount * o.odds
    return {
      bookmaker: o.bookmaker,
      bookmakerTitle: o.bookmakerTitle,
      outcome: o.outcome,
      odds: o.odds,
      stakePercent,
      stakeAmount,
      returns,
    }
  })

  return {
    id: `${event.id}_${marketKey}_${Date.now()}`,
    event,
    market: marketKey,
    marketLabel,
    profitPct,
    stakes,
    totalImpliedProbability: totalImplied,
    fetchedAt: new Date().toISOString(),
  }
}

export function scanAllArbitrage(events: Event[]): ArbOpportunity[] {
  const markets = [
    { key: 'h2h', label: 'Match Result (1X2)' },
    { key: 'spreads', label: 'Asian Handicap' },
    { key: 'totals', label: 'Over/Under' },
  ]

  const now = Date.now()
  const opportunities: ArbOpportunity[] = []

  for (const event of events) {
    // Skip events that have already started (within 2-minute grace for clock skew)
    if (event.commenceTime && new Date(event.commenceTime).getTime() < now - 2 * 60 * 1000) continue

    for (const market of markets) {
      const arb = calculateArbitrage(event, market.key, market.label)
      if (arb) opportunities.push(arb)
    }
  }

  // Sort by profit descending
  return opportunities.sort((a, b) => b.profitPct - a.profitPct)
}

/**
 * Given a set of events, find dropping odds (>= threshold % drop).
 * Compares current odds vs previously stored snapshot.
 */
export function detectDroppedOdds(
  events: Event[],
  snapshots: Map<string, number>, // key = `eventId_bookmaker_outcome_market`, value = previous odds
  threshold = 5
) {
  const dropped = []

  for (const event of events) {
    for (const bk of event.bookmakers) {
      for (const market of bk.markets) {
        for (const outcome of market.outcomes) {
          const key = `${event.id}_${bk.key}_${outcome.name}_${market.key}`
          const prev = snapshots.get(key)
          if (prev && prev > 0) {
            const changePct = ((outcome.price - prev) / prev) * 100
            if (changePct <= -threshold) {
              dropped.push({
                id: key,
                event,
                bookmaker: bk.key,
                bookmakerTitle: bk.title,
                outcome: outcome.name,
                market: market.key,
                previousOdds: prev,
                currentOdds: outcome.price,
                changePct,
                droppedAt: new Date().toISOString(),
              })
            }
          }
        }
      }
    }
  }

  return dropped.sort((a, b) => a.changePct - b.changePct)
}
