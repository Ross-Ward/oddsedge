import Link from 'next/link'
import { SPORT_EMOJIS, SPORT_LABELS } from '@/lib/utils'

const SPORTS = ['soccer', 'basketball', 'tennis', 'hockey', 'baseball', 'american_football', 'mma', 'cricket']

export function SportsTabs() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-900/40">
      <div className="container mx-auto max-w-7xl overflow-x-auto px-4">
        <div className="flex gap-1 py-2">
          {SPORTS.map(sport => (
            <Link
              key={sport}
              href={`/odds?sport=${sport}`}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <span>{SPORT_EMOJIS[sport]}</span>
              <span>{SPORT_LABELS[sport]}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
