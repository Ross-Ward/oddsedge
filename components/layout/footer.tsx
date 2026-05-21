import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

const FOOTER_LINKS = [
  { label: 'Sure Bets', href: '/sure-bets' },
  { label: 'Odds Comparison', href: '/odds' },
  { label: 'Dropping Odds', href: '/dropping-odds' },
  { label: 'Sports News', href: '/news' },
]

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Odds<span className="text-emerald-400">Edge</span>
              </span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-xs">
              Real-time sports odds comparison, arbitrage finder, and dropping odds tracker.
              Always free, no sign-up needed.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Features</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Disclaimer</h4>
            <p className="text-xs text-zinc-600 leading-relaxed">
              OddsEdge is for informational purposes only. Gambling involves risk.
              Please bet responsibly and within your means. This tool does not guarantee profits.
              Always verify odds directly with bookmakers before placing bets.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} OddsEdge — Odds data for informational use only.
        </div>
      </div>
    </footer>
  )
}
