'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const FAQS = [
  {
    q: 'How do sure bets (arbitrage) work?',
    a: `Sure bets exploit differences in odds offered by different bookmakers for the same event. By placing bets on every possible outcome — each at the bookmaker offering the best price for that outcome — the combined implied probability falls below 100%, guaranteeing a profit regardless of the result. The strategy is also called "arbing" or arbitrage betting.`,
  },
  {
    q: 'What is the definition of arbitrage betting?',
    a: `In economics and finance, arbitrage is the practice of taking advantage of a price difference between two or more markets. Applied to betting: you simultaneously place bets on all outcomes of an event at different bookmakers, where the combined implied probabilities sum to less than 1.00. The difference between 1.00 and the actual sum is your guaranteed profit margin.`,
  },
  {
    q: 'How do I calculate a sure bet?',
    a: `The formula is: add together 1/odds for each outcome across different bookmakers. If the total is less than 1.00, you have an arbitrage. For example: Home @8.00 (1/8.00 = 0.125) + Draw @5.30 (1/5.30 = 0.189) + Away @1.50 (1/1.50 = 0.667) = 0.981. Since 0.981 < 1.00, profit = (1/0.981 − 1) × 100 = ~2%. Stakes are then split proportionally: stake for outcome i = (1/odds_i / total_implied) × bankroll.`,
  },
  {
    q: 'Is sure betting legal?',
    a: `Arbitrage betting is entirely legal in all countries where sports betting is legal. You are simply taking advantage of the best available odds across different licensed bookmakers. However, many bookmakers do not approve of arbing and may limit or close accounts if they detect patterns of systematic arbitrage. Starting with smaller stakes and spreading activity across many bookmakers helps mitigate this.`,
  },
  {
    q: 'Is there risk involved in sure bets?',
    a: `Mathematically, a properly executed sure bet has zero risk — you profit whatever the result. The main practical risks are: (1) odds changing before you place all bets, turning the arb into a loss; (2) bookmakers applying maximum stake limits lower than your calculated stake; (3) account restrictions from bookmakers who detect arbing. Always verify all odds directly on bookmaker sites before placing bets.`,
  },
  {
    q: 'What are "high sure bets"?',
    a: `High sure bets are arbitrage opportunities with a profit margin above 5%. By default, OddsEdge displays opportunities sorted by profit descending. Anything above 5% is considered a high sure bet. Higher profit margins are rarer and tend to be found on less popular leagues or markets where bookmakers update odds less frequently.`,
  },
  {
    q: 'How much money can I make with arbitrage betting?',
    a: `Returns vary based on your bankroll, how many bookmaker accounts you maintain, and how frequently you can place bets. Typical sure bet margins are 1–5%, meaning a £1,000 bankroll cycled through a 2% arb returns £20 profit per cycle. Active arbers who spot and act on opportunities quickly, with accounts at 20+ bookmakers, can realistically achieve 5–20% monthly returns on their rolling bankroll.`,
  },
  {
    q: 'What difficulties should I expect?',
    a: `Key challenges include: (1) Speed — odds move fast, and arb windows can close in seconds; (2) Stake limits — bookmakers restrict max stakes, especially on niche markets; (3) Account restrictions — bookmakers may limit winning accounts; (4) Capital requirements — you need funds distributed across multiple bookmaker accounts in advance. Starting with 2-way markets (e.g., tennis, which has no draw) is easier for beginners.`,
  },
  {
    q: 'Which bookmakers are best for arbitrage betting?',
    a: `Pinnacle is widely considered the most arber-friendly bookmaker — it accepts high limits and does not restrict winning players. Betfair Exchange allows laying, which opens unique arb opportunities. For European football, bookmakers like bet365, William Hill, and Betway offer competitive odds across many markets. Having accounts at 10+ bookmakers maximises your ability to find and exploit arbs.`,
  },
  {
    q: 'Is the OddsEdge Sure Bets tool free?',
    a: `Yes — OddsEdge's Sure Bets finder is completely free to use, with no sign-up required. We scan hundreds of events across major bookmakers in real time and update opportunities every 5 minutes. Use the built-in bankroll calculator to determine your exact stakes.`,
  },
]

export function ArbFAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className={`rounded-xl border overflow-hidden transition-colors ${
            open === i ? 'border-emerald-800/60 bg-emerald-950/10' : 'border-zinc-800 bg-zinc-900/40'
          }`}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
          >
            <span className="font-medium text-zinc-200 text-sm leading-snug">{faq.q}</span>
            {open === i
              ? <ChevronUp  className="h-4 w-4 text-emerald-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />}
          </button>
          {open === i && (
            <div className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-4">
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
