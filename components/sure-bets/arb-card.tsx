'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatMatchDate, formatMatchTime, SPORT_EMOJIS } from '@/lib/utils'
import type { ArbOpportunity } from '@/lib/types'

const QUICK_BANKROLLS = [50, 100, 200, 500, 1000, 2000]

function normOutcome(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

interface ArbStakeWithAnalysis {
  outcome: string
  bookmakerTitle: string
  bookmaker: string
  odds: number
  stakeAmount: number
  returns: number
  impliedProb: number
  trueProb: number
  fairOdds: number
  edgePct: number
  stakePercent: number
}

interface MarketRow {
  bk: string
  title: string
  odds: number
  impliedProb: number
  /** positive = value for bettor; negative = house has edge */
  edgeVsMarket: number
  isArbLeg: boolean
}

export function ArbCard({ opp }: { opp: ArbOpportunity }) {
  const [expanded,  setExpanded]  = useState(false)
  const [bankroll,  setBankroll]  = useState(100)
  const [rawInput,  setRawInput]  = useState('100')

  // ── Arb leg analysis (normalised fair probs from the arb itself) ──────────
  const total = opp.totalImpliedProbability
  const legs: ArbStakeWithAnalysis[] = opp.stakes.map(s => {
    const impliedProb = 1 / s.odds
    const trueProb    = impliedProb / total
    const fairOdds    = 1 / trueProb
    const edgePct     = (s.odds / fairOdds - 1) * 100
    return { ...s, impliedProb, trueProb, fairOdds, edgePct, stakePercent: s.stakePercent }
  })

  // ── Bankroll-scaled values (recalculate from stakePercent) ───────────────
  const netProfitAmount  = bankroll * opp.profitPct / 100   // same whichever outcome wins
  const totalReturns     = bankroll + netProfitAmount

  // ── Market comparison: all bookmakers for each outcome ────────────────────
  // Fair value per outcome = average implied prob across all books (market avg).
  const marketComparison: { outcome: string; rows: MarketRow[]; fairOdds: number }[] = legs.map(leg => {
    const normKey = normOutcome(leg.outcome)
    const rows: MarketRow[] = []

    for (const bk of opp.event.bookmakers) {
      const market = bk.markets.find(m => m.key === opp.market)
      if (!market) continue
      const outcome = market.outcomes.find(o => normOutcome(o.name) === normKey)
      if (!outcome) continue
      rows.push({
        bk:          bk.key,
        title:       bk.title,
        odds:        outcome.price,
        impliedProb: 1 / outcome.price,
        edgeVsMarket: 0, // filled below
        isArbLeg:    bk.key === leg.bookmaker,
      })
    }

    if (rows.length === 0) return { outcome: leg.outcome, rows, fairOdds: leg.fairOdds }

    // Market average implied prob → fair odds
    const avgImplied = rows.reduce((s, r) => s + r.impliedProb, 0) / rows.length
    const fairOdds   = 1 / avgImplied

    for (const r of rows) {
      r.edgeVsMarket = (r.odds / fairOdds - 1) * 100
    }

    // Sort best → worst odds
    rows.sort((a, b) => b.odds - a.odds)

    return { outcome: leg.outcome, rows, fairOdds }
  })

  const profit = opp.profitPct

  return (
    <Card className={`border-l-4 border-l-emerald-500 transition-colors ${expanded ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20'}`}>
      {/* ── Summary row (always visible, click to expand) ── */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1.5">
              <span>{SPORT_EMOJIS[opp.event.sport] ?? '🏟'} {opp.event.league}</span>
              <span>·</span>
              <span>{opp.marketLabel}</span>
              <span>·</span>
              <span>{formatMatchDate(opp.event.commenceTime)} {formatMatchTime(opp.event.commenceTime)}</span>
              {opp.event.isLive && <Badge variant="live">LIVE</Badge>}
            </div>

            {/* Match */}
            <h3 className="font-bold text-white text-base mb-2">
              {opp.event.homeTeam} <span className="text-zinc-500">vs</span> {opp.event.awayTeam}
            </h3>

            {/* Leg pills */}
            <div className="flex flex-wrap gap-2">
              {legs.map(s => (
                <span key={s.outcome} className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 rounded-full px-3 py-1">
                  <span className="text-zinc-400">{s.outcome}</span>
                  <span className="text-emerald-400 font-mono font-semibold">{s.odds.toFixed(2)}</span>
                  <span className="text-zinc-600">@ {s.bookmakerTitle}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Profit badge + chevron */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">+{profit.toFixed(2)}%</div>
              <div className="text-xs text-zinc-500">guaranteed profit</div>
              <div className="text-xs text-zinc-600 mt-0.5">
                {(total * 100).toFixed(1)}% implied
              </div>
            </div>
            {expanded
              ? <ChevronUp  className="h-4 w-4 text-zinc-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
          </div>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-zinc-800 p-5 space-y-6">

          {/* 0. Bankroll Calculator */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Stake Calculator
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              {/* Bankroll input */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-sm">Bankroll:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">£</span>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={rawInput}
                    onChange={e => {
                      setRawInput(e.target.value)
                      const n = parseFloat(e.target.value)
                      if (!isNaN(n) && n >= 1) setBankroll(n)
                    }}
                    onBlur={() => {
                      const n = parseFloat(rawInput)
                      const safe = (!isNaN(n) && n >= 1) ? n : 100
                      setBankroll(safe)
                      setRawInput(String(safe))
                    }}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-1.5 text-white text-sm w-28 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Quick-select buttons */}
              <div className="flex flex-wrap gap-1">
                {QUICK_BANKROLLS.map(b => (
                  <button
                    key={b}
                    onClick={() => { setBankroll(b); setRawInput(String(b)) }}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      bankroll === b
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500'
                    }`}
                  >
                    £{b >= 1000 ? `${b / 1000}k` : b}
                  </button>
                ))}
              </div>

              {/* Result summary */}
              <div className="ml-auto flex gap-4 text-right">
                <div>
                  <div className="text-xs text-zinc-500">Net profit</div>
                  <div className="font-bold text-emerald-400 font-mono">+£{netProfitAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Total returns</div>
                  <div className="font-bold text-white font-mono">£{totalReturns.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Probability breakdown — the "why" */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              Why it&apos;s a sure bet — misplaced odds analysis
            </h4>

            <div className="space-y-3">
              {legs.map(s => (
                <div key={s.outcome} className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="font-semibold text-white">{s.outcome}</span>
                      <span className="text-zinc-500 text-sm ml-2">@ {s.bookmakerTitle}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-bold text-lg">{s.odds.toFixed(2)}</span>
                      <span className="text-zinc-500 text-xs ml-2">
                        vs fair <span className="text-zinc-300 font-mono">{s.fairOdds.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Probability bar */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-500 w-28 shrink-0">Implied prob</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(s.impliedProb * 100, 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-zinc-300 w-10 text-right">
                      {(s.impliedProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-1">
                    <span className="text-zinc-500 w-28 shrink-0">True prob (norm.)</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-zinc-500 rounded-full"
                        style={{ width: `${Math.min(s.trueProb * 100, 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-zinc-300 w-10 text-right">
                      {(s.trueProb * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Edge callout */}
                  <div className="mt-2 text-xs text-emerald-400 font-semibold">
                    {s.bookmakerTitle} is pricing this {s.edgePct.toFixed(1)}% above fair value
                    {' '}({s.odds.toFixed(2)} vs fair {s.fairOdds.toFixed(2)})
                  </div>
                </div>
              ))}
            </div>

            {/* Summary math */}
            <div className="mt-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-zinc-400">
                Sum of implied probabilities:{' '}
                {legs.map((s, i) => (
                  <span key={s.outcome}>
                    <span className="font-mono text-zinc-300">{(s.impliedProb * 100).toFixed(1)}%</span>
                    {i < legs.length - 1 && <span className="text-zinc-600 mx-1">+</span>}
                  </span>
                ))}
                {' '}= <span className="font-mono font-bold text-red-400">{(total * 100).toFixed(2)}%</span>
              </div>
              <div className="text-emerald-400 font-bold">
                → {(100 - total * 100).toFixed(2)}% guaranteed profit
              </div>
            </div>
          </div>

          {/* 2. Market comparison — all bookmakers per outcome */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              All bookmaker prices — where the market stands
            </h4>
            <p className="text-xs text-zinc-600 mb-4">
              Green = above market average (value). Amber / red = below market average (house edge).
              The arb legs are the outliers at the top.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {marketComparison.map(({ outcome, rows, fairOdds }) => (
                <div key={outcome} className="rounded-lg border border-zinc-800 overflow-hidden">
                  {/* Outcome header */}
                  <div className="bg-zinc-800/60 px-3 py-2 flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-sm">{outcome}</span>
                    <span className="text-xs text-zinc-500 font-mono">
                      fair <span className="text-zinc-300">{fairOdds.toFixed(2)}</span>
                    </span>
                  </div>

                  {/* Bookmaker rows */}
                  <div className="divide-y divide-zinc-800/60">
                    {rows.map(r => {
                      // Colour coding
                      let rowClass  = 'bg-zinc-900'
                      let oddsClass = 'text-zinc-300'
                      let badge: string | null = null

                      if (r.isArbLeg) {
                        rowClass  = 'bg-emerald-950/40'
                        oddsClass = 'text-emerald-400 font-bold'
                        badge     = '★ arb'
                      } else if (r.edgeVsMarket >= 3) {
                        oddsClass = 'text-blue-400'
                        badge     = `+${r.edgeVsMarket.toFixed(1)}%`
                      } else if (r.edgeVsMarket <= -8) {
                        rowClass  = 'bg-red-950/20'
                        oddsClass = 'text-red-400'
                        badge     = `${r.edgeVsMarket.toFixed(1)}%`
                      } else if (r.edgeVsMarket <= -3) {
                        oddsClass = 'text-amber-400'
                        badge     = `${r.edgeVsMarket.toFixed(1)}%`
                      }

                      return (
                        <div key={r.bk} className={`flex items-center justify-between px-3 py-2 ${rowClass}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-zinc-400 truncate">{r.title}</span>
                            {r.isArbLeg && (
                              <span className="shrink-0 text-[10px] bg-emerald-800/60 text-emerald-300 rounded px-1.5 py-0.5 font-medium">
                                ★ arb leg
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {badge && !r.isArbLeg && (
                              <span className={`text-[10px] font-mono ${r.edgeVsMarket >= 3 ? 'text-blue-500' : r.edgeVsMarket <= -8 ? 'text-red-500' : 'text-amber-500'}`}>
                                {badge}
                              </span>
                            )}
                            <span className={`font-mono text-sm ${oddsClass}`}>{r.odds.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Column legend — market avg line */}
                  {rows.length > 0 && (
                    <div className="bg-zinc-800/30 px-3 py-1.5 flex justify-between text-[10px] text-zinc-600">
                      <span>{rows.length} bookmakers</span>
                      <span>avg {(rows.reduce((s, r) => s + r.odds, 0) / rows.length).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Stakes table */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Optimal stakes for £{bankroll.toLocaleString()} bankroll
            </h4>
            <div className="rounded-lg overflow-hidden border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800/60 text-zinc-400 text-xs">
                    <th className="text-left px-3 py-2 font-medium">Outcome</th>
                    <th className="text-left px-3 py-2 font-medium">Bookmaker</th>
                    <th className="text-right px-3 py-2 font-medium">Odds</th>
                    <th className="text-right px-3 py-2 font-medium">Stake</th>
                    <th className="text-right px-3 py-2 font-medium">Returns</th>
                    <th className="text-right px-3 py-2 font-medium">Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {opp.stakes.map((s, i) => {
                    const scaledStake  = (s.stakePercent / 100) * bankroll
                    const scaledReturn = scaledStake * s.odds
                    return (
                      <tr key={s.outcome} className={i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/60'}>
                        <td className="px-3 py-2.5 text-zinc-200 font-medium">{s.outcome}</td>
                        <td className="px-3 py-2.5 text-zinc-400">{s.bookmakerTitle}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-bold">{s.odds.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-zinc-200">£{scaledStake.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-zinc-200">£{scaledReturn.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400">+£{netProfitAmount.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-950/30 border-t border-emerald-800/50 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-xs text-zinc-400">Total invested</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-200">£{bankroll.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">£{totalReturns.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">+£{netProfitAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}
    </Card>
  )
}
