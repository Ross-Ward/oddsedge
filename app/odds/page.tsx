import { Suspense } from 'react'
import { getAllEvents } from '@/lib/aggregator'
import { formatMatchDate, formatMatchTime, SPORT_EMOJIS, SPORT_LABELS } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'
import { Event } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Odds Comparison | OddsEdge',
  description: 'Compare betting odds across 30+ bookmakers — sports, esports, horse racing, and prediction markets.',
}

export const revalidate = 300

// Sports to show as filter tabs
const SPORT_TABS = [
  'all', 'soccer', 'basketball', 'tennis', 'hockey', 'baseball',
  'american_football', 'mma', 'rugby', 'cricket', 'golf',
  'horse_racing', 'greyhound_racing', 'esports', 'prediction_market',
] as const

// Max bookmakers to show as columns (table becomes unwieldy beyond this)
const MAX_BK_COLUMNS = 12

function OddsCell({ odds, isBest }: { odds: number | null; isBest: boolean }) {
  if (!odds) return <td className="px-2 py-2.5 text-center text-zinc-700 text-sm">—</td>
  return (
    <td className={`px-2 py-2.5 text-center text-sm font-mono font-semibold transition-colors
      ${isBest ? 'text-emerald-400 bg-emerald-950/30' : 'text-zinc-300'}`}>
      {odds.toFixed(2)}
    </td>
  )
}

function EventOddsRow({
  event,
  bookmakers,
  outcomes,
}: {
  event: Event
  bookmakers: string[]
  outcomes: string[]
}) {
  const marketKey = event.sport === 'horse_racing' || event.sport === 'greyhound_racing'
    ? 'winner'
    : 'h2h'

  // Normalise outcome names so scrapers using actual team names (Bovada,
  // DraftKings, Action-Network) align with the 'Home'/'Draw'/'Away' column keys.
  const normOutcome = (name: string): string => {
    const n = name.toLowerCase().trim()
    const h = event.homeTeam.toLowerCase().trim()
    const a = event.awayTeam.toLowerCase().trim()
    if (n === 'home' || n === '1' || (h.length > 2 && n.startsWith(h.slice(0, Math.min(h.length, 10))))) return 'Home'
    if (n === 'away' || n === '2' || (a.length > 2 && n.startsWith(a.slice(0, Math.min(a.length, 10))))) return 'Away'
    if (n === 'draw' || n === 'x' || n === 'tie') return 'Draw'
    return name
  }

  // Build map: bookmaker -> outcome -> odds
  const oddsMap = new Map<string, Map<string, number>>()
  for (const bk of event.bookmakers) {
    const m = bk.markets.find(x => x.key === marketKey) ?? bk.markets[0]
    if (!m) continue
    const oMap = new Map<string, number>()
    for (const o of m.outcomes) oMap.set(normOutcome(o.name), o.price)
    oddsMap.set(bk.key, oMap)
  }

  // Best odds per outcome
  const bestOdds = new Map<string, number>()
  for (const outcome of outcomes) {
    let best = 0
    for (const [, oMap] of oddsMap) {
      const v = oMap.get(outcome) ?? 0
      if (v > best) best = v
    }
    if (best > 0) bestOdds.set(outcome, best)
  }

  const isPrediction = event.sport === 'prediction_market'

  return (
    <tr className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors">
      {/* Event info */}
      <td className="px-4 py-3 min-w-55 max-w-[320px]">
        <div className="text-xs text-zinc-500 mb-0.5">
          {SPORT_EMOJIS[event.sport] ?? ''} {event.league}
        </div>
        {isPrediction && event.question ? (
          <div className="font-medium text-zinc-200 text-sm leading-snug line-clamp-2">
            {event.question}
          </div>
        ) : (
          <div className="font-medium text-zinc-200 text-sm leading-snug">
            {event.homeTeam}
            <span className="text-zinc-600 mx-1">vs</span>
            {event.awayTeam}
          </div>
        )}
        <div className="text-xs text-zinc-500 mt-0.5">
          {event.isLive
            ? <span className="text-red-400 font-semibold">● LIVE</span>
            : `${formatMatchDate(event.commenceTime)} ${formatMatchTime(event.commenceTime)}`
          }
          {event.volume ? <span className="ml-2 text-zinc-600">Vol: {(event.volume / 1000).toFixed(0)}k</span> : null}
        </div>
      </td>

      {/* Odds per bookmaker per outcome */}
      {bookmakers.map(bk => {
        const bkMap = oddsMap.get(bk)
        return outcomes.map(outcome => {
          const odds = bkMap?.get(outcome) ?? null
          const isBest = odds !== null && bestOdds.get(outcome) === odds
          return <OddsCell key={`${bk}_${outcome}`} odds={odds} isBest={isBest} />
        })
      })}
    </tr>
  )
}

async function OddsTable({ sport }: { sport: string }) {
  let events = await getAllEvents()
  if (sport !== 'all') events = events.filter(e => e.sport === sport)

  if (events.length === 0) {
    return <p className="text-center text-zinc-500 py-12">No events found for this sport right now.</p>
  }

  // Determine which outcomes to show based on sport/filter
  const isPrediction = sport === 'prediction_market'
  const isRacing = sport === 'horse_racing' || sport === 'greyhound_racing'
  const isEsports = sport === 'esports'

  // For mixed 'all' view, use h2h outcomes. Racing uses 'winner'.
  let outcomeNames: string[]
  if (isPrediction) {
    outcomeNames = ['Yes', 'No']
  } else if (isRacing) {
    // Show top-3 runners by odds for racing (can't know runner names upfront)
    outcomeNames = []
  } else if (sport === 'soccer' || sport === 'all') {
    outcomeNames = ['Home', 'Draw', 'Away']
  } else {
    outcomeNames = ['Home', 'Away']
  }

  // For racing events, collect dynamic runner names (top 4 most common)
  if (isRacing) {
    const runnerCounts = new Map<string, number>()
    for (const ev of events.slice(0, 20)) {
      const mkt = ev.bookmakers[0]?.markets.find(m => m.key === 'winner') ?? ev.bookmakers[0]?.markets[0]
      if (!mkt) continue
      for (const o of mkt.outcomes.slice(0, 6)) {
        runnerCounts.set(o.name, (runnerCounts.get(o.name) ?? 0) + 1)
      }
    }
    // For racing, outcomes vary per race — we'll handle in a special view
    outcomeNames = ['Winner'] // placeholder; racing uses inline all-runner view
  }

  // Discover bookmakers that appear in these events, sorted by coverage
  const bkCoverage = new Map<string, { key: string; title: string; count: number }>()
  for (const ev of events) {
    for (const bk of ev.bookmakers) {
      const entry = bkCoverage.get(bk.key)
      if (entry) {
        entry.count++
      } else {
        bkCoverage.set(bk.key, { key: bk.key, title: bk.title, count: 1 })
      }
    }
  }

  const sortedBookmakers = Array.from(bkCoverage.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_BK_COLUMNS)

  const bkKeys   = sortedBookmakers.map(b => b.key)
  const bkTitles: Record<string, string> = {}
  for (const b of sortedBookmakers) bkTitles[b.key] = b.title

  // For racing: use a card-based layout showing all runners per race
  if (isRacing) {
    return (
      <div className="space-y-4">
        {events.slice(0, 40).map(ev => (
          <RaceCard key={ev.id} event={ev} />
        ))}
      </div>
    )
  }

  // For prediction markets: card-based layout  
  if (isPrediction) {
    return (
      <div className="space-y-4">
        {events.slice(0, 60).map(ev => (
          <PredictionCard key={ev.id} event={ev} />
        ))}
      </div>
    )
  }

  // Standard comparison table
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm min-w-225">
        <thead>
          <tr className="border-b border-zinc-700 bg-zinc-900">
            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900">
              Event
            </th>
            {bkKeys.map(bk => (
              <th
                key={bk}
                colSpan={outcomeNames.length}
                className="px-2 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider border-l border-zinc-800"
              >
                {bkTitles[bk] ?? bk}
              </th>
            ))}
          </tr>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="sticky left-0 bg-zinc-900/60" />
            {bkKeys.map(bk =>
              outcomeNames.map(o => (
                <th key={`${bk}_${o}`} className="px-2 py-1.5 text-center text-xs text-zinc-600">
                  {o === 'Home' ? '1' : o === 'Draw' ? 'X' : o === 'Away' ? '2' : o.substring(0, 4)}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody className="bg-zinc-950">
          {events.slice(0, 50).map(event => (
            <EventOddsRow
              key={event.id}
              event={event}
              bookmakers={bkKeys}
              outcomes={outcomeNames}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Card view for a single race showing all runners + bookmaker win odds */
function RaceCard({ event }: { event: Event }) {
  const winMarket = event.bookmakers[0]?.markets.find(m => m.key === 'winner') ?? event.bookmakers[0]?.markets[0]
  if (!winMarket) return null

  // Collect all runners with best odds across bookmakers
  const bestOdds = new Map<string, number>()
  for (const bk of event.bookmakers) {
    const m = bk.markets.find(x => x.key === 'winner') ?? bk.markets[0]
    if (!m) continue
    for (const o of m.outcomes) {
      const cur = bestOdds.get(o.name) ?? 0
      if (o.price > cur) bestOdds.set(o.name, o.price)
    }
  }

  const runners = Array.from(bestOdds.entries())
    .sort((a, b) => a[1] - b[1]) // shortest price first
    .slice(0, 12)

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-zinc-500 mb-0.5">{SPORT_EMOJIS[event.sport]} {event.league}</div>
          <div className="font-semibold text-zinc-200">{event.homeTeam}</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {formatMatchDate(event.commenceTime)} {formatMatchTime(event.commenceTime)}
            {event.runners ? ` · ${event.runners} runners` : ''}
          </div>
        </div>
        <div className="text-xs text-zinc-600">{event.bookmakers.length} bookmaker{event.bookmakers.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {runners.map(([name, odds]) => (
          <div key={name} className="bg-zinc-800/50 rounded-lg px-2 py-1.5 text-center">
            <div className="text-xs text-zinc-400 truncate">{name}</div>
            <div className="text-emerald-400 font-mono font-bold text-sm">{odds.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Card view for a single prediction market */
function PredictionCard({ event }: { event: Event }) {
  const bestYes = event.bookmakers.reduce((best, bk) => {
    const m = bk.markets[0]
    const yes = m?.outcomes.find(o => o.name === 'Yes')?.price ?? 0
    return yes > best ? yes : best
  }, 0)
  const bestNo = event.bookmakers.reduce((best, bk) => {
    const m = bk.markets[0]
    const no = m?.outcomes.find(o => o.name === 'No')?.price ?? 0
    return no > best ? no : best
  }, 0)

  // Implied probability from best yes odds
  const yesProb = bestYes > 0 ? Math.round((1 / bestYes) * 100) : null

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1">{SPORT_EMOJIS['prediction_market']} {event.league} · {event.category}</div>
          <div className="font-medium text-zinc-200 text-sm leading-snug mb-2">
            {event.question ?? event.homeTeam}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Yes</span>
              <span className="text-emerald-400 font-mono font-bold">{bestYes > 0 ? bestYes.toFixed(2) : '—'}</span>
              {yesProb !== null && <span className="text-xs text-zinc-600">({yesProb}%)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">No</span>
              <span className="text-zinc-300 font-mono font-bold">{bestNo > 0 ? bestNo.toFixed(2) : '—'}</span>
            </div>
            <div className="text-xs text-zinc-600">
              {formatMatchDate(event.commenceTime)} · {event.bookmakers.length} source{event.bookmakers.length !== 1 ? 's' : ''}
              {event.volume ? ` · $${(event.volume / 1000).toFixed(0)}k vol` : ''}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function OddsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  const sportParam = searchParams.then(p => p.sport ?? 'all')

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white mb-2">Odds Comparison</h1>
        <p className="text-zinc-400">
          Compare odds across 30+ bookmakers — sports, esports, horse racing, and prediction markets.
          Best odds per outcome are highlighted.
        </p>
      </div>

      {/* Sport filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SPORT_TABS.map(sport => (
          <a
            key={sport}
            href={`/odds?sport=${sport}`}
            className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {sport === 'all'
              ? 'All Markets'
              : `${SPORT_EMOJIS[sport] ?? ''} ${SPORT_LABELS[sport] ?? sport}`.trim()}
          </a>
        ))}
      </div>

      <Suspense fallback={
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      }>
        <OddsTableWrapper searchParams={sportParam} />
      </Suspense>
    </div>
  )
}

async function OddsTableWrapper({ searchParams }: { searchParams: Promise<string> }) {
  const sport = await searchParams
  return <OddsTable sport={sport} />
}

