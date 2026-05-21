'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArbCard } from './arb-card'
import type { ArbOpportunity } from '@/lib/types'
import { SPORT_EMOJIS, SPORT_LABELS } from '@/lib/utils'
import { RefreshCw, Lock, Filter } from 'lucide-react'
import { Card } from '@/components/ui/card'

const PROFIT_TIERS = [
  { key: 0,  label: 'All'   },
  { key: 1,  label: '1%+'   },
  { key: 2,  label: '2%+'   },
  { key: 5,  label: '5%+'   },
  { key: 10, label: '10%+'  },
]

const MARKETS = [
  { key: 'all',     label: 'All Markets' },
  { key: 'h2h',     label: '1X2 / H2H'  },
  { key: 'totals',  label: 'Over/Under'  },
  { key: 'spreads', label: 'Handicap'    },
]

interface Props {
  initialOpps: ArbOpportunity[]
}

export function SureBetsContent({ initialOpps }: Props) {
  const router                          = useRouter()
  const [isPending, startTransition]    = useTransition()
  const [sport,     setSport]           = useState('all')
  const [market,    setMarket]          = useState('all')
  const [minProfit, setMinProfit]       = useState(0)
  const [countdown, setCountdown]       = useState(300) // 5 min in seconds
  const mountedRef                      = useRef(false)

  // Auto-refresh countdown → trigger ISR revalidation when it hits zero
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return 300
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Trigger router refresh when countdown resets to 300 (i.e. just fired).
  // Skip the initial mount where countdown starts at 300.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (countdown === 300) {
      startTransition(() => router.refresh())
    }
  }, [countdown, router, startTransition])

  // Compute unique sports present in the data
  const sportsInData = Array.from(new Set(initialOpps.map(o => o.event.sport)))

  // Counts per sport
  const sportCounts: Record<string, number> = { all: initialOpps.length }
  for (const opp of initialOpps) {
    sportCounts[opp.event.sport] = (sportCounts[opp.event.sport] ?? 0) + 1
  }

  // Client-side filtering
  const filtered = initialOpps.filter(o => {
    if (sport  !== 'all'  && o.event.sport !== sport)  return false
    if (market !== 'all'  && o.market      !== market) return false
    if (o.profitPct < minProfit)                        return false
    return true
  })

  const maxProfit    = initialOpps.length > 0 ? Math.max(...initialOpps.map(o => o.profitPct)) : 0
  const refreshMins  = Math.floor(countdown / 60)
  const refreshSecs  = countdown % 60

  return (
    <div>
      {/* ── Stats + Refresh bar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <span className="text-zinc-500">
          <span className="text-emerald-400 font-bold text-base">{initialOpps.length}</span>{' '}opportunities
        </span>
        {maxProfit > 0 && (
          <span className="text-zinc-500">
            <span className="text-emerald-400 font-bold text-base">+{maxProfit.toFixed(2)}%</span>{' '}highest profit
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refreshes in {refreshMins}:{String(refreshSecs).padStart(2, '0')}</span>
          <button
            onClick={() => { startTransition(() => router.refresh()); setCountdown(300) }}
            className="text-emerald-400 hover:text-emerald-300 underline"
          >
            Refresh now
          </button>
        </div>
      </div>

      {/* ── Sport filter pills ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setSport('all')}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            sport === 'all'
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-zinc-700 text-zinc-400 hover:border-emerald-600/50 hover:text-white'
          }`}
        >
          All Sports
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${sport === 'all' ? 'bg-emerald-800' : 'bg-zinc-800'}`}>
            {initialOpps.length}
          </span>
        </button>

        {sportsInData.map(s => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              sport === s
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-zinc-700 text-zinc-400 hover:border-emerald-600/50 hover:text-white'
            }`}
          >
            <span>{SPORT_EMOJIS[s] ?? '🏟'}</span>
            <span>{SPORT_LABELS[s] ?? s}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${sport === s ? 'bg-emerald-800' : 'bg-zinc-800'}`}>
              {sportCounts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* ── Market + Profit filters ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {/* Market */}
        <div className="flex gap-1 items-center">
          <Filter className="h-3.5 w-3.5 text-zinc-500 mr-1" />
          {MARKETS.map(m => (
            <button
              key={m.key}
              onClick={() => setMarket(m.key)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                market === m.key
                  ? 'bg-zinc-700 border-zinc-500 text-white'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Profit % */}
        <div className="flex gap-1 items-center ml-auto">
          <span className="text-xs text-zinc-500 mr-1">Min profit:</span>
          {PROFIT_TIERS.map(p => (
            <button
              key={p.key}
              onClick={() => setMinProfit(p.key)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                minProfit === p.key
                  ? 'bg-emerald-600/20 border-emerald-600 text-emerald-400'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Lock className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
          <p className="text-zinc-400 font-medium">No opportunities match your filters</p>
          <p className="text-zinc-600 text-sm mt-1">
            Try adjusting your filters or check back in a few minutes.
          </p>
          <button
            onClick={() => { setSport('all'); setMarket('all'); setMinProfit(0) }}
            className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 underline"
          >
            Reset filters
          </button>
        </Card>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 mb-1 text-sm text-zinc-500">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>
              Showing{' '}
              <span className="text-emerald-400 font-semibold">{filtered.length}</span>
              {filtered.length < initialOpps.length && (
                <span> of {initialOpps.length}</span>
              )}{' '}
              opportunities · Updated every 5 minutes
            </span>
          </div>
          {filtered.map(opp => (
            <ArbCard key={opp.id} opp={opp} />
          ))}
        </div>
      )}
    </div>
  )
}
