import Link from 'next/link'
import { getArbOpportunities } from '@/lib/aggregator'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Lock } from 'lucide-react'
import { ArbOpportunity } from '@/lib/types'

export async function TopSureBets() {
  let opps: ArbOpportunity[] = []
  try {
    opps = await getArbOpportunities()
  } catch {
    opps = []
  }

  const top = opps.slice(0, 5)

  return (
    <section className="py-10 bg-zinc-900/30">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Top Sure Bets</h2>
            <Badge variant="profit">{opps.length} found</Badge>
          </div>
          <Link href="/sure-bets" className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {top.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-zinc-500 text-sm">No arbitrage opportunities detected right now. Check back shortly.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {top.map(opp => (
              <Card key={opp.id} className="p-4 border-l-4 border-l-emerald-500 hover:bg-zinc-800/40 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500 mb-1">{opp.event.league} · {opp.marketLabel}</div>
                    <div className="font-semibold text-zinc-100 truncate">
                      {opp.event.homeTeam} vs {opp.event.awayTeam}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {opp.stakes.map((s) => (
                        <span key={s.outcome} className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                          {s.bookmakerTitle}: <span className="text-white font-mono">{s.odds.toFixed(2)}</span> ({s.outcome})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="profit" className="text-base px-3 py-1">
                      +{opp.profitPct.toFixed(2)}%
                    </Badge>
                    <div className="text-xs text-zinc-500 mt-1">
                      on £100: <span className="text-emerald-400">+£{(opp.profitPct).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
