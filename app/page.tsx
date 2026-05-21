import { Suspense } from 'react'
import { Hero } from '@/components/home/hero'
import { SportsTabs } from '@/components/home/sports-tabs'
import { FeaturedEvents } from '@/components/home/featured-events'
import { TopSureBets } from '@/components/home/top-sure-bets'
import { HowItWorks } from '@/components/home/how-it-works'
import { Skeleton } from '@/components/ui/skeleton'

function SectionFallback() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Skeleton className="h-7 w-48 mb-6" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <SportsTabs />
      <Suspense fallback={<SectionFallback />}>
        <FeaturedEvents />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <TopSureBets />
      </Suspense>
      <HowItWorks />
    </>
  )
}

