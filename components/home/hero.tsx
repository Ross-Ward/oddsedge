import Link from 'next/link'
import { ArrowRight, Shield, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATS = [
  { label: 'Live Bookmakers', value: '30+', icon: Shield },
  { label: 'Active Sure Bets', value: '150+', icon: TrendingUp },
  { label: 'Avg Profit', value: '2.4%', icon: Zap },
  { label: 'Dropping Now', value: '88+', icon: TrendingDown },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800 bg-zinc-950 py-16 md:py-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto max-w-7xl px-4 text-center">
        <Badge variant="secondary" className="mb-5 gap-1">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Live odds updated every 60 seconds
        </Badge>

        <h1 className="mx-auto mb-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          Find{' '}
          <span className="bg-linear-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            sure bets
          </span>{' '}
          before anyone else
        </h1>

        <p className="mx-auto mb-8 max-w-xl text-lg text-zinc-400">
          Compare odds from 30+ bookmakers, detect arbitrage opportunities instantly, and
          track dropping odds — all in one place. Free, no sign-up.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sure-bets">
              View Sure Bets <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/odds">Compare Odds</Link>
          </Button>
        </div>

        {/* Stats bar */}
        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 backdrop-blur">
              <Icon className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
