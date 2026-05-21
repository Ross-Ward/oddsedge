import { getScheduleEvents } from '@/lib/aggregator'
import { ScheduleContent } from '@/components/schedule/schedule-content'
import { Calendar } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sports Schedule | OddsEdge',
  description: 'Complete sporting schedule — every game, race, and fight across NFL, NBA, MLB, NHL, Soccer, Tennis, Cricket, Rugby and more. Live scores, kick-off times, TV info and latest odds.',
}

export const revalidate = 300

export default async function SchedulePage() {
  const events = await getScheduleEvents()
  const liveCount = events.filter(e => e.isLive).length
  const leagues = new Set(events.map(e => e.league)).size

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-linear-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800/50">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shrink-0">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-white leading-tight">Sports Schedule</h1>
                  <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                    Every Game · Every League · Every Sport
                  </p>
                </div>
              </div>
              <p className="text-zinc-400 text-sm max-w-2xl">
                Complete fixture list across all major sports — kick-off times, TV channels, venues, team records, and available odds.
                Updated every 5 minutes via ESPN.
              </p>
            </div>
            {/* Stats */}
            <div className="flex gap-3 shrink-0">
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-white">{events.length}</div>
                <div className="text-[11px] text-zinc-500">Fixtures</div>
              </div>
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-white">{leagues}</div>
                <div className="text-[11px] text-zinc-500">Leagues</div>
              </div>
              {liveCount > 0 && (
                <div className="rounded-xl bg-red-900/40 border border-red-800/40 px-4 py-2 text-center">
                  <div className="text-2xl font-bold text-red-400">{liveCount}</div>
                  <div className="text-[11px] text-red-500">Live Now</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Schedule ─────────────────────────────────────────────────────── */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <ScheduleContent events={events} />
      </div>
    </div>
  )
}
