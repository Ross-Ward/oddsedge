import { getArbOpportunities } from '@/lib/aggregator'
import { SureBetsContent } from '@/components/sure-bets/sure-bets-content'
import { ArbFAQ } from '@/components/sure-bets/arb-faq'
import { Card } from '@/components/ui/card'
import { Info, Lock, ChevronRight, TrendingUp, BarChart3, Zap, Newspaper } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sure Bets — Guaranteed Arbitrage Opportunities | OddsEdge',
  description:
    'Find real-time sure bets and arbitrage opportunities across 30+ bookmakers. Guaranteed profit when total implied probability falls below 100%. Free built-in stake calculator.',
  keywords: 'sure bets, arbitrage betting, guaranteed profit, arb finder, sports arbitrage, free calculator',
}

export const revalidate = 300

// ── Static data ──────────────────────────────────────────────────────────────

const WORKED_EXAMPLE_LEGS = [
  { outcome: '1 — Team A', bk: 'Bookmaker A', odds: 8.00, implied: 12.50 },
  { outcome: 'X — Draw',   bk: 'Bookmaker B', odds: 5.30, implied: 18.87 },
  { outcome: '2 — Team B', bk: 'Bookmaker C', odds: 1.50, implied: 66.67 },
]
const WORKED_TOTAL  = 98.04
const WORKED_PROFIT = 2.0
const WORKED_STAKES = [
  { outcome: '1 — Team A', stake: 12.75, returns: 102 },
  { outcome: 'X — Draw',   stake: 19.25, returns: 102 },
  { outcome: '2 — Team B', stake: 68.00, returns: 102 },
]

const OTHER_TOOLS = [
  {
    label: 'Value Bets',
    href:  '/value-bets',
    icon:  <Zap className="h-5 w-5" />,
    color: 'text-yellow-400',
    desc:  'Find bets where the odds underestimate the true win probability — positive expected value.',
  },
  {
    label: 'Dropping Odds',
    href:  '/dropping-odds',
    icon:  <TrendingUp className="h-5 w-5" />,
    color: 'text-red-400',
    desc:  'Detect significant odds movements before the market corrects — early signal of sharp money.',
  },
  {
    label: 'Odds Comparison',
    href:  '/odds',
    icon:  <BarChart3 className="h-5 w-5" />,
    color: 'text-blue-400',
    desc:  'Compare live odds across all major bookmakers side-by-side for any sport or market.',
  },
  {
    label: 'Sports News',
    href:  '/news',
    icon:  <Newspaper className="h-5 w-5" />,
    color: 'text-zinc-300',
    desc:  'Latest match news, injury reports and team updates from all major sports.',
  },
]

const BOOKMAKER_BONUSES = [
  {
    name: 'bet365', rating: 4.8, badge: 'POPULAR',
    bonus: 'Bet £10 Get £30 in Free Bets',
    desc:  'One of the world\'s largest bookmakers. Huge market selection, competitive odds across all sports.',
    note:  'New UK customers only. Min deposit £10. T&Cs apply.',
  },
  {
    name: 'Pinnacle', rating: 4.9, badge: 'ARBER-FRIENDLY',
    bonus: 'Best Odds — No Limits',
    desc:  'The professional\'s choice. Highest limits, no account restrictions, welcomes winning bettors.',
    note:  'Available in selected countries. T&Cs apply.',
  },
  {
    name: 'Betfair Exchange', rating: 4.7, badge: 'EXCHANGE',
    bonus: 'New Customer Offer Available',
    desc:  'Back AND lay on the exchange. Essential for matched betting and arb hedging strategies.',
    note:  'Check site for current offer. T&Cs apply.',
  },
  {
    name: 'William Hill', rating: 4.5, badge: null,
    bonus: 'Up to £30 Free Bets',
    desc:  'One of the UK\'s oldest bookmakers. Reliable payouts, wide sports coverage, solid mobile app.',
    note:  'New customers only. Min £10 bet. T&Cs apply.',
  },
  {
    name: 'Ladbrokes', rating: 4.3, badge: null,
    bonus: 'Up to £20 Free Bet',
    desc:  'Competitive odds on football, horse racing and major US sports. Good live-betting platform.',
    note:  'New customers only. T&Cs apply.',
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SureBetsPage() {
  const opps      = await getArbOpportunities()
  const maxProfit = opps.length > 0 ? Math.max(...opps.map(o => o.profitPct)) : 0

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-linear-to-b from-emerald-950/50 to-zinc-950 border-b border-zinc-800/50">
        <div className="container mx-auto max-w-7xl px-4 py-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 shrink-0">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-white leading-tight">Sure Bets</h1>
                  <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                    Arbitrage Finder — Powered by OddsEdge
                  </p>
                </div>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Revolutionise your betting with OddsEdge&apos;s Sure Bets tool. Use{' '}
                <strong className="text-zinc-200">arbitrage betting</strong> to guarantee profit,
                minimise risk, and maximise your rewards — whatever the result. Filter by sport,
                market type, or minimum profit %. Click any bet to open the built-in stake calculator.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-center min-w-21.25">
                <div className="text-2xl font-bold text-emerald-400">{opps.length}</div>
                <div className="text-[11px] text-zinc-500">Live Arbs</div>
              </div>
              {maxProfit > 0 && (
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-center min-w-21.25">
                  <div className="text-2xl font-bold text-emerald-400">+{maxProfit.toFixed(1)}%</div>
                  <div className="text-[11px] text-zinc-500">Best Profit</div>
                </div>
              )}
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-center min-w-21.25">
                <div className="text-2xl font-bold text-emerald-400">30+</div>
                <div className="text-[11px] text-zinc-500">Bookmakers</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-12">

        {/* ── How-to banner ──────────────────────────────────────────────── */}
        <Card className="p-4 bg-emerald-950/30 border-emerald-800/50">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              <span className="font-semibold text-emerald-400">How to use: </span>
              Place the exact stake amounts shown on each bookmaker{' '}
              <strong className="text-white">simultaneously</strong>. All bets must be placed before
              odds change. Use the built-in calculator to set your bankroll. Accounts must be
              pre-funded at each bookmaker.{' '}
              <strong className="text-white">Always verify odds directly on bookmaker sites</strong>{' '}
              before placing — odds move in real time.
            </div>
          </div>
        </Card>

        {/* ── Live opportunities ─────────────────────────────────────────── */}
        <SureBetsContent initialOpps={opps} />

        {/* ── How to Calculate ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">How to Calculate Sure Bets</h2>
          <p className="text-zinc-400 mb-6 max-w-2xl">
            The maths behind arbitrage is straightforward. When the sum of implied probabilities
            across all outcomes from different bookmakers falls below 1.00, a sure bet exists.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Formula */}
            <Card className="p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400 font-mono">01.</span> The Arbitrage Formula
              </h3>
              <div className="rounded-lg bg-zinc-950 border border-zinc-700 p-4 font-mono text-sm space-y-3 mb-4">
                <div>
                  <div className="text-zinc-500 text-xs mb-1">// Identify an arb:</div>
                  <div className="text-emerald-300">(1/odds₁) + (1/odds₂) + … {'<'} 1.00</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">// Guaranteed profit %:</div>
                  <div className="text-emerald-300">profit = (1 ÷ sum − 1) × 100</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">// Optimal stake for outcome i:</div>
                  <div className="text-emerald-300">stake_i = (1/odds_i ÷ sum) × bankroll</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">// Guaranteed return (all outcomes equal):</div>
                  <div className="text-emerald-300">returns = bankroll ÷ sum</div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Each stake is proportional to the inverse of its odds, ensuring every possible
                outcome returns <em>exactly the same amount</em> — your guaranteed profit regardless
                of the result.
              </p>
            </Card>

            {/* Worked example */}
            <Card className="p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400 font-mono">02.</span> Worked Example — 1X2 Football
              </h3>
              <p className="text-xs text-zinc-500 mb-3">Team A vs Team B · 3-way market · £100 bankroll</p>
              <div className="rounded-lg overflow-hidden border border-zinc-800 text-xs mb-3">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-800/60 text-zinc-400">
                      <th className="text-left  px-3 py-2 font-medium">Outcome</th>
                      <th className="text-right px-3 py-2 font-medium">Bookmaker</th>
                      <th className="text-right px-3 py-2 font-medium">Odds</th>
                      <th className="text-right px-3 py-2 font-medium">Implied %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WORKED_EXAMPLE_LEGS.map((leg, i) => (
                      <tr key={i} className="bg-zinc-900 border-t border-zinc-800">
                        <td className="px-3 py-2 text-zinc-200">{leg.outcome}</td>
                        <td className="px-3 py-2 text-right text-zinc-400">{leg.bk}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-400 font-bold">{leg.odds.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">{leg.implied.toFixed(2)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-950/30 border-t border-emerald-800/50 font-semibold">
                      <td colSpan={3} className="px-3 py-2 text-emerald-400 text-xs">Total Implied</td>
                      <td className="px-3 py-2 text-right font-mono text-red-400">{WORKED_TOTAL.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {WORKED_TOTAL.toFixed(2)}% &lt; 100% →{' '}
                <span className="text-emerald-400 font-semibold">+{WORKED_PROFIT}% guaranteed profit</span>
              </p>
              <div className="rounded-lg overflow-hidden border border-zinc-800 text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-800/60 text-zinc-400">
                      <th className="text-left  px-3 py-2 font-medium">Outcome</th>
                      <th className="text-right px-3 py-2 font-medium">Stake</th>
                      <th className="text-right px-3 py-2 font-medium">Returns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WORKED_STAKES.map((s, i) => (
                      <tr key={i} className="bg-zinc-900 border-t border-zinc-800">
                        <td className="px-3 py-2 text-zinc-200">{s.outcome}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">£{s.stake.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-400">£{s.returns.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-950/30 border-t border-emerald-800/50 font-semibold">
                      <td className="px-3 py-2 text-zinc-400 text-xs">Total · Net profit</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-200">£100.00</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-400">+£{WORKED_PROFIT.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">Sure Betting Explained — Arbitrage FAQ</h2>
          <p className="text-zinc-400 mb-6">Everything you need to know about sure bets and arbitrage strategy.</p>
          <ArbFAQ />
        </section>

        {/* ── Other Tools ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-2">Other Betting Tools</h2>
          <p className="text-zinc-400 mb-6">
            Complete your toolkit — all free, no sign-up required.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OTHER_TOOLS.map(tool => (
              <Link
                key={tool.href}
                href={tool.href}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 hover:border-emerald-600/50 hover:bg-zinc-800/60 p-5 transition-all group"
              >
                <div className={`${tool.color} mb-3`}>{tool.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1.5 group-hover:text-emerald-400 transition-colors">
                  {tool.label}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{tool.desc}</p>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Open tool <ChevronRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Bookmaker Bonuses ───────────────────────────────────────────── */}
        <section className="pb-4">
          <h2 className="text-2xl font-bold text-white mb-2">Top Bookmaker Reviews &amp; Bonuses</h2>
          <p className="text-zinc-400 mb-6 max-w-2xl">
            Having accounts at multiple bookmakers is{' '}
            <strong className="text-zinc-200">essential</strong> for arbitrage betting — you need
            the best price on each outcome from different sites. These are OddsEdge&apos;s top-rated
            bookmakers for arbers.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BOOKMAKER_BONUSES.map((bk, i) => (
              <div key={bk.name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-600/30 shrink-0 font-bold text-emerald-400 text-sm">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-bold text-white text-sm">{bk.name}</span>
                    {bk.badge && (
                      <span className="text-[10px] bg-emerald-800/60 text-emerald-300 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                        {bk.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 mb-1">{bk.bonus}</div>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-2">{bk.desc}</p>
                  <div className="flex items-center gap-0.5 mb-1">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className={`text-sm leading-none ${j < Math.round(bk.rating) ? 'text-yellow-400' : 'text-zinc-700'}`}>★</span>
                    ))}
                    <span className="text-xs text-zinc-500 ml-1">{bk.rating}/5</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{bk.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-5 leading-relaxed">
            * OddsEdge may receive a commission if you sign up via these links — at no cost to you.
            All ratings are based on independent editorial review. Gambling involves risk.{' '}
            <strong>Please gamble responsibly</strong> and never bet more than you can afford to lose.
            For support visit{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
              BeGambleAware.org
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
