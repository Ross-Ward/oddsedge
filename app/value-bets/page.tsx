import { Suspense } from 'react'
import { getAllEvents } from '@/lib/aggregator'
import { getValueBets } from '@/lib/value-bets'
import { formatMatchDate, formatMatchTime, SPORT_EMOJIS } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Info } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Value Bets | OddsEdge',
  description: 'Find positive expected value bets where bookmaker odds exceed the fair-value consensus.',
}

export const revalidate = 300

function ValueBetSkeleton() {
  return (
    <Card className="p-4 space-y-2">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </Card>
  )
}

async function ValueBetsList() {
  const events = await getAllEvents()
  const bets = getValueBets(events, 3)

  if (bets.length === 0) {
    return (
      <Card className="p-12 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
        <p className="text-zinc-400 font-medium">No value bets found right now</p>
        <p className="text-zinc-600 text-sm mt-1 max-w-sm mx-auto">
          Value bets appear when at least one bookmaker prices a market above the
          consensus fair value by 3 %+. Check back soon.
        </p>
      </Card>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        <span className="text-sm text-zinc-500">
          Found <span className="text-blue-400 font-semibold">{bets.length}</span> value bets
          <span className="text-zinc-600 ml-1">(≥3 % EV · updated every 5 min)</span>
        </span>
      </div>

      <div className="space-y-3">
        {bets.slice(0, 60).map(bet => (
          <Card
            key={bet.id}
            className="p-4 border-l-4 border-l-blue-500 hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1.5">
                  <span>{SPORT_EMOJIS[bet.event.sport] ?? '🏟'} {bet.event.league}</span>
                  <span>·</span>
                  <span>{bet.marketLabel}</span>
                  <span>·</span>
                  <span>{formatMatchDate(bet.event.commenceTime)} {formatMatchTime(bet.event.commenceTime)}</span>
                </div>

                {/* Match */}
                <div className="font-bold text-white mb-2">
                  {bet.event.homeTeam} <span className="text-zinc-500">vs</span> {bet.event.awayTeam}
                </div>

                {/* Bet */}
                <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                  <span className="text-zinc-400">Bet:</span>
                  <span className="font-semibold text-white">{bet.outcome}</span>
                  <span className="text-zinc-600">@</span>
                  <span className="text-blue-400 font-mono font-bold text-lg">{bet.odds.toFixed(2)}</span>
                  <span className="text-zinc-500">on</span>
                  <span className="text-zinc-300 font-medium">{bet.bookmakerTitle}</span>
                </div>

                {/* Comparison */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                  <span>
                    Fair odds:
                    <span className="font-mono text-zinc-300 ml-1">{bet.fairOdds.toFixed(2)}</span>
                  </span>
                  <span>
                    Implied prob:
                    <span className="font-mono ml-1">{(bet.impliedProb * 100).toFixed(1)}%</span>
                  </span>
                  <span>
                    Fair prob:
                    <span className="font-mono ml-1">{(bet.fairProb * 100).toFixed(1)}%</span>
                  </span>
                  <span className="text-zinc-600">
                    Based on {bet.bookCount} books
                  </span>
                </div>
              </div>

              {/* EV badge */}
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-blue-400">+{bet.evPercent.toFixed(1)}%</div>
                <div className="text-xs text-zinc-500">expected value</div>
                <div className="text-xs text-blue-700 mt-0.5 font-mono">
                  {bet.odds.toFixed(2)} vs {bet.fairOdds.toFixed(2)} fair
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

export default function ValueBetsPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-7 w-7 text-blue-400" />
          <h1 className="text-3xl font-bold text-white">Value Bets</h1>
        </div>
        <p className="text-zinc-400 max-w-2xl">
          Positive expected value (EV+) bets where a bookmaker is offering odds above the
          consensus fair price. A value bet doesn&apos;t guarantee a win — it means the
          price is favourable relative to the true probability.
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-lg bg-blue-950/30 border border-blue-800/40 p-4 flex gap-3 text-sm text-blue-200">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
        <div>
          <strong>How EV is calculated:</strong> We derive a consensus fair probability for each
          outcome by averaging implied probabilities across all bookmakers (or using Pinnacle as
          a sharp reference). If a book&apos;s odds exceed the fair-value odds by ≥3 %, the bet
          appears here.
        </div>
      </div>

      {/* List */}
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <ValueBetSkeleton key={i} />)}
          </div>
        }
      >
        <ValueBetsList />
      </Suspense>
    </div>
  )
}
