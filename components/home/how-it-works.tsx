import { Search, Calculator, DollarSign } from 'lucide-react'

const STEPS = [
  {
    icon: Search,
    title: 'We scan 30+ bookmakers',
    desc: 'Our engine fetches real-time odds from major bookmakers every minute.',
  },
  {
    icon: Calculator,
    title: 'Calculate arbitrage',
    desc: 'When the sum of inverse odds is < 1, a risk-free profit exists.',
  },
  {
    icon: DollarSign,
    title: 'You place the bets',
    desc: 'We tell you exactly how much to stake on each outcome to lock in profit.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-14 border-t border-zinc-800">
      <div className="container mx-auto max-w-7xl px-4">
        <h2 className="mb-10 text-center text-2xl font-bold text-white">How Arbitrage Betting Works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="absolute right-4 top-4 text-5xl font-black text-zinc-800 select-none">
                {i + 1}
              </div>
              <h3 className="mb-2 font-semibold text-white">{step.title}</h3>
              <p className="text-sm text-zinc-400">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Math explainer */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h3 className="mb-3 font-semibold text-white">The Maths</h3>
          <div className="flex flex-wrap gap-8 text-sm text-zinc-400">
            <div>
              <div className="font-mono text-emerald-400 mb-1">Implied probability = 1 / odds</div>
              <div>If Σ(1/odds) {'<'} 1.0 → arbitrage exists</div>
            </div>
            <div>
              <div className="font-mono text-emerald-400 mb-1">Profit % = (1/Σ(1/odds) − 1) × 100</div>
              <div>e.g. Σ = 0.975 → +2.56% guaranteed profit</div>
            </div>
            <div>
              <div className="font-mono text-emerald-400 mb-1">Stake on outcome i = bankroll × (1/odds_i) / Σ</div>
              <div>Guarantees equal return on all outcomes</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
