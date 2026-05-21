import { getNewsArticles } from '@/lib/news'
import { timeAgo } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ExternalLink, Newspaper, Rss, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { BettingImpactTag } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Sports News | OddsEdge',
  description: 'Latest sports news from BBC Sport, ESPN, Sky Sports, The Guardian, MMA Fighting, Motorsport.com and more — filtered by sport.',
}

export const revalidate = 600

const CATEGORIES: { key: string; label: string; sport?: string }[] = [
  { key: 'all',               label: '🌐 All Sports' },
  { key: 'soccer',            label: '⚽ Soccer',          sport: 'soccer' },
  { key: 'american_football', label: '🏈 NFL',             sport: 'american_football' },
  { key: 'basketball',        label: '🏀 NBA',             sport: 'basketball' },
  { key: 'baseball',          label: '⚾ MLB',             sport: 'baseball' },
  { key: 'hockey',            label: '🏒 NHL',             sport: 'hockey' },
  { key: 'tennis',            label: '🎾 Tennis',          sport: 'tennis' },
  { key: 'cricket',           label: '🏏 Cricket',         sport: 'cricket' },
  { key: 'mma',               label: '🥊 Boxing/MMA',      sport: 'mma' },
  { key: 'golf',              label: '⛳ Golf',            sport: 'golf' },
  { key: 'motorsport',        label: '🏎️ F1/Motorsport',   sport: 'motorsport' },
  { key: 'rugby',             label: '🏉 Rugby',           sport: 'rugby' },
  { key: 'horse_racing',      label: '🏇 Horse Racing',    sport: 'horse_racing' },
]

const SOURCE_COLORS: Record<string, string> = {
  'BBC Sport':      'bg-red-900/40 text-red-300 border border-red-800/30',
  'ESPN':           'bg-orange-900/40 text-orange-300 border border-orange-800/30',
  'Sky Sports':     'bg-blue-900/40 text-blue-300 border border-blue-800/30',
  'The Guardian':   'bg-purple-900/40 text-purple-300 border border-purple-800/30',
  'MMA Fighting':   'bg-red-900/40 text-red-300 border border-red-800/30',
  'Motorsport.com': 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/30',
}

const IMPACT_FILTERS: { key: BettingImpactTag | 'all'; label: string }[] = [
  { key: 'all',           label: '🔍 All News' },
  { key: 'injury',        label: '🤕 Injuries' },
  { key: 'suspension',    label: '🟥 Suspensions' },
  { key: 'team_news',     label: '📋 Team News' },
  { key: 'manager',       label: '🧑‍💼 Manager' },
  { key: 'transfer',      label: '🔄 Transfers' },
  { key: 'odds_movement', label: '📈 Odds Move' },
  { key: 'form',          label: '📊 Form' },
  { key: 'weather',       label: '🌧️ Conditions' },
  { key: 'result',        label: '🏆 Results' },
]

const IMPACT_COLORS: Record<BettingImpactTag, string> = {
  injury:        'bg-red-900/50 text-red-300 border border-red-700/40',
  suspension:    'bg-orange-900/50 text-orange-300 border border-orange-700/40',
  team_news:     'bg-sky-900/50 text-sky-300 border border-sky-700/40',
  transfer:      'bg-indigo-900/50 text-indigo-300 border border-indigo-700/40',
  manager:       'bg-violet-900/50 text-violet-300 border border-violet-700/40',
  form:          'bg-teal-900/50 text-teal-300 border border-teal-700/40',
  weather:       'bg-slate-800/70 text-slate-300 border border-slate-600/40',
  result:        'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40',
  odds_movement: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/40',
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; impact?: string }>
}) {
  const { sport: activeSport = 'all', impact: activeImpact = 'all' } = await searchParams
  const articles = await getNewsArticles()

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = articles.filter(a => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  // Filter by selected sport
  const bySport = activeSport === 'all'
    ? unique
    : unique.filter(a => a.sport === activeSport)

  // Filter by betting impact tag
  const filtered = activeImpact === 'all'
    ? bySport
    : bySport.filter(a => a.bettingImpact?.tag === activeImpact)

  // Count per sport for badges
  const sportCounts: Record<string, number> = { all: unique.length }
  for (const a of unique) {
    if (a.sport) sportCounts[a.sport] = (sportCounts[a.sport] ?? 0) + 1
  }

  // Count per impact tag (within current sport filter)
  const impactCounts: Record<string, number> = { all: bySport.length }
  for (const a of bySport) {
    if (a.bettingImpact) {
      const tag = a.bettingImpact.tag
      impactCounts[tag] = (impactCounts[tag] ?? 0) + 1
    }
  }

  const featured = filtered.slice(0, 4)
  const rest = filtered.slice(4)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-linear-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800/50">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-700 shrink-0">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white leading-tight">Sports News</h1>
              <p className="text-xs text-zinc-500 tracking-wide">Live feeds · {unique.length} stories today</p>
            </div>
          </div>
          <p className="text-zinc-400 text-sm max-w-2xl mt-1">
            Latest from BBC Sport, ESPN, Sky Sports and more — with betting impact analysis on every story.
          </p>
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="text-red-400">🤕</span> Injuries &amp; suspensions that shift match odds</span>
            <span className="flex items-center gap-1"><span className="text-yellow-400">📈</span> Reported odds movement &amp; sharp money</span>
            <span className="flex items-center gap-1"><span className="text-sky-400">📋</span> Team news &amp; confirmed lineups</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-6">
        {/* ── Sport Category Tabs ──────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map(cat => {
            const count = sportCounts[cat.sport ?? 'all'] ?? 0
            const isActive = activeSport === cat.key
            if (cat.key !== 'all' && count === 0) return null
            const href = cat.key === 'all'
              ? (activeImpact === 'all' ? '/news' : `/news?impact=${activeImpact}`)
              : (activeImpact === 'all' ? `/news?sport=${cat.key}` : `/news?sport=${cat.key}&impact=${activeImpact}`)
            return (
              <Link
                key={cat.key}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {cat.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${isActive ? 'bg-emerald-700/60 text-emerald-100' : 'bg-zinc-700 text-zinc-500'}`}>
                  {cat.key === 'all' ? unique.length : count}
                </span>
              </Link>
            )
          })}
        </div>

        {/* ── Betting Impact Filter ────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mr-1 self-center">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Betting impact:</span>
          </div>
          {IMPACT_FILTERS.map(f => {
            const count = impactCounts[f.key] ?? 0
            const isActive = activeImpact === f.key
            if (f.key !== 'all' && count === 0) return null
            const href = f.key === 'all'
              ? (activeSport === 'all' ? '/news' : `/news?sport=${activeSport}`)
              : (activeSport === 'all' ? `/news?impact=${f.key}` : `/news?sport=${activeSport}&impact=${f.key}`)
            return (
              <Link
                key={f.key}
                href={href}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white'
                    : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {f.label}
                <span className={`text-xs rounded-full px-1 py-0.5 ${ isActive ? 'bg-amber-700/60 text-amber-100' : 'bg-zinc-700 text-zinc-500'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-12 text-center bg-zinc-900 border-zinc-800">
            <Newspaper className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-zinc-400 mb-1">No articles found for this category right now.</p>
            <p className="text-zinc-600 text-sm">RSS feeds may be temporarily unavailable. Try another category or check back shortly.</p>
            <Link href="/news" className="mt-4 inline-flex items-center gap-1 text-emerald-400 text-sm hover:underline">
              View all sports
            </Link>
          </Card>
        ) : (
          <>
            {/* ── Featured Grid ──────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {featured.map(article => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <Card className="overflow-hidden h-full bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors">
                    {article.imageUrl ? (
                      <div className="h-40 bg-zinc-800 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={article.imageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                    ) : (
                      <div className="h-24 bg-zinc-800 flex items-center justify-center">
                        <Rss className="h-8 w-8 text-zinc-600" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[article.source] ?? 'bg-zinc-800 text-zinc-400'}`}>
                          {article.source}
                        </span>
                        <span className="text-xs text-zinc-600">{timeAgo(article.publishedAt)}</span>
                        {article.bettingImpact && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[article.bettingImpact.tag]}`}>
                            {article.bettingImpact.label}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-zinc-100 text-sm leading-snug group-hover:text-emerald-400 transition-colors line-clamp-3">
                        {article.title}
                      </h3>
                      {article.bettingImpact && (
                        <p className="mt-2 text-xs text-amber-400/80 flex items-start gap-1">
                          <TrendingUp className="h-3 w-3 shrink-0 mt-0.5" />
                          {article.bettingImpact.hint}
                        </p>
                      )}
                    </div>
                  </Card>
                </a>
              ))}
            </div>

            {/* ── Article List ───────────────────────────────────────────── */}
            {rest.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-3">More stories</p>
                {rest.map(article => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[article.source] ?? 'bg-zinc-800 text-zinc-400'}`}>
                              {article.source}
                            </span>
                            <span className="text-xs text-zinc-600">{timeAgo(article.publishedAt)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {article.bettingImpact && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[article.bettingImpact.tag]}`}>
                                {article.bettingImpact.label}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-zinc-200 text-sm group-hover:text-emerald-400 transition-colors line-clamp-2">
                            {article.title}
                          </h3>
                          {article.bettingImpact ? (
                            <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 shrink-0" />
                              {article.bettingImpact.hint}
                            </p>
                          ) : article.summary ? (
                            <p className="text-xs text-zinc-600 mt-1 line-clamp-1">{article.summary}</p>
                          ) : null}
                        </div>
                        <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-1 transition-colors" />
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Sources Footer ────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 text-center">
            News sourced from public RSS feeds: BBC Sport · ESPN · Sky Sports · The Guardian · MMA Fighting · Motorsport.com · Sky Sports. OddsEdge does not own or endorse any linked content.
          </p>
        </div>
      </div>
    </div>
  )
}
