import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2)
}

export function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatMatchTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatMatchDate(isoDate: string): string {
  const d = new Date(isoDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const SPORT_LABELS: Record<string, string> = {
  soccer: 'Soccer',
  basketball: 'Basketball',
  tennis: 'Tennis',
  hockey: 'Ice Hockey',
  baseball: 'Baseball',
  american_football: 'American Football',
  mma: 'MMA / UFC',
  cricket: 'Cricket',
  rugby: 'Rugby',
  golf: 'Golf',
  horse_racing: 'Horse Racing',
  greyhound_racing: 'Greyhound Racing',
  motorsport: 'Motorsport',
  esports: 'Esports',
  prediction_market: 'Prediction Markets',
}

export const SPORT_EMOJIS: Record<string, string> = {
  soccer: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  hockey: '🏒',
  baseball: '⚾',
  american_football: '🏈',
  mma: '🥊',
  cricket: '🏏',
  rugby: '🏉',
  golf: '⛳',
  horse_racing: '🐎',
  greyhound_racing: '🐕',
  motorsport: '🏎️',
  esports: '🎮',
  prediction_market: '📊',
}

export const BOOKMAKER_LOGOS: Record<string, string> = {
  bet365: 'bet365',
  draftkings: 'DK',
  fanduel: 'FD',
  betway: 'BW',
  williamhill: 'WH',
  unibet: 'UB',
  betfair: 'BF',
  pinnacle: 'PIN',
  bwin: 'BW',
  '1xbet': '1X',
  betvictor: 'BV',
  skybet: 'SKY',
  paddy_power: 'PP',
  ladbrokes: 'LAD',
  coral: 'COR',
}
