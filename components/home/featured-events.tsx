import Link from 'next/link'
import { getAllEvents } from '@/lib/aggregator'
import { formatMatchDate, formatMatchTime, SPORT_EMOJIS } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { Event } from '@/lib/types'

export async function FeaturedEvents() {
  let events: Event[] = []
  try {
    events = await getAllEvents()
  } catch {
    events = []
  }

  const featured = events.slice(0, 8)

  return (
    <section className="py-10">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Featured Events</h2>
          <Link href="/odds" className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">
            All events <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {featured.map(event => {
              const bestHome = Math.max(
                ...event.bookmakers.flatMap((bk) =>
                  bk.markets.find((m) => m.key === 'h2h')?.outcomes
                    .filter((o) => o.name === 'Home')
                    .map((o) => o.price) ?? []
                )
              )
              const bestAway = Math.max(
                ...event.bookmakers.flatMap((bk) =>
                  bk.markets.find((m) => m.key === 'h2h')?.outcomes
                    .filter((o) => o.name === 'Away')
                    .map((o) => o.price) ?? []
                )
              )

              return (
                <Link key={event.id} href={`/odds?sport=${event.sport}`}>
                  <Card className="p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60 cursor-pointer">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {SPORT_EMOJIS[event.sport]} {event.league}
                      </span>
                      {event.isLive
                        ? <Badge variant="live">LIVE</Badge>
                        : <span className="text-xs text-zinc-500">
                            {formatMatchDate(event.commenceTime)} {formatMatchTime(event.commenceTime)}
                          </span>
                      }
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100 truncate max-w-32.5">{event.homeTeam}</span>
                        <span className="font-mono text-emerald-400 font-bold">{isFinite(bestHome) ? bestHome.toFixed(2) : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100 truncate max-w-32.5">{event.awayTeam}</span>
                        <span className="font-mono text-emerald-400 font-bold">{isFinite(bestAway) ? bestAway.toFixed(2) : '—'}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
