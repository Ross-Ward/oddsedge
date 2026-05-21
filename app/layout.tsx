import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OddsEdge — Arbitrage Betting & Odds Comparison',
  description:
    'Find sure bets, compare odds across bookmakers, track dropping odds and get sports news. Free arbitrage calculator.',
  keywords: 'sure bets, arbitrage betting, odds comparison, dropping odds, sports betting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} min-h-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased`}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
