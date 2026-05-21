'use client'

import { useState, useMemo } from 'react'
import { ESPNEvent } from '@/lib/espn'
import { SPORT_EMOJIS, SPORT_LABELS, formatMatchDate, formatMatchTime } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Calendar, Clock, MapPin, Tv, ChevronRight, Radio } from 'lucide-react'
import Link from 'next/link'

const SPORT_FILTERS = [
  { key: 'all', label: '🌐 All' },
  { key: 'soccer', label: '⚽ Soccer' },
  { key: 'american_football', label: '🏈 NFL/CFB' },
  { key: 'basketball', label: '🏀 Basketball' },
  { key: 'baseball', label: '⚾ Baseball' },
  { key: 'hockey', label: '🏒 Hockey' },
  { key: 'tennis', label: '🎾 Tennis' },
  { key: 'cricket', label: '🏏 Cricket' },
  { key: 'rugby', label: '🏉 Rugby' },
  { key: 'mma', label: '🥊 MMA' },
]

const DATE_FILTERS = [
  { key: 'all',  label: 'All Fixtures' },
  { key: 'live', label: '🔴 Live Now' },
  { key: 'today',    label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week',     label: 'This Week' },
]

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function groupByLeague(events: ESPNEvent[]): Map<string, ESPNEvent[]> {
  const map = new Map<string, ESPNEvent[]>()
  for (const ev of events) {
    const key = `${SPORT_EMOJIS[ev.sport] ?? ''} ${ev.league}`
    const arr = map.get(key) ?? []
    arr.push(ev)
    map.set(key, arr)
  }
  return map
}

function StatusBadge({ ev }: { ev: ESPNEvent }) {
  const state = ev.espn?.statusState
  if (ev.isLive || state === 'in') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 bg-red-900/30 border border-red-800/40 px-2 py-0.5 rounded-full animate-pulse">
        <Radio className="h-2.5 w-2.5" /> LIVE {ev.espn?.statusDetail ? `· ${ev.espn.statusDetail}` : ''}
      </span>
    )
  }
  if (state === 'post') {
    return (
      <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full">
        FT {ev.espn?.homeScore && ev.espn?.awayScore ? `${ev.espn.homeScore}–${ev.espn.awayScore}` : ''}
      </span>
    )
  }
  return (
    <span className="text-xs text-zinc-500 flex items-center gap-1">
      <Clock className="h-3 w-3" /> {formatMatchTime(ev.commenceTime)}
    </span>
  )
}

function OddsPill({ label, odds }: { label: string; odds: number }) {
  return (
    <div className="flex flex-col items-center bg-zinc-800 hover:bg-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors min-w-[52px]">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-emerald-400">{odds.toFixed(2)}</span>
    </div>
  )
}

function EventRow({ ev }: { ev: ESPNEvent }) {
  const h2h = ev.bookmakers[0]?.markets.find(m => m.key === 'h2h')
  const hasOdds = h2h && h2h.outcomes.length >= 2
  const statePost = ev.espn?.statusState === 'post'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/20 transition-colors ${ev.isLive ? 'border-l-2 border-l-red-500' : ''}`}>
      {/* Teams + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge ev={ev} />
          {ev.espn?.broadcast && (
            <span className="text-xs text-zinc-600 flex items-center gap-0.5">
              <Tv className="h-3 w-3" /> {ev.espn.broadcast}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${statePost ? 'text-zinc-500' : 'text-zinc-100'}`}>
            {ev.homeTeam}
            {ev.espn?.homeRecord && <span className="text-xs text-zinc-600 ml-1">({ev.espn.homeRecord})</span>}
          </span>
          <span className="text-zinc-600 text-xs">vs</span>
          <span className={`font-semibold text-sm ${statePost ? 'text-zinc-500' : 'text-zinc-100'}`}>
            {ev.awayTeam}
            {ev.espn?.awayRecord && <span className="text-xs text-zinc-600 ml-1">({ev.espn.awayRecord})</span>}
          </span>
        </div>
        {ev.espn?.venue && (
          <p className="text-xs text-zinc-600 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {ev.espn.venue}
          </p>
        )}
      </div>

      {/* Odds pills */}
      <div className="flex items-center gap-1.5 shrink-0">
        {hasOdds ? (
          <>
            {h2h.outcomes.slice(0, 3).map(o => (
              <OddsPill key={o.name} label={o.name === ev.homeTeam ? 'H' : o.name === ev.awayTeam ? 'A' : o.name === 'Draw' ? 'D' : o.name.slice(0, 4)} odds={o.price} />
            ))}
            <Link
              href="/odds"
              className="text-xs text-zinc-500 hover:text-emerald-400 flex items-center gap-0.5 ml-1 transition-colors"
            >
              +{ev.bookmakers.length} books <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <span className="text-xs text-zinc-700 italic">No odds yet</span>
        )}
      </div>
    </div>
  )
}

interface Props {
  events: ESPNEvent[]
}

export function ScheduleContent({ events }: Props) {
  const [sport, setSport] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)

  const filtered = useMemo(() => {
    return events.filter(ev => {
      if (sport !== 'all' && ev.sport !== sport) return false
      const d = new Date(ev.commenceTime)
      if (dateFilter === 'live') return ev.isLive
      if (dateFilter === 'today') return isSameDay(d, now)
      if (dateFilter === 'tomorrow') return isSameDay(d, tomorrow)
      if (dateFilter === 'week') return d >= now && d <= weekEnd
      return true
    })
  }, [events, sport, dateFilter, now, tomorrow, weekEnd])

  const liveCount = events.filter(e => e.isLive).length
  const grouped = groupByLeague(filtered)

  return (
    <div>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="space-y-3 mb-6">
        {/* Date filter */}
        <div className="flex flex-wrap gap-2">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                dateFilter === f.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {f.label}
              {f.key === 'live' && liveCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{liveCount}</span>
              )}
            </button>
          ))}
        </div>
        {/* Sport filter */}
        <div className="flex flex-wrap gap-2">
          {SPORT_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSport(f.key)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                sport === f.key
                  ? 'bg-zinc-100 text-zinc-900 font-semibold'
                  : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 text-sm text-zinc-500">
        <span><strong className="text-zinc-200">{filtered.length}</strong> fixtures</span>
        <span><strong className="text-zinc-200">{grouped.size}</strong> leagues</span>
        {liveCount > 0 && (
          <span className="text-red-400"><strong>{liveCount}</strong> live now</span>
        )}
      </div>

      {/* ── Fixtures ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-zinc-900 border-zinc-800">
          <Calendar className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
          <p className="text-zinc-400">No fixtures found for these filters.</p>
          <button onClick={() => { setSport('all'); setDateFilter('all') }} className="mt-3 text-emerald-400 text-sm hover:underline">
            Reset filters
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([leagueKey, leagueEvents]) => (
            <Card key={leagueKey} className="bg-zinc-900 border-zinc-800 overflow-hidden">
              {/* League header */}
              <div className="px-4 py-2 bg-zinc-800/60 border-b border-zinc-700/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-200">{leagueKey}</span>
                <span className="text-xs text-zinc-600">{leagueEvents.length} fixtures</span>
              </div>
              {/* Events */}
              <div>
                {leagueEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
