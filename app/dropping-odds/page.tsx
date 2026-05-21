import { Suspense } from 'react'
import { getDroppingOdds } from '@/lib/aggregator'
import { formatMatchDate, formatMatchTime, SPORT_EMOJIS } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingDown, Info } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dropping Odds | OddsEdge',
  description: 'Track bookmaker odds that are falling fast — often a sign of sharp money or team news.',
}

export const revalidate = 120

async function DroppingList() {
  const drops = await getDroppingOdds()

  if (drops.length === 0) {
    return (
      <Card className="p-12 text-center">
        <TrendingDown className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
        <p className="text-zinc-400 font-medium">No significant drops detected yet</p>
        <p className="text-zinc-600 text-sm mt-1">
          Dropping odds appear after the first data cycle (~2 min). Check back shortly.
        </p>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-900">
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Event</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Bookmaker</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Outcome</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase">Previous</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase">Current</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase">Change</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400 uppercase">Time</th>
          </tr>
        </thead>
        <tbody className="bg-zinc-950">
          {drops.map((drop, i) => (
            <tr
              key={drop.id}
              className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/30'}`}
            >
              <td className="px-4 py-3">
                <div className="text-xs text-zinc-500 mb-0.5">
                  {SPORT_EMOJIS[drop.event.sport]} {drop.event.league}
                </div>
                <div className="font-medium text-zinc-200">
                  {drop.event.homeTeam} <span className="text-zinc-600">vs</span> {drop.event.awayTeam}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatMatchDate(drop.event.commenceTime)} {formatMatchTime(drop.event.commenceTime)}
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-300">{drop.bookmakerTitle}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{drop.outcome}</Badge>
              </td>
              <td className="px-4 py-3 text-right font-mono text-zinc-400 line-through">
                {drop.previousOdds.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-white">
                {drop.currentOdds.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="drop">
                  {drop.changePct.toFixed(1)}%
                </Badge>
              </td>
              <td className="px-4 py-3 text-right text-xs text-zinc-500">
                {new Date(drop.droppedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DroppingOddsPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <TrendingDown className="h-6 w-6 text-red-400" />
          <h1 className="text-3xl font-extrabold text-white">Dropping Odds</h1>
        </div>
        <p className="text-zinc-400 max-w-2xl">
          Odds dropping fast are often a signal — sharp bettors, team news, or injury updates.
          Track which outcomes bookmakers are shortening on.
        </p>
      </div>

      <Card className="mb-6 p-4 bg-red-950/20 border-red-900/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-red-400">Pro tip: </span>
            When odds drop quickly, it usually means informed money is coming in. This can indicate team news,
            line-up changes, or professional bettor activity. Act fast — these odds move quickly.
          </p>
        </div>
      </Card>

      <Suspense fallback={
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      }>
        <DroppingList />
      </Suspense>
    </div>
  )
}
